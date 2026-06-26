-- Drive folder-id cache (spec §5.4). Maps a canonical Drive path
-- (e.g. /HomeApp/Money/Receipts) to the household owner's Google Drive folder id,
-- so the adapter avoids repeated Drive lookups. RLS uses the same tenant-isolation
-- template as the foundation tables (see 0004_foundation_rls.sql).

create table public.drive_folders (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  path text not null,
  drive_folder_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, path)
);

create index drive_folders_household_idx on public.drive_folders(household_id);

-- Enable RLS and apply the tenant-isolation template (mirrors 0004 / 0009).
alter table public.drive_folders enable row level security;

create policy drive_folders_tenant_isolation on public.drive_folders
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
