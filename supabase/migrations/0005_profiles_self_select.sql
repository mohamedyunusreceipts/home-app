-- Allow a user to read their own profile even before they belong to any household.
-- The existing profiles_household_visible policy covers the post-membership case;
-- this one covers the just-signed-up / pre-onboarding case. RLS policies are
-- combined with OR, so both apply.
create policy profiles_self_select on public.profiles
  for select
  using (id = auth.uid());
