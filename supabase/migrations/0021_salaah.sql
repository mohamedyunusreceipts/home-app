-- Salaah (Islamic prayer times) module.
--
-- One settings row per household (PK = household_id) holding the chosen
-- location, calculation method, madhab, and push preferences. A notify-log
-- table records which (household, date, prayer) pushes have already fired so
-- the per-minute cron can dedupe sends idempotently.
--
-- RLS uses the same tenant-isolation template as the foundation tables
-- (see 0004_foundation_rls.sql) — `current_user_household_ids()` scopes every
-- row to the caller's household. The cron writes via a service-role client,
-- which bypasses RLS.

-- salaah_settings: per-household configuration (one row, keyed by household).
create table public.salaah_settings (
  household_id uuid primary key references public.households(id) on delete cascade,
  latitude double precision,
  longitude double precision,
  location_name text,
  timezone text,
  method text not null default 'MuslimWorldLeague',
  madhab text not null default 'shafi',
  push_enabled boolean not null default false,
  prayers jsonb not null default
    '{"fajr":true,"dhuhr":true,"asr":true,"maghrib":true,"isha":true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- salaah_notify_log: one row per push actually sent, used by the cron to dedupe.
-- The unique constraint makes concurrent cron runs safe (insert-on-conflict).
create table public.salaah_notify_log (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.households(id) on delete cascade,
  prayer_date date,
  prayer text,
  sent_at timestamptz default now(),
  unique (household_id, prayer_date, prayer)
);

create index salaah_notify_log_household_idx on public.salaah_notify_log(household_id);

-- ── RLS: tenant isolation (mirrors 0004_foundation_rls.sql) ──
alter table public.salaah_settings   enable row level security;
alter table public.salaah_notify_log enable row level security;

create policy salaah_settings_tenant_isolation on public.salaah_settings
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy salaah_notify_log_tenant_isolation on public.salaah_notify_log
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
