-- Qur'an learning module (Phase Q1).
--
-- PER-USER data (NOT household-scoped): each row belongs to a single user and
-- is gated on user_id = auth.uid(), mirroring wardrobe_preferences /
-- push_subscriptions (see 0016_wardrobe_tables.sql). A couple sharing a
-- household still track their own Qur'an progress and memorisation
-- independently.
--
--   quran_progress: one row per user — which lessons they've completed and the
--                   ladder level they're on.
--   quran_hifz:     one row per (user, surah) — memorisation status + last
--                   revision date, for the ḥifẓ tracker.

-- quran_progress: per-user learning state. PK = user_id (one row per user).
create table public.quran_progress (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  completed_lessons text[] not null default '{}',
  current_level int not null default 5,
  updated_at timestamptz not null default now()
);

-- quran_hifz: per-user, per-surah memorisation record.
create table public.quran_hifz (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  surah_number int not null,
  status text not null default 'learning' check (status in ('learning', 'memorised')),
  last_revised_on date,
  updated_at timestamptz not null default now(),
  unique (user_id, surah_number)
);

create index quran_hifz_user_idx on public.quran_hifz(user_id);

-- ── RLS: strictly per-user own-row (neither table has a household_id) ──────────
alter table public.quran_progress enable row level security;
alter table public.quran_hifz     enable row level security;

create policy quran_progress_own_row on public.quran_progress
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy quran_hifz_own_row on public.quran_hifz
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
