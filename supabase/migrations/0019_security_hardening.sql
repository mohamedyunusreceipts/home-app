-- Security-audit follow-ups. Hardening / consistency only — no behaviour change.

-- 1. Pin search_path on the max-members trigger function, matching the rest of
--    the codebase's functions (defense-in-depth; the function is SECURITY INVOKER).
create or replace function public.enforce_max_household_members()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  member_count int;
begin
  select count(*) into member_count
    from public.household_members
    where household_id = new.household_id;

  if member_count >= 2 then
    raise exception 'household % already has max 2 members', new.household_id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- 2. Add the missing WITH CHECK to the invites UPDATE policy so it can't be used
--    to move a row to another household (USING + WITH CHECK should always pair).
alter policy invites_member_update on public.invites
  with check (household_id in (select public.current_user_household_ids()));
