-- Meals & Desserts catalogue (feature-catalogues).
-- A household's curated list of dishes/desserts they like, split by `kind`
-- ('food' = meals, 'dessert'). RLS uses the same tenant-isolation template as
-- the foundation/food tables (see 0004_foundation_rls.sql, 0015_food_tables.sql)
-- — `current_user_household_ids()` scopes every row to the caller's household.
--
-- New households are seeded with the default catalogue via an after-insert
-- trigger; existing households are backfilled at the end of this migration.

-- catalogue_items: one dish/dessert the household likes.
create table public.catalogue_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  kind text not null check (kind in ('food', 'dessert')),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index catalogue_items_household_kind_idx
  on public.catalogue_items(household_id, kind);

-- Prevent duplicates case-insensitively within a (household, kind).
create unique index catalogue_items_household_kind_name_unique
  on public.catalogue_items(household_id, kind, lower(name));

-- Enable RLS and apply the tenant-isolation template (mirrors 0004 / 0015).
alter table public.catalogue_items enable row level security;

create policy catalogue_items_tenant_isolation on public.catalogue_items
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

-- Seed the default catalogue for a household. SECURITY DEFINER so it can insert
-- regardless of the caller's RLS context (called by the trigger and the
-- backfill below). `on conflict do nothing` makes it idempotent.
create or replace function public.seed_default_catalogue(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.catalogue_items (household_id, kind, name)
  select p_household_id, 'dessert', name
  from (values
    ('Carrot cupcakes'),
    ('Red velvet cupcakes'),
    ('Chocolate cupcakes'),
    ('Bens cookies'),
    ('Choc chip cookies'),
    ('Chocolate volcano'),
    ('Pavlova'),
    ('Creme brulee'),
    ('Lemon bars'),
    ('Brownies'),
    ('Nutella tart'),
    ('Lemon tart'),
    ('Mini cheesecakes'),
    ('San sabastein cheesecake'),
    ('Madelaines'),
    ('Pistachio and cardomom tres leche'),
    ('Macarons'),
    ('Cardomom loaf'),
    ('Eclairs'),
    ('Lemon and poppy seed muffins'),
    ('Pistachio tiramisu'),
    ('Normal tiramisu'),
    ('Rosemary bread'),
    ('Challah bread'),
    ('Durban naan bread'),
    ('Cream puffs'),
    ('Fabiola'),
    ('Baklava'),
    ('Bastani ice cream'),
    ('Pistachio and mascarpone cupcakes')
  ) as d(name)
  on conflict do nothing;

  insert into public.catalogue_items (household_id, kind, name)
  select p_household_id, 'food', name
  from (values
    ('Chicken curry'),
    ('Lamb curry'),
    ('Chicken aknee'),
    ('Dhal and chicken'),
    ('Marry me chicken'),
    ('Kitchiri'),
    ('Chicken kalya'),
    ('Butter beans'),
    ('Baked beans'),
    ('Butter chicken'),
    ('Chicken korma'),
    ('Chops chutney'),
    ('Prawn pasta'),
    ('Cheese pasta'),
    ('Mac and cheese'),
    ('Ramen'),
    ('Simply Asia'),
    ('Chicken Alfredo lasagne'),
    ('Gnocci'),
    ('Risotto'),
    ('Prawn paella'),
    ('Egg fried rice'),
    ('Schwarma'),
    ('Wraps'),
    ('Subway'),
    ('Steak and fries'),
    ('Schwarma bowl'),
    ('Lahmajeen'),
    ('Burgers'),
    ('Smash burgers'),
    ('Harissa chicken sandwiches'),
    ('Tacos'),
    ('Thai prawn curry'),
    ('Teriyaki chicken'),
    ('Dragon chicken'),
    ('Nandos strips and rice'),
    ('Saucy kebabs'),
    ('Garlic and herb pizza'),
    ('Garlic and cottage cheese bruchetta'),
    ('Quesadilla'),
    ('Saucy prawns'),
    ('Garlic and cheese rolls'),
    ('Dill and lemon salmon or trout'),
    ('Mussels'),
    ('Pitas')
  ) as f(name)
  on conflict do nothing;
end;
$$;

revoke all on function public.seed_default_catalogue(uuid) from public;

-- Seed the catalogue for every newly created household.
create or replace function public.seed_catalogue_on_household_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.seed_default_catalogue(new.id);
  return new;
end;
$$;

create trigger seed_catalogue_after_household_insert
  after insert on public.households
  for each row execute function public.seed_catalogue_on_household_insert();

-- Backfill: seed every household that already exists.
do $$
declare
  h record;
begin
  for h in select id from public.households loop
    perform public.seed_default_catalogue(h.id);
  end loop;
end $$;
