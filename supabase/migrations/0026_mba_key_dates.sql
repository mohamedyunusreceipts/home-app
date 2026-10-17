-- MBA programme key dates: teaching blocks (in person / hybrid), online
-- teaching periods, term breaks, optional weeks and milestones — with the
-- leave days each block needs, for planning time off work.
--
-- PER-USER, written by scripts/mba/sync.mjs (service role) from the private
-- schedule config; RLS user_id = auth.uid(), like the rest of 0025_mba.

create table public.mba_key_dates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Stable slug from the config, so re-syncs update in place.
  external_uid text not null,
  title text not null,
  kind text not null
    check (kind in ('in_person', 'hybrid', 'online', 'break', 'optional', 'milestone')),
  start_date date not null,
  end_date date,                    -- null = single day
  leave_days numeric(4, 1),         -- days of leave the block needs, if any
  programme_year int,               -- 1, 2, … (for per-year leave totals)
  notes text,
  updated_at timestamptz not null default now(),
  unique (user_id, external_uid)
);

create index mba_key_dates_user_start_idx on public.mba_key_dates(user_id, start_date);

alter table public.mba_key_dates enable row level security;

create policy mba_key_dates_own_row on public.mba_key_dates
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
