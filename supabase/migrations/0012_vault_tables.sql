-- Vault module: Documents & Important Info (spec §9.7).
-- Six tables: documents, emergency_contacts, vehicles, vehicle_docs, warranties,
-- gift_ideas. All carry household_id, standard timestamps, and soft-delete
-- (deleted_at) as user-content tables. RLS uses the same tenant-isolation
-- template as the foundation tables (see 0004_foundation_rls.sql) — except
-- gift_ideas, which adds the recipient-hiding clause from spec §9.7.

-- documents: anything filed in the vault that references a Drive binary
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  kind text not null,                      -- e.g. 'id', 'passport', 'contract', 'other'
  drive_file_id text,                      -- null until the binary is uploaded to Drive
  expiry_date date,
  notes text,
  uploaded_by_user_id uuid references public.profiles(id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index documents_household_idx on public.documents(household_id);
create index documents_expiry_idx on public.documents(expiry_date) where deleted_at is null;

-- emergency_contacts: people to call in an emergency (medical flag for triage)
create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  relationship text,
  phone text,
  email text,
  notes text,
  is_medical boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index emergency_contacts_household_idx on public.emergency_contacts(household_id);

-- vehicles: cars (and their renewal/expiry dates)
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  label text not null,
  make text,
  model text,
  year int,
  plate text,
  vin text,
  insurance_expiry date,
  license_expiry date,
  service_due_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index vehicles_household_idx on public.vehicles(household_id);

-- vehicle_docs: documents attached to a vehicle (insurance cert, licence disc, etc.)
create table public.vehicle_docs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  kind text not null,                      -- e.g. 'insurance', 'license', 'service', 'other'
  drive_file_id text,
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index vehicle_docs_vehicle_idx on public.vehicle_docs(vehicle_id);
create index vehicle_docs_expiry_idx on public.vehicle_docs(expiry_date) where deleted_at is null;

-- warranties: purchase warranties with expiry tracking
create table public.warranties (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  item text not null,
  purchase_date date,
  expiry_date date,
  retailer text,
  drive_file_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index warranties_household_idx on public.warranties(household_id);
create index warranties_expiry_idx on public.warranties(expiry_date) where deleted_at is null;

-- gift_ideas: presents for a partner or a contact.
-- for_user_id / for_contact_id are the recipient; claimed_by_user_id marks who is
-- buying it. The recipient must NOT see ideas targeted at them (see RLS below).
create table public.gift_ideas (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  for_user_id uuid references public.profiles(id) on delete set null,
  for_contact_id uuid,                     -- soft ref to a future contacts table; no FK in v1
  idea text not null,
  url text,
  price_estimate numeric(14,2),
  occasion text,
  claimed_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index gift_ideas_household_idx on public.gift_ideas(household_id);

-- ── RLS: tenant isolation (mirrors 0004_foundation_rls.sql / 0009_mortgage_tables.sql) ──
alter table public.documents          enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.vehicles           enable row level security;
alter table public.vehicle_docs       enable row level security;
alter table public.warranties         enable row level security;
alter table public.gift_ideas         enable row level security;

create policy documents_tenant_isolation on public.documents
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy emergency_contacts_tenant_isolation on public.emergency_contacts
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy vehicles_tenant_isolation on public.vehicles
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy vehicle_docs_tenant_isolation on public.vehicle_docs
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy warranties_tenant_isolation on public.warranties
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

-- gift_ideas: tenant isolation PLUS the recipient-hiding rule (spec §9.7).
-- A recipient must not be able to SEE gifts targeted at them, so the USING clause
-- (which gates reads/updates/deletes) excludes rows where they are for_user_id.
-- WITH CHECK keeps plain tenant isolation so a member can still INSERT a gift for
-- their partner (and that partner simply won't be able to read it back).
create policy gift_ideas_tenant_isolation on public.gift_ideas
  for all
  using (
    household_id in (select public.current_user_household_ids())
    and (for_user_id is null or for_user_id <> (select auth.uid()))
  )
  with check (household_id in (select public.current_user_household_ids()));
