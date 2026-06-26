-- Wardrobe module (spec §9.6).
-- Three tables: wardrobe_items, outfits, wardrobe_preferences.
-- wardrobe_items / outfits carry household_id, standard timestamps and
-- soft-delete (deleted_at) as user-content tables. wardrobe_preferences is a
-- per-user row (no household_id; keyed on user_id), shared with the Vault
-- "Sizes & preferences" tab (spec §9.7).
--
-- RLS mirrors the tenant-isolation template (see 0004_foundation_rls.sql /
-- 0009_mortgage_tables.sql) but wardrobe_items adds the spec §9.6 per-user
-- privacy rule: a member sees an item only if it is shared with the partner OR
-- they own it.

-- wardrobe_items: a single garment / accessory owned by one household member.
create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (
    category in (
      'top', 'bottom', 'dress', 'shoes', 'outerwear', 'accessory', 'underwear'
    )
  ),
  color text,
  season text[] not null default '{}',     -- e.g. {'summer','autumn'}
  occasion text[] not null default '{}',   -- e.g. {'work','formal'}
  photo_drive_file_id text,                -- null until a photo is uploaded to Drive
  brand text,
  size text,
  notes text,
  laundry_status text not null default 'clean' check (
    laundry_status in ('clean', 'worn', 'in_wash')
  ),
  visible_to_partner boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index wardrobe_items_household_idx on public.wardrobe_items(household_id);
create index wardrobe_items_owner_idx on public.wardrobe_items(owner_user_id);
-- Helps the generator's "exclude in_wash" / category filters on live items.
create index wardrobe_items_live_idx
  on public.wardrobe_items(household_id, owner_user_id, category)
  where deleted_at is null;

-- outfits: a named, saved combination of the owner's wardrobe items.
create table public.outfits (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  occasion text,
  item_ids uuid[] not null default '{}',   -- references wardrobe_items.id (no FK on array in v1)
  saved_at timestamptz not null default now(),
  photo_drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index outfits_household_idx on public.outfits(household_id);
create index outfits_owner_idx on public.outfits(owner_user_id);

-- wardrobe_preferences: per-user sizing + style notes. One row per user.
-- Per-user (not household-scoped): keyed and gated on user_id. Surfaced in both
-- the Wardrobe module and the Vault "Sizes & preferences" tab (spec §9.7).
create table public.wardrobe_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sizes jsonb not null default '{}'::jsonb,   -- freeform keys: tops, bottoms, shoes, ring, etc.
  style_notes_md text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
alter table public.wardrobe_items       enable row level security;
alter table public.outfits              enable row level security;
alter table public.wardrobe_preferences enable row level security;

-- wardrobe_items: tenant isolation PLUS the per-user privacy rule (spec §9.6).
-- USING (reads/updates/deletes): tenant-isolated AND visible to the caller only
-- when the item is shared with the partner OR the caller owns it.
-- WITH CHECK (inserts/updates): tenant isolation AND the caller must be the
-- owner — you can only create/modify your OWN items.
--
-- NOTE on the `underwear` default: spec §9.6 says underwear defaults to
-- visible_to_partner = false. The column default is `true` for every other
-- category, so this default is enforced on the insert path (the server action /
-- UI sets visible_to_partner = false when category = 'underwear'). Documented
-- here so the privacy intent travels with the schema.
create policy wardrobe_items_per_user_privacy on public.wardrobe_items
  for all
  using (
    household_id in (select public.current_user_household_ids())
    and (visible_to_partner or owner_user_id = (select auth.uid()))
  )
  with check (
    household_id in (select public.current_user_household_ids())
    and owner_user_id = (select auth.uid())
  );

-- outfits: tenant-isolated and owner-writable. A partner can VIEW outfits within
-- the household (USING = tenant isolation); only the owner can create/modify
-- their own (WITH CHECK adds owner_user_id = auth.uid()).
create policy outfits_owner_writable on public.outfits
  for all
  using (household_id in (select public.current_user_household_ids()))
  with check (
    household_id in (select public.current_user_household_ids())
    and owner_user_id = (select auth.uid())
  );

-- wardrobe_preferences: strictly per-user own-row (it has no household_id).
create policy wardrobe_preferences_own_row on public.wardrobe_preferences
  for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
