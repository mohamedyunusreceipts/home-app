-- South African access-bond (mortgage) tracker tables.
-- One bond per household in v1. RLS uses the same tenant-isolation template as
-- the foundation tables (see 0004_foundation_rls.sql).

-- mortgages: the bond itself, one per household
create table public.mortgages (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  lender text not null,
  account_ref text,
  original_principal numeric(14,2) not null,
  start_date date not null,
  term_months int not null,
  contractual_instalment numeric(14,2) not null,
  current_annual_rate numeric(6,3) not null,
  rate_is_prime_linked boolean not null default true,
  prime_delta numeric(5,3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One bond per household in v1.
create unique index mortgages_one_per_household on public.mortgages(household_id);

-- mortgage_statements: monthly statement snapshots
create table public.mortgage_statements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  mortgage_id uuid not null references public.mortgages(id) on delete cascade,
  statement_month date not null, -- caller normalises to the 1st
  closing_balance numeric(14,2) not null,
  interest_charged numeric(14,2) not null,
  annual_rate numeric(6,3) not null,
  total_paid numeric(14,2),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mortgage_id, statement_month)
);

create index mortgage_statements_mortgage_idx on public.mortgage_statements(mortgage_id);

-- mortgage_transactions: extra deposits / withdrawals against the access facility
create table public.mortgage_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  mortgage_id uuid not null references public.mortgages(id) on delete cascade,
  occurred_on date not null,
  amount numeric(14,2) not null,
  kind text not null check (kind in ('extra_deposit', 'withdrawal')),
  contributed_by_user_id uuid references public.profiles(id), -- null = joint
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mortgage_transactions_mortgage_idx on public.mortgage_transactions(mortgage_id);

-- Enable RLS and apply the tenant-isolation template (mirrors 0004_foundation_rls.sql).
alter table public.mortgages              enable row level security;
alter table public.mortgage_statements    enable row level security;
alter table public.mortgage_transactions  enable row level security;

create policy mortgages_tenant_isolation on public.mortgages
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy mortgage_statements_tenant_isolation on public.mortgage_statements
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy mortgage_transactions_tenant_isolation on public.mortgage_transactions
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
