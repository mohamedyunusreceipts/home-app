-- leave_household(): let the caller leave their household, cleaning up behind them.
--
-- SECURITY DEFINER (bypasses RLS for the deletes/updates) but strictly scoped to
-- the caller via auth.uid(). Companion to create_household / accept_invite.
--
-- Behaviour:
--   * No household        → no-op (safe to call).
--   * Members remain      → delete the caller's membership row. If the caller was
--                           the owner, transfer ownership to a remaining member
--                           (households.owner_user_id + that member's role='owner').
--   * Caller was the last → delete the household itself; every table that
--                           references households(id) is ON DELETE CASCADE, so all
--                           of the household's shared data goes with it.

create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_was_owner boolean;
  v_remaining_count int;
  v_next_owner uuid;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  -- Find the caller's household (at most one in v1).
  select household_id, role = 'owner'
    into v_household_id, v_was_owner
    from public.household_members
    where user_id = v_user_id
    limit 1;

  -- Not in any household: nothing to do.
  if v_household_id is null then
    return;
  end if;

  -- Remove the caller's membership.
  delete from public.household_members
    where household_id = v_household_id
      and user_id = v_user_id;

  -- How many members are left?
  select count(*) into v_remaining_count
    from public.household_members
    where household_id = v_household_id;

  if v_remaining_count = 0 then
    -- Caller was the last member: delete the household and cascade its data.
    delete from public.households where id = v_household_id;
    return;
  end if;

  -- Members remain. If the caller owned the household, hand ownership to one of them.
  if v_was_owner then
    select user_id into v_next_owner
      from public.household_members
      where household_id = v_household_id
      order by joined_at
      limit 1;

    update public.households
      set owner_user_id = v_next_owner
      where id = v_household_id;

    update public.household_members
      set role = 'owner'
      where household_id = v_household_id
        and user_id = v_next_owner;
  end if;

  return;
end;
$$;

revoke all on function public.leave_household() from public;
grant execute on function public.leave_household() to authenticated;
