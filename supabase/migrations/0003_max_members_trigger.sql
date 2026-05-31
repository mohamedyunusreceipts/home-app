-- Enforce a maximum of 2 members per household.

create or replace function public.enforce_max_household_members()
returns trigger
language plpgsql
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

create trigger enforce_max_household_members_trigger
  before insert on public.household_members
  for each row execute function public.enforce_max_household_members();
