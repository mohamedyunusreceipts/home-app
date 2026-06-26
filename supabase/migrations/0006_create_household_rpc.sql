-- Atomic household-creation RPC. Bypasses RLS for the inserts (SECURITY DEFINER)
-- but is scoped to the calling user via auth.uid().

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_existing_count int;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'household name must be non-empty'
      using errcode = 'invalid_parameter_value';
  end if;

  -- A user can be a member of at most one household in v1.
  select count(*) into v_existing_count
    from public.household_members
    where user_id = v_user_id;

  if v_existing_count > 0 then
    raise exception 'user is already a member of a household'
      using errcode = 'unique_violation';
  end if;

  insert into public.households (name, owner_user_id)
    values (btrim(p_name), v_user_id)
    returning id into v_household_id;

  insert into public.household_members (household_id, user_id, role)
    values (v_household_id, v_user_id, 'owner');

  return v_household_id;
end;
$$;

revoke all on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated;
