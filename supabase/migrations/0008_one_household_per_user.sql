-- Enforce the v1 invariant "a user belongs to at most one household" at the DB
-- layer. The application checks this with a count() in create_household /
-- accept_invite, but a concurrent double-submit can pass both checks before
-- either insert lands. A unique index on user_id is the real serialization point
-- and hardens both RPCs against that race.
create unique index if not exists household_members_one_per_user
  on public.household_members (user_id);
