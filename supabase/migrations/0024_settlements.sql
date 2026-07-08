-- Settlements & payment plans (repayment + settle-up on top of split expenses).
--
-- The "who owes who" balance is still derived live from expenses + expense_splits
-- (see components/money/balance.ts) and never stored. This migration adds the two
-- pieces of state that DO need persisting:
--
--   * settlements       — an immutable log of repayments one member makes to the
--                         other against the running balance.
--   * settlement_plans  — an installment plan (recurrence + amount + next-due)
--                         that drives reminder pushes to the ower via the cron.
--
-- Both carry household_id and use the same tenant-isolation RLS template as the
-- foundation tables (0004_foundation_rls.sql) and the money tables (0014).

-- settlements: a single repayment from the ower to the person owed.
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id), -- the ower / payer
  to_user_id uuid not null references public.profiles(id),   -- the person owed
  amount numeric(12,2) not null check (amount > 0),
  note text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index settlements_household_idx on public.settlements(household_id);

-- settlement_plans: an installment plan for the ower to repay in fixed chunks.
-- One active plan per direction is the intended shape, but we don't hard-constrain
-- it (a household can cancel + recreate freely; the cron only acts on active rows).
create table public.settlement_plans (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id), -- the ower
  to_user_id uuid not null references public.profiles(id),   -- the person owed
  installment_amount numeric(12,2) not null check (installment_amount > 0),
  recurrence_rrule text not null,
  next_due date not null,
  last_reminded_on date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index settlement_plans_household_idx on public.settlement_plans(household_id);
create index settlement_plans_active_due_idx
  on public.settlement_plans(next_due)
  where active;

-- Enable RLS + apply the tenant-isolation template (mirrors 0004 / 0014). Both
-- household partners can see and write the household's settlements + plans.
alter table public.settlements       enable row level security;
alter table public.settlement_plans  enable row level security;

create policy settlements_tenant_isolation on public.settlements
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy settlement_plans_tenant_isolation on public.settlement_plans
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
