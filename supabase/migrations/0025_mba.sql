-- MBA tracker: courses, lecture sessions (with pre-reading + summaries),
-- deadlines (assignments / exams / quizzes), calendar-feed subscriptions
-- (LMS + mailbox calendar) and the meetings/events those feeds contain.
--
-- PER-USER data (NOT household-scoped), gated on user_id = auth.uid() exactly
-- like quran_* (0022). Rows are written by:
--   * scripts/mba/sync.mjs (service role) — schedule, readings, summaries;
--   * the calendar-feed sync (lib/mba/sync-calendar.ts) — feeds → deadlines/events;
--   * the user in-app — prepared / done / notebook link / notes.
-- Sync upserts only ever send schedule columns, so user-edited columns are
-- never clobbered on conflict.

-- Private ICS subscription links. Each URL embeds a personal token, so a row is
-- only ever readable by its owner. One feed per kind keeps the UI simple.
create table public.mba_calendar_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- 'lms' = course site calendar (deliverables), 'mail' = mailbox calendar
  -- (meetings, lecture invites).
  kind text not null check (kind in ('lms', 'mail')),
  url text not null,
  last_synced_at timestamptz,
  last_sync_error text,
  last_sync_count int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

create table public.mba_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  code text not null,
  name text not null,
  convenor text,
  color text not null default '#7A9B7A',
  -- Extra strings that identify this course in LMS event text.
  aliases text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, code)
);

create table public.mba_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_code text not null,
  -- Timetable label within the course, e.g. '8' or '5-6' or '9.1'.
  session_key text not null,
  sort_order int not null default 0,
  title text not null,
  starts_at timestamptz,            -- null = date not yet published
  ends_at timestamptz,
  mode text check (mode in ('in_person', 'online')),
  -- [{ "title": string, "kind": "reading" | "slides" | "book" }]
  readings jsonb not null default '[]'::jsonb,
  summary text,                     -- lightweight markdown
  summary_source text check (summary_source in ('doc', 'ai')),
  -- User-owned columns (never sent by sync).
  notebook_url text,
  notes text,
  prepared boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, course_code, session_key)
);

create index mba_sessions_user_starts_idx on public.mba_sessions(user_id, starts_at);

create table public.mba_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_code text,                 -- null = couldn't be matched to a course
  title text not null,
  kind text not null default 'other'
    check (kind in ('assignment', 'exam', 'quiz', 'presentation', 'other')),
  due_at timestamptz not null,
  all_day boolean not null default false,
  weight text,
  details text,
  source text not null check (source in ('schedule', 'lms', 'manual')),
  -- Stable key within a source (iCal UID for 'lms', a slug for 'schedule').
  external_uid text not null,
  -- The feed an 'lms' row came from; disconnecting the feed removes its rows.
  feed_id uuid references public.mba_calendar_feeds(id) on delete cascade,
  -- User-owned column (never sent by sync).
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_uid)
);

create index mba_deadlines_user_due_idx on public.mba_deadlines(user_id, due_at);

-- Non-deliverable calendar entries from the feeds: team meetings, lecture
-- invites (often carrying the online join link), events. Recurring meetings are
-- stored expanded, one row per occurrence.
create table public.mba_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feed_id uuid not null references public.mba_calendar_feeds(id) on delete cascade,
  -- iCal UID, suffixed with the occurrence start for recurring instances.
  external_uid text not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  location text,
  details text,
  join_url text,
  course_code text,
  updated_at timestamptz not null default now(),
  unique (feed_id, external_uid)
);

create index mba_events_user_starts_idx on public.mba_events(user_id, starts_at);

-- ── RLS: strictly per-user own-row ─────────────────────────────────────────────
alter table public.mba_calendar_feeds enable row level security;
alter table public.mba_courses        enable row level security;
alter table public.mba_sessions       enable row level security;
alter table public.mba_deadlines      enable row level security;
alter table public.mba_events         enable row level security;

create policy mba_calendar_feeds_own_row on public.mba_calendar_feeds
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy mba_courses_own_row on public.mba_courses
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy mba_sessions_own_row on public.mba_sessions
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy mba_deadlines_own_row on public.mba_deadlines
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy mba_events_own_row on public.mba_events
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
