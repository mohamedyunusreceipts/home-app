-- Money module tables (design spec §9.1).
-- Six user-content tables: expenses, expense_splits, bills, subscriptions,
-- budgets, savings_goals. All carry household_id and the standard timestamps;
-- user-content rows are soft-deleted via deleted_at. RLS uses the same
-- tenant-isolation template as the foundation tables (see 0004_foundation_rls.sql)
-- and the mortgage tables (see 0009_mortgage_tables.sql).
--
-- Categories: spec §9.1 calls for a seeded, household-editable list (Groceries,
-- Dining, Transport, Utilities, Rent, Entertainment, Personal, Other). We keep
-- v1 pragmatic and store category as free text on each row, with the seeded list
-- living in code (components/money/categories.ts) — no categories table. The text
-- column accepts any value, so a household can already record bespoke categories;
-- a dedicated table can be layered in later without touching these rows.

-- expenses: a single spend event, attributed to a payer and split between members.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  amount numeric(14,2) not null check (amount >= 0),
  category text not null,
  paid_by_user_id uuid not null references public.profiles(id),
  split_type text not null
    check (split_type in ('equal', 'me_only', 'partner_only', 'custom_amount')),
  description text,
  receipt_drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index expenses_household_idx on public.expenses(household_id);
create index expenses_date_idx on public.expenses(household_id, date);

-- expense_splits: per-member share of an expense. Carries household_id too so the
-- same tenant-isolation policy applies directly (spec note: RLS consistency).
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  expense_id uuid not null references public.expenses(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  share_amount numeric(14,2) not null check (share_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expense_splits_expense_idx on public.expense_splits(expense_id);
create index expense_splits_household_idx on public.expense_splits(household_id);

-- bills: recurring obligations (rent, utilities…). next_due is the upcoming date,
-- recurrence stored as an RFC 5545 RRULE string (lib/rrule).
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  recurrence_rrule text,
  next_due date,
  category text,
  auto_pay boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index bills_household_idx on public.bills(household_id);

-- subscriptions: recurring paid services. next_charge is the upcoming charge date.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  amount numeric(14,2) not null check (amount >= 0),
  recurrence_rrule text,
  next_charge date,
  category text,
  cancel_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index subscriptions_household_idx on public.subscriptions(household_id);

-- budgets: a per-month, per-category spending limit. month stored as the 1st of
-- the month (a date) for a stable unique key; the UI works in 'YYYY-MM'.
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  month date not null, -- normalised to the 1st of the month
  category text not null,
  limit_amount numeric(14,2) not null check (limit_amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (household_id, month, category)
);

create index budgets_household_month_idx on public.budgets(household_id, month);

-- savings_goals: a named target with running progress and optional deadline.
create table public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  target numeric(14,2) not null check (target >= 0),
  current numeric(14,2) not null default 0 check (current >= 0),
  deadline date,
  drive_image_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index savings_goals_household_idx on public.savings_goals(household_id);

-- Enable RLS and apply the tenant-isolation template (mirrors 0004/0009).
alter table public.expenses        enable row level security;
alter table public.expense_splits  enable row level security;
alter table public.bills           enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.budgets         enable row level security;
alter table public.savings_goals   enable row level security;

create policy expenses_tenant_isolation on public.expenses
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy expense_splits_tenant_isolation on public.expense_splits
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy bills_tenant_isolation on public.bills
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy subscriptions_tenant_isolation on public.subscriptions
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy budgets_tenant_isolation on public.budgets
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy savings_goals_tenant_isolation on public.savings_goals
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
