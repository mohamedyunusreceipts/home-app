-- Foundation tables for households, members, and invites.

create extension if not exists "pgcrypto";

-- profiles: one row per Supabase auth.users entry
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- households: one row per couple
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid not null references public.profiles(id) on delete restrict,
  -- TODO Plan 03: encrypt at rest with AES-256-GCM; key from DRIVE_TOKEN_ENCRYPTION_KEY env var.
  drive_refresh_token_encrypted bytea,
  drive_root_folder_id text,
  currency text not null default 'ZAR',
  timezone text not null default 'Africa/Johannesburg',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index households_owner_idx on public.households(owner_user_id);

-- household_members: PK ensures one membership row per (household, user)
create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'partner')),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on public.household_members(user_id);

-- invites: short-lived single-use tokens
create table public.invites (
  token text primary key,
  household_id uuid not null references public.households(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  used_at timestamptz,
  used_by_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index invites_household_idx on public.invites(household_id);
