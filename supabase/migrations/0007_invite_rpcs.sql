-- Invite generation and acceptance RPCs.
-- Both are SECURITY DEFINER and use auth.uid() to scope to the caller.

-- Generate (or replace) the active invite for the caller's household.
-- Returns the token. At most one active invite per household at any time.
create or replace function public.generate_invite()
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_token text;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  select household_id into v_household_id
    from public.household_members
    where user_id = v_user_id
    limit 1;

  if v_household_id is null then
    raise exception 'caller is not a member of any household'
      using errcode = 'insufficient_privilege';
  end if;

  -- Clear any prior unused invites for this household (at most one active at a time).
  delete from public.invites
    where household_id = v_household_id
      and used_at is null;

  -- Generate a URL-safe random token (24 bytes → 32 chars base64url, ~192 bits entropy).
  v_token := translate(encode(gen_random_bytes(24), 'base64'), '+/=', '-_');

  insert into public.invites (token, household_id, created_by, expires_at)
    values (v_token, v_household_id, v_user_id, now() + interval '24 hours');

  return v_token;
end;
$$;

revoke all on function public.generate_invite() from public;
grant execute on function public.generate_invite() to authenticated;

-- Accept an invite. Validates the token; if everything checks out, adds caller as
-- partner and marks invite used. Returns the household_id.
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite record;
  v_member_count int;
  v_existing_count int;
begin
  if v_user_id is null then
    raise exception 'authentication required'
      using errcode = 'insufficient_privilege';
  end if;

  if p_token is null or p_token = '' then
    raise exception 'invalid invite token'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into v_invite
    from public.invites
    where token = p_token
    for update;

  if v_invite is null then
    raise exception 'invalid invite token'
      using errcode = 'no_data_found';
  end if;

  if v_invite.used_at is not null then
    raise exception 'invite has already been used'
      using errcode = 'invalid_parameter_value';
  end if;

  if v_invite.expires_at < now() then
    raise exception 'invite has expired'
      using errcode = 'invalid_parameter_value';
  end if;

  -- Caller must not already be in any household.
  select count(*) into v_existing_count
    from public.household_members
    where user_id = v_user_id;

  if v_existing_count > 0 then
    raise exception 'user is already a member of a household'
      using errcode = 'unique_violation';
  end if;

  -- Household must still have a partner slot open.
  select count(*) into v_member_count
    from public.household_members
    where household_id = v_invite.household_id;

  if v_member_count >= 2 then
    raise exception 'household is already full'
      using errcode = 'unique_violation';
  end if;

  insert into public.household_members (household_id, user_id, role)
    values (v_invite.household_id, v_user_id, 'partner');

  update public.invites
    set used_at = now(), used_by_user_id = v_user_id
    where token = p_token;

  return v_invite.household_id;
end;
$$;

revoke all on function public.accept_invite(text) from public;
grant execute on function public.accept_invite(text) to authenticated;
