-- Calendar & Planning module (spec §9.4) + the iCal (.ics) export feed (spec §8.3).
--
-- This is the last module and it unifies the others. It owns two user-content
-- tables (calendar_events, contacts) plus the iCal feed-token table, and defines
-- the six per-source calendar views UNIONed as v_calendar_all.
--
-- RLS uses the same tenant-isolation template as the foundation tables
-- (see 0004_foundation_rls.sql) — current_user_household_ids() scopes every row.
--
-- ── Cross-module data flows through the DATABASE, not code (spec §3 boundary rule).
-- The v_calendar_* views read directly from the other modules' source tables and
-- normalise each to a common shape:
--   (household_id, source, source_id, title, "start", "end", all_day, category, link)
-- Every view is declared `with (security_invoker = on)` so the UNDERLYING tables'
-- RLS policies apply to the querying user — without it the view would run with the
-- view owner's privileges and leak rows across households.

-- ───────────────────────── Own tables ─────────────────────────

-- calendar_events: manual, free-form events the couple adds directly.
create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null,
  "start" timestamptz not null,
  "end" timestamptz,
  all_day boolean not null default false,
  location text,
  notes text,
  color text, -- user-chosen hex/name for manual events; null falls back in UI
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index calendar_events_household_idx on public.calendar_events(household_id);
create index calendar_events_start_idx
  on public.calendar_events(household_id, "start")
  where deleted_at is null;

-- contacts: people the household tracks; the birthdays source for the calendar.
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  dob date,
  relationship text,
  gift_ideas_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index contacts_household_idx on public.contacts(household_id);

-- ical_feed_tokens: one long random token per household for the .ics feed URL.
-- The token is a capability (separate from auth) so calendar apps can poll the
-- feed without logging in. Rotatable via rotate_ical_token() if leaked.
create table public.ical_feed_tokens (
  household_id uuid primary key references public.households(id) on delete cascade,
  token text unique not null,
  created_at timestamptz not null default now()
);

-- ───────────────────────── RLS: tenant isolation ─────────────────────────
alter table public.calendar_events  enable row level security;
alter table public.contacts         enable row level security;
alter table public.ical_feed_tokens enable row level security;

create policy calendar_events_tenant_isolation on public.calendar_events
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy contacts_tenant_isolation on public.contacts
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy ical_feed_tokens_tenant_isolation on public.ical_feed_tokens
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

-- ───────────────────────── iCal feed-token RPC ─────────────────────────
-- Upserts a fresh random token for the caller's household and returns it.
-- SECURITY DEFINER (mirrors generate_invite in 0007) so it can write the row
-- regardless of who calls; it always scopes to the caller's own household.
create or replace function public.rotate_ical_token()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_token text;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select household_id into v_household_id
    from public.household_members
    where user_id = v_user_id
    limit 1;

  if v_household_id is null then
    raise exception 'caller is not a member of any household'
      using errcode = 'insufficient_privilege';
  end if;

  -- 32 bytes → ~43 base64url chars, ~256 bits of entropy.
  v_token := translate(encode(gen_random_bytes(32), 'base64'), '+/=', '-_');

  insert into public.ical_feed_tokens (household_id, token, created_at)
    values (v_household_id, v_token, now())
  on conflict (household_id)
    do update set token = excluded.token, created_at = excluded.created_at;

  return v_token;
end;
$$;

revoke all on function public.rotate_ical_token() from public;
grant execute on function public.rotate_ical_token() to authenticated;

-- ───────────────────────── Calendar source views ─────────────────────────
-- Common shape: (household_id, source, source_id, title, "start", "end",
--                all_day, category, link). `link` is an in-app relative path the
-- UI deep-links to and the .ics feed embeds in the DESCRIPTION.

-- Bills: due on next_due (all-day). Category 'bills'.
create view public.v_calendar_bills
  with (security_invoker = on) as
  select
    b.household_id,
    'bills'::text                       as source,
    b.id                                as source_id,
    b.name || ' due'                    as title,
    b.next_due::timestamptz             as "start",
    b.next_due::timestamptz             as "end",
    true                                as all_day,
    'bills'::text                       as category,
    '/money'::text                      as link
  from public.bills b
  where b.deleted_at is null
    and b.next_due is not null;

-- Chores: due on next_due (all-day). Category 'chores'.
create view public.v_calendar_chores
  with (security_invoker = on) as
  select
    c.household_id,
    'chores'::text                      as source,
    c.id                                as source_id,
    c.name                              as title,
    c.next_due::timestamptz             as "start",
    c.next_due::timestamptz             as "end",
    true                                as all_day,
    'chores'::text                      as category,
    '/home'::text                       as link
  from public.chores c
  where c.deleted_at is null
    and c.next_due is not null;

