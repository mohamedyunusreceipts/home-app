-- Food & Groceries module tables (spec §9.2).
-- Recipes, ingredients, weekly meal plan, pantry, grocery list, leftovers.
-- RLS uses the same tenant-isolation template as the foundation tables
-- (see 0004_foundation_rls.sql) — `current_user_household_ids()` scopes every
-- row to the caller's household. User content carries a soft-delete `deleted_at`.

-- recipes: a saved recipe, optionally backed by a Drive-stored photo.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  photo_drive_file_id text,
  servings int,
  prep_min int,
  cook_min int,
  instructions_md text,
  source_url text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index recipes_household_idx on public.recipes(household_id);

-- pantry_items: what's currently on hand, with optional expiry.
-- Declared before recipe_ingredients because the latter has an FK to it.
create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  qty numeric(12,3),
  unit text,
  expires_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index pantry_items_household_idx on public.pantry_items(household_id);

-- recipe_ingredients: line items for a recipe. May link to a pantry item.
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  name text not null,
  qty numeric(12,3),
  unit text,
  pantry_item_id uuid references public.pantry_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index recipe_ingredients_recipe_idx on public.recipe_ingredients(recipe_id);

-- meal_plan: one slot (breakfast/lunch/dinner) for a date, assigning either a
-- recipe or free-text. One assignment per (household, date, slot).
create table public.meal_plan (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('breakfast', 'lunch', 'dinner')),
  recipe_id uuid references public.recipes(id) on delete set null,
  free_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- A slot points at a recipe OR carries free text (or is empty), never a recipe
  -- with conflicting free text.
  check (recipe_id is null or free_text is null)
);

create unique index meal_plan_slot_unique
  on public.meal_plan(household_id, date, slot)
  where deleted_at is null;

-- grocery_items: the shopping list. `source` records how the item got here.
create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  qty numeric(12,3),
  unit text,
  source text not null default 'manual' check (source in ('manual', 'meal_plan', 'recipe')),
  checked boolean not null default false,
  added_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index grocery_items_household_idx on public.grocery_items(household_id);

-- leftovers: cooked food to be eaten by a date, optionally from a recipe.
create table public.leftovers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null,
  consume_by date not null,
  from_recipe_id uuid references public.recipes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index leftovers_household_idx on public.leftovers(household_id);
create index leftovers_consume_by_idx on public.leftovers(consume_by);

-- Enable RLS and apply the tenant-isolation template (mirrors 0004_foundation_rls.sql).
alter table public.recipes             enable row level security;
alter table public.recipe_ingredients  enable row level security;
alter table public.meal_plan           enable row level security;
alter table public.pantry_items        enable row level security;
alter table public.grocery_items       enable row level security;
alter table public.leftovers           enable row level security;

create policy recipes_tenant_isolation on public.recipes
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy recipe_ingredients_tenant_isolation on public.recipe_ingredients
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy meal_plan_tenant_isolation on public.meal_plan
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy pantry_items_tenant_isolation on public.pantry_items
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy grocery_items_tenant_isolation on public.grocery_items
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));

create policy leftovers_tenant_isolation on public.leftovers
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (household_id in (select public.current_user_household_ids()));
