-- Cross-cutting infrastructure tables: in-app notifications, push subscriptions,
-- and per-household AI usage counters. RLS scopes notifications/subscriptions to
-- the owning user; ai_usage to the household (standard tenant isolation).

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
-- A user sees and mutates only their own notifications.
create policy notifications_own on public.notifications
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_own on public.push_subscriptions
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create table public.ai_usage (
  household_id uuid not null references public.households(id) on delete cascade,
  month text not null,            -- 'YYYY-MM' in Africa/Johannesburg
  calls int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (household_id, month)
);

alter table public.ai_usage enable row level security;
create policy ai_usage_tenant on public.ai_usage
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
