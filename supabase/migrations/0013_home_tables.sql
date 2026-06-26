-- Home Management module tables (design spec §9.3).
-- Chores · Cleaning schedule · Maintenance reminders · Home projects ·
-- Shared lists · Shopping links.
--
-- All tables carry household_id, standard timestamps, and a soft-delete
-- (deleted_at) since every table here holds user content. RLS uses the same
-- tenant-isolation template as the foundation / mortgage tables (see
-- 0004_foundation_rls.sql and 0009_mortgage_tables.sql).
--
-- Recurrence is stored as an RFC 5545 RRULE string in recurrence_rrule; next-due
-- math is computed in the app via lib/rrule.

-- chores: recurring chores, optionally assigned to a household member
create table public.chores (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  assignee_user_id uuid references public.profiles(id) on delete set null,
  recurrence_rrule text,
  next_due date,
  last_done_at timestamptz,
  last_done_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index chores_household_idx on public.chores(household_id);

-- cleaning_tasks: same shape as chores, kept as a distinct table by design so
-- the Chores tab and Cleaning Schedule tab query independently (spec §9.3).
create table public.cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  assignee_user_id uuid references public.profiles(id) on delete set null,
  recurrence_rrule text,
  next_due date,
  last_done_at timestamptz,
  last_done_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index cleaning_tasks_household_idx on public.cleaning_tasks(household_id);

-- maintenance_reminders: recurring home-maintenance items (e.g. service the geyser)
create table public.maintenance_reminders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item text not null,
  next_due date,
  recurrence_rrule text,
  notes text,
  attachment_drive_file_id text,
  last_done_at timestamptz,
  last_done_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index maintenance_reminders_household_idx on public.maintenance_reminders(household_id);

-- home_projects: longer-running projects with a status, budget and photos
create table public.home_projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  status text not null default 'idea' check (status in ('idea', 'planning', 'in_progress', 'done')),
  budget numeric(14,2),
  notes_md text,
  photo_drive_file_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index home_projects_household_idx on public.home_projects(household_id);

-- shared_lists: freeform checklists; items is a jsonb array of {text, checked}
create table public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shared_lists_household_idx on public.shared_lists(household_id);

-- shopping_links: saved links to things to buy, grouped by category
create table public.shopping_links (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  url text not null,
  category text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index shopping_links_household_idx on public.shopping_links(household_id);

-- Enable RLS and apply the tenant-isolation template (mirrors 0004 / 0009).
alter table public.chores                 enable row level security;
alter table public.cleaning_tasks         enable row level security;
alter table public.maintenance_reminders  enable row level security;
alter table public.home_projects          enable row level security;
alter table public.shared_lists           enable row level security;
alter table public.shopping_links         enable row level security;

create policy chores_tenant_isolation on public.chores
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy cleaning_tasks_tenant_isolation on public.cleaning_tasks
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy maintenance_reminders_tenant_isolation on public.maintenance_reminders
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy home_projects_tenant_isolation on public.home_projects
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy shared_lists_tenant_isolation on public.shared_lists
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy shopping_links_tenant_isolation on public.shopping_links
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