-- Meals: one entry per planned meal-plan slot (all-day). Title carries the slot.
create view public.v_calendar_meals
  with (security_invoker = on) as
  select
    m.household_id,
    'meals'::text                       as source,
    m.id                                as source_id,
    initcap(m.slot) || ': '
      || coalesce(r.name, m.free_text, 'Planned meal') as title,
    m.date::timestamptz                 as "start",
    m.date::timestamptz                 as "end",
    true                                as all_day,
    'meals'::text                       as category,
    '/food'::text                       as link
  from public.meal_plan m
  left join public.recipes r on r.id = m.recipe_id
  where m.deleted_at is null;

-- Trips: a multi-day all-day span from start_date to end_date. We surface trips
-- that are planning / booked / completed (i.e. real, dated trips — not loose ideas).
-- iCal DTEND is exclusive for all-day events, so add a day to end_date.
create view public.v_calendar_trips
  with (security_invoker = on) as
  select
    t.household_id,
    'trips'::text                       as source,
    t.id                                as source_id,
    t.name                              as title,
    t.start_date::timestamptz           as "start",
    ((coalesce(t.end_date, t.start_date) + 1))::timestamptz as "end",
    true                                as all_day,
    'trips'::text                       as category,
    ('/travel/' || t.id::text)::text    as link
  from public.trips t
  where t.deleted_at is null
    and t.start_date is not null
    and t.status in ('planning', 'booked', 'completed');

-- Birthdays: derived from contacts.dob. The next birthday on/after today (so the
-- calendar always shows the upcoming one). All-day, category 'birthdays'.
create view public.v_calendar_birthdays
  with (security_invoker = on) as
  select
    ct.household_id,
    'birthdays'::text                   as source,
    ct.id                               as source_id,
    ct.name || '''s birthday'          as title,
    next_bday::timestamptz              as "start",
    next_bday::timestamptz              as "end",
    true                                as all_day,
    'birthdays'::text                   as category,
    '/calendar/birthdays'::text         as link
  from public.contacts ct
  cross join lateral (
    -- This year's birthday; if it has already passed, next year's.
    select case
      when (make_date(
              extract(year from current_date)::int,
              extract(month from ct.dob)::int,
              extract(day from ct.dob)::int)) >= current_date
      then make_date(
             extract(year from current_date)::int,
             extract(month from ct.dob)::int,
             extract(day from ct.dob)::int)
      else make_date(
             extract(year from current_date)::int + 1,
             extract(month from ct.dob)::int,
             extract(day from ct.dob)::int)
    end as next_bday
  ) b
  where ct.deleted_at is null
    and ct.dob is not null;

-- Maintenance reminders: due on next_due (all-day). Category 'maintenance'.
create view public.v_calendar_maintenance
  with (security_invoker = on) as
  select
    mr.household_id,
    'maintenance'::text                 as source,
    mr.id                               as source_id,
    mr.item                             as title,
    mr.next_due::timestamptz            as "start",
    mr.next_due::timestamptz            as "end",
    true                                as all_day,
    'maintenance'::text                 as category,
    '/home'::text                       as link
  from public.maintenance_reminders mr
  where mr.deleted_at is null
    and mr.next_due is not null;

-- v_calendar_all: every source UNIONed with the manual calendar_events.
create view public.v_calendar_all
  with (security_invoker = on) as
  select household_id, source, source_id, title, "start", "end", all_day, category, link
    from public.v_calendar_bills
  union all
  select household_id, source, source_id, title, "start", "end", all_day, category, link
    from public.v_calendar_chores
  union all
  select household_id, source, source_id, title, "start", "end", all_day, category, link
    from public.v_calendar_meals
  union all
  select household_id, source, source_id, title, "start", "end", all_day, category, link
    from public.v_calendar_trips
  union all
  select household_id, source, source_id, title, "start", "end", all_day, category, link
    from public.v_calendar_birthdays
  union all
  select household_id, source, source_id, title, "start", "end", all_day, category, link
    from public.v_calendar_maintenance
  union all
  select
    e.household_id,
    'manual'::text                      as source,
    e.id                                as source_id,
    e.title,
    e."start",
    coalesce(e."end", e."start")        as "end",
    e.all_day,
    'manual'::text                      as category,
    ('/calendar?event=' || e.id::text)::text as link
  from public.calendar_events e
  where e.deleted_at is null;
