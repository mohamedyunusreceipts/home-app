-- Travel & Packing module tables (spec §9.5).
-- Trips and their children: itinerary, expenses, packing lists/items, documents,
-- notes, and outfit plans. All carry household_id, standard timestamps, and a
-- soft-delete (deleted_at) as user-content tables. RLS uses the same
-- tenant-isolation template as the foundation tables (see 0004_foundation_rls.sql)
-- — `current_user_household_ids()` scopes every row to the caller's household.
--
-- FK order: trips first (the root), then every child that references trips(id);
-- packing_items references packing_lists, so packing_lists is declared first.
-- trip_outfits stores wardrobe item ids as a uuid[] with NO foreign key — the
-- wardrobe lives in another module (spec §9.6) and is referenced by id only.

-- trips: the trip itself.
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  destination text,
  start_date date,
  end_date date,
  status text not null default 'idea'
    check (status in ('idea', 'planning', 'booked', 'completed')),
  budget_total numeric(14,2),
  cover_image_drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index trips_household_idx on public.trips(household_id);
-- Supports the dashboard countdown query: next trip with start in the future.
create index trips_start_idx on public.trips(start_date) where deleted_at is null;

-- trip_itinerary_items: a planned activity on a given day of a trip.
create table public.trip_itinerary_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  time time,
  title text not null,
  location text,
  notes text,
  attachment_drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index trip_itinerary_items_trip_idx on public.trip_itinerary_items(trip_id);

-- trip_expenses: money spent on a trip; may optionally also count toward the
-- household's monthly budget (cross-module reporting concern, flag only here).
create table public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  date date not null,
  amount numeric(14,2) not null,
  category text,
  description text,
  also_count_in_monthly_budget boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index trip_expenses_trip_idx on public.trip_expenses(trip_id);

-- packing_lists: a named packing list belonging to a trip.
-- Declared before packing_items because the latter has an FK to it.
create table public.packing_lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index packing_lists_trip_idx on public.packing_lists(trip_id);

-- packing_items: a single item on a packing list, optionally packed by a member.
create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  list_id uuid not null references public.packing_lists(id) on delete cascade,
  name text not null,
  packed_by_user_id uuid references public.profiles(id) on delete set null,
  packed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index packing_items_list_idx on public.packing_items(list_id);

-- trip_docs: a travel document (passport, visa, ticket, …) stored in Drive.
create table public.trip_docs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  kind text not null
    check (kind in ('passport', 'visa', 'ticket', 'booking', 'insurance', 'other')),
  drive_file_id text,                       -- null until the binary is uploaded to Drive
  expiry_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index trip_docs_trip_idx on public.trip_docs(trip_id);
create index trip_docs_expiry_idx on public.trip_docs(expiry_date) where deleted_at is null;

-- trip_notes: free-form markdown notes for a trip.
create table public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  body_md text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index trip_notes_trip_idx on public.trip_notes(trip_id);

-- trip_outfits: an outfit plan for a trip day. wardrobe_item_ids is a uuid[] that
-- references the wardrobe module by id ONLY — there is deliberately NO foreign key,
-- because the wardrobe lives in another module (spec §9.6).
create table public.trip_outfits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  day date not null,
  wardrobe_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index trip_outfits_trip_idx on public.trip_outfits(trip_id);

-- ── RLS: tenant isolation (mirrors 0004_foundation_rls.sql / 0009_mortgage_tables.sql) ──
alter table public.trips                enable row level security;
alter table public.trip_itinerary_items enable row level security;
alter table public.trip_expenses        enable row level security;
alter table public.packing_lists        enable row level security;
alter table public.packing_items        enable row level security;
alter table public.trip_docs            enable row level security;
alter table public.trip_notes           enable row level security;
alter table public.trip_outfits         enable row level security;

create policy trips_tenant_isolation on public.trips
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy trip_itinerary_items_tenant_isolation on public.trip_itinerary_items
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy trip_expenses_tenant_isolation on public.trip_expenses
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy packing_lists_tenant_isolation on public.packing_lists
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy packing_items_tenant_isolation on public.packing_items
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy trip_docs_tenant_isolation on public.trip_docs
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy trip_notes_tenant_isolation on public.trip_notes
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy trip_outfits_tenant_isolation on public.trip_outfits
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
