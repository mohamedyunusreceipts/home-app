-- Enable RLS and apply the tenant-isolation template to all foundation tables.

alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.invites             enable row level security;
alter table public.profiles            enable row level security;

-- Helper: returns the household IDs the calling user is a member of.
-- SECURITY DEFINER + `set search_path` bypasses RLS for the lookup, breaking
-- the recursion that would happen if RLS policies subqueried household_members directly.
create or replace function public.current_user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
    from public.household_members
    where user_id = auth.uid();
$$;

revoke all on function public.current_user_household_ids() from public;
grant execute on function public.current_user_household_ids() to authenticated;

-- Helper: returns the user IDs of all members of the caller's households (incl. self).
create or replace function public.current_user_co_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id
    from public.household_members
    where household_id in (select public.current_user_household_ids());
$$;

revoke all on function public.current_user_co_member_ids() from public;
grant execute on function public.current_user_co_member_ids() to authenticated;

-- profiles: users see profiles of co-members in their households (incl. themselves)
create policy profiles_household_visible on public.profiles
  for select
  using (id in (select public.current_user_co_member_ids()));

create policy profiles_self_update on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- households: visible to members; INSERT performed by service role during onboarding
create policy households_member_visible on public.households
  for select
  using (id in (select public.current_user_household_ids()));

create policy households_owner_update on public.households
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- household_members: visible to members of the same household
create policy household_members_visible on public.household_members
  for select
  using (household_id in (select public.current_user_household_ids()));

-- invites: visible to members; INSERT by members of the household
create policy invites_member_visible on public.invites
  for select
  using (household_id in (select public.current_user_household_ids()));

create policy invites_member_insert on public.invites
  for insert
  with check (
    household_id in (select public.current_user_household_ids())
    and created_by = auth.uid()
  );

create policy invites_member_update on public.invites
  for update
  using (household_id in (select public.current_user_household_ids()));
