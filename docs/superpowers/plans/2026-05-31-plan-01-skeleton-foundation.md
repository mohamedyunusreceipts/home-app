# Plan 01 — Skeleton + Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 15 + TypeScript + Tailwind + ShadCN project with the warm/cozy theme, configure local Supabase, and ship the four foundation tables (`profiles`, `households`, `household_members`, `invites`) with the RLS template, the max-2-members trigger, and the profile auto-create trigger — all backed by integration tests that prove cross-household isolation.

**Architecture:** Next.js App Router project at the repo root. Supabase CLI runs Postgres + Auth locally in Docker for development and tests; the same migrations deploy to the hosted Supabase project. Foundation schema lives under `supabase/migrations/`. Integration tests use a service-role client to seed two households and two users per household, then use anon clients with each user's JWT to assert RLS isolation.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Tailwind CSS 3.4, ShadCN/UI, `@supabase/supabase-js`, `@supabase/ssr`, Supabase CLI, Vitest, Docker (for `supabase start`).

**Prerequisites (one-time manual setup the user does before/early in this plan):**
1. Install Node.js ≥20.x.
2. Install Docker Desktop (required for `supabase start`).
3. Install Supabase CLI: `npm install -g supabase` (or `brew install supabase/tap/supabase`).
4. Create a hosted Supabase project under `mohamedyunusreceipts@gmail.com` at https://supabase.com/dashboard (project name: `home-app`, region: closest to South Africa — `eu-west-1` is the closest available). Capture the project ref, anon key, and service role key for `.env.local` later. **This is not needed for Plan 01 execution** (local Supabase is sufficient) but mention it now so the user starts the account setup in parallel.

---

## File Structure

Files this plan creates or modifies:

| File | Responsibility |
|---|---|
| `package.json` | Project manifest, scripts, dependencies |
| `tsconfig.json` | TypeScript strict configuration |
| `next.config.mjs` | Next.js config (PWA wiring happens later) |
| `tailwind.config.ts` | Tailwind config with warm/cozy theme tokens |
| `postcss.config.mjs` | PostCSS for Tailwind |
| `app/globals.css` | Tailwind base + CSS variables for theme |
| `app/layout.tsx` | Root layout with Fraunces + Inter font loading |
| `app/page.tsx` | Placeholder home page (real dashboard comes in Plan 04) |
| `components/ui/button.tsx` | ShadCN Button, restyled to theme |
| `components/ui/card.tsx` | ShadCN Card, restyled to theme |
| `lib/supabase/client.ts` | Browser Supabase client factory |
| `lib/supabase/server.ts` | Server Supabase client factory (cookies) |
| `lib/supabase/middleware.ts` | Middleware helper for session refresh |
| `middleware.ts` | Next.js middleware wiring Supabase session refresh |
| `lib/env.ts` | Runtime env-var validation |
| `supabase/config.toml` | Supabase CLI project config (created by `supabase init`) |
| `supabase/migrations/0001_foundation_tables.sql` | Create profiles/households/household_members/invites |
| `supabase/migrations/0002_profile_trigger.sql` | Auto-create profile row on auth.users insert |
| `supabase/migrations/0003_max_members_trigger.sql` | Enforce max 2 members per household |
| `supabase/migrations/0004_foundation_rls.sql` | Enable RLS + apply tenant_isolation policies |
| `supabase/seed.sql` | Empty placeholder for seed data (modules add to this later) |
| `vitest.config.ts` | Vitest config — integration tests use node environment |
| `tests/helpers/supabase.ts` | Test helpers: create authed clients, seed households |
| `tests/integration/foundation/rls-isolation.test.ts` | Prove household A cannot see household B's rows |
| `tests/integration/foundation/max-members.test.ts` | Prove trigger blocks a 3rd member |
| `tests/integration/foundation/profile-trigger.test.ts` | Prove profile row auto-creates |
| `.env.local.example` | Documented environment variables |
| `.env.local` | Local env (gitignored; created from example) |
| `README.md` | How to set up, develop, and test |
| `.github/workflows/ci.yml` | GitHub Actions: typecheck + vitest against local supabase |

---

## Task 1: Initialize Next.js 15 project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next-env.d.ts`

- [ ] **Step 1: Scaffold Next.js project in current directory**

Run from project root:

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --use-npm --eslint
```

When prompted:
- "Would you like to use Turbopack?" → **Yes**

Expected: creates `app/`, `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`, ESLint config. Existing `.gitignore` and `docs/` are preserved. If the scaffolder complains the directory is non-empty, accept the prompt to proceed.

- [ ] **Step 2: Verify dev server starts**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000 within ~5s and shows the default Next.js starter page. Kill with Ctrl+C.

- [ ] **Step 3: Tighten TypeScript config**

Open `tsconfig.json` and ensure the `compilerOptions` block contains at least these flags (merge, don't overwrite, with what create-next-app generated):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

- [ ] **Step 4: Verify typecheck passes**

```bash
npx tsc --noEmit
```

Expected: no output, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 15 project with strict TypeScript"
```

---

## Task 2: Configure warm/cozy theme tokens

**Files:**
- Modify: `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`

- [ ] **Step 1: Replace `tailwind.config.ts` with theme tokens**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        terracotta: {
          50:  '#FBF2EE',
          100: '#F4DDD2',
          200: '#E8B9A3',
          300: '#DA9577',
          400: '#C77B5C',
          500: '#B36548',
          600: '#974F38',
          700: '#793F2D',
          800: '#5C3023',
          900: '#3F2118',
        },
        sage: {
          50:  '#F1F5F1',
          100: '#DCE7DC',
          200: '#B9CFB9',
          300: '#95B695',
          400: '#7A9B7A',
          500: '#5F8160',
          600: '#4B684C',
          700: '#3B523C',
          800: '#2C3D2D',
          900: '#1E2A1E',
        },
        cream: {
          50:  '#FFFDF9',
          100: '#FAF6EF',
          200: '#F2EBDF',
          300: '#E8DFCE',
          400: '#DBCFB7',
          500: '#C6B796',
        },
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans:  ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
```

- [ ] **Step 2: Replace `app/globals.css` with theme base styles**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: #FAF6EF;
    --foreground: #3F2118;
    --accent: #C77B5C;
    --muted: #DBCFB7;
  }

  html, body {
    background: var(--background);
    color: var(--foreground);
  }

  h1, h2, h3, h4 {
    font-family: var(--font-fraunces), Georgia, serif;
  }
}
```

- [ ] **Step 3: Wire Google Fonts in `app/layout.tsx`**

Replace the existing `app/layout.tsx` contents with:

```tsx
import type { Metadata } from 'next'
import { Fraunces, Inter } from 'next/font/google'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Home',
  description: 'Shared home management for couples',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Replace `app/page.tsx` with a theme-using placeholder**

```tsx
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-serif text-terracotta-700 mb-4">Home</h1>
        <p className="text-sage-700">
          Shared home management for couples. The app is being built.
        </p>
      </div>
    </main>
  )
}
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000. Expected: cream background, terracotta serif "Home" heading, sage paragraph text. Kill with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: warm/cozy theme tokens (terracotta, sage, cream, Fraunces+Inter)"
```

---

## Task 3: Install ShadCN base primitives

ShadCN copies component source into your repo (not a runtime dep) so you can restyle freely.

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/button.tsx`, `components/ui/card.tsx`

- [ ] **Step 1: Initialize ShadCN**

```bash
npx shadcn@latest init
```

When prompted:
- Style: **New York**
- Base color: **Neutral** (we override anyway)
- CSS variables: **Yes**

Accept other defaults. This creates `components.json` and `lib/utils.ts`.

- [ ] **Step 2: Add Button and Card components**

```bash
npx shadcn@latest add button card
```

This creates `components/ui/button.tsx` and `components/ui/card.tsx`.

- [ ] **Step 3: Restyle Button defaults to use terracotta**

Open `components/ui/button.tsx`. Find the `default` variant in the `buttonVariants` cva definition and replace its className with:

```ts
default: 'bg-terracotta-400 text-cream-50 hover:bg-terracotta-500 shadow-sm',
```

Find the `outline` variant and replace with:

```ts
outline: 'border border-sage-300 bg-transparent hover:bg-sage-50 text-sage-800',
```

- [ ] **Step 4: Use components on the home page to verify**

Replace `app/page.tsx` with:

```tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700">Home</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            Shared home management for couples. The app is being built.
          </p>
          <Button>Get started</Button>
          <Button variant="outline">Learn more</Button>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```

Open http://localhost:3000. Expected: card with terracotta "Get started" button and sage outline "Learn more" button. Kill with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: shadcn primitives (button, card) with theme restyling"
```

---

## Task 4: Install Supabase dependencies and set up local Supabase

**Files:**
- Modify: `package.json` (deps), `.gitignore`
- Create: `supabase/config.toml` (generated), `supabase/seed.sql`

- [ ] **Step 1: Install runtime Supabase packages**

```bash
npm install @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Install Supabase CLI as dev dep**

```bash
npm install -D supabase
```

(This avoids requiring a global install for CI.)

- [ ] **Step 3: Initialize Supabase project**

```bash
npx supabase init
```

When prompted "Generate VS Code workspace settings?" — answer **No**. This creates `supabase/config.toml` and `supabase/seed.sql`.

- [ ] **Step 4: Append local Supabase paths to `.gitignore`**

Open `.gitignore` and add at the end:

```gitignore
# Supabase local runtime
supabase/.branches/
supabase/.temp/
```

(`supabase/migrations/` and `supabase/config.toml` ARE committed.)

- [ ] **Step 5: Start local Supabase**

Ensure Docker Desktop is running, then:

```bash
npx supabase start
```

Expected: takes 1-2 min on first run (pulls Docker images). Outputs a block listing `API URL`, `DB URL`, `anon key`, `service_role key`, and a Studio URL (http://localhost:54323). **Copy these values** — you'll need anon and service_role in the next task.

If the start fails because Docker is not running, start Docker Desktop and retry.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: install supabase deps and initialize local supabase project"
```

---

## Task 5: Environment variables + env validation

**Files:**
- Create: `.env.local.example`, `.env.local`, `lib/env.ts`

- [ ] **Step 1: Create `.env.local.example`**

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<paste anon key from `supabase start` output>
SUPABASE_SERVICE_ROLE_KEY=<paste service_role key from `supabase start` output>
```

- [ ] **Step 2: Create `.env.local` with actual local values**

Copy `.env.local.example` to `.env.local` and paste the actual anon and service_role keys from your `npx supabase start` output:

```bash
cp .env.local.example .env.local
```

Then edit `.env.local` and substitute the placeholders. **`.env.local` is gitignored** (already covered by existing `.gitignore`).

- [ ] **Step 3: Create `lib/env.ts` with runtime validation**

```ts
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export const env = {
  SUPABASE_URL: required('NEXT_PUBLIC_SUPABASE_URL'),
  SUPABASE_ANON_KEY: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  get SUPABASE_SERVICE_ROLE_KEY() {
    return required('SUPABASE_SERVICE_ROLE_KEY')
  },
}
```

The getter for the service role key defers the check — it's only accessed in server/test contexts, so the browser bundle won't blow up.

- [ ] **Step 4: Commit**

```bash
git add lib/env.ts .env.local.example
git commit -m "feat: env var validation helper"
```

---

## Task 6: Supabase client wrappers (browser, server, middleware)

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/middleware.ts`, `middleware.ts`

- [ ] **Step 1: Create browser client (`lib/supabase/client.ts`)**

```ts
import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/lib/env'

export function createClient() {
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
}
```

- [ ] **Step 2: Create server client (`lib/supabase/server.ts`)**

```ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — middleware will refresh session
        }
      },
    },
  })
}
```

- [ ] **Step 3: Create middleware helper (`lib/supabase/middleware.ts`)**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  await supabase.auth.getUser()
  return response
}
```

- [ ] **Step 4: Create `middleware.ts` at project root**

```ts
import { updateSession } from '@/lib/supabase/middleware'
import { type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 5: Verify the app still boots with Supabase middleware**

```bash
npm run dev
```

Visit http://localhost:3000. Expected: page renders normally (no auth yet, nothing requires it). Kill with Ctrl+C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: supabase client wrappers (browser, server, middleware)"
```

---

## Task 7: Set up Vitest and integration test helpers

**Files:**
- Create: `vitest.config.ts`, `tests/helpers/supabase.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Vitest and dotenv-cli**

```bash
npm install -D vitest dotenv-cli
```

`dotenv-cli` loads `.env.local` for the test runner.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 15_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

- [ ] **Step 3: Add test scripts to `package.json`**

In `package.json`, in the `scripts` section, add:

```json
"test": "dotenv -e .env.local -- vitest run",
"test:watch": "dotenv -e .env.local -- vitest"
```

- [ ] **Step 4: Create `tests/helpers/supabase.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function createTestUser(
  email?: string,
): Promise<{ id: string; email: string; password: string }> {
  const service = serviceClient()
  const generatedEmail = email ?? `user-${randomUUID()}@test.local`
  const password = `Test-${randomUUID()}`
  const { data, error } = await service.auth.admin.createUser({
    email: generatedEmail,
    password,
    email_confirm: true,
  })
  if (error || !data.user) {
    throw new Error(`Failed to create test user: ${error?.message}`)
  }
  return { id: data.user.id, email: generatedEmail, password }
}

export async function authedClient(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Sign-in failed: ${error.message}`)
  return client
}

export async function resetDatabase(): Promise<void> {
  const service = serviceClient()
  // Order matters: invites → household_members → households → auth.users
  await service.from('invites').delete().neq('token', '__never__')
  await service.from('household_members').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  await service.from('households').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  const { data: users } = await service.auth.admin.listUsers()
  for (const user of users?.users ?? []) {
    await service.auth.admin.deleteUser(user.id)
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: vitest config and supabase test helpers"
```

---

## Task 8: Foundation migration — tables

**Files:**
- Create: `supabase/migrations/0001_foundation_tables.sql`

- [ ] **Step 1: Write a failing test first — table existence + basic insert/query**

Create `tests/integration/foundation/tables.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, resetDatabase } from '@/tests/helpers/supabase'

describe('foundation tables', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('allows service role to create a household and add the owner as a member', async () => {
    const owner = await createTestUser()
    const service = serviceClient()

    const { data: household, error: hErr } = await service
      .from('households')
      .insert({ name: 'Test Home', owner_user_id: owner.id })
      .select()
      .single()

    expect(hErr).toBeNull()
    expect(household).toMatchObject({ name: 'Test Home', owner_user_id: owner.id, currency: 'ZAR' })

    const { error: mErr } = await service
      .from('household_members')
      .insert({ household_id: household!.id, user_id: owner.id, role: 'owner' })

    expect(mErr).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/integration/foundation/tables.test.ts
```

Expected: FAIL — error about `households` table not existing.

- [ ] **Step 3: Write the migration `supabase/migrations/0001_foundation_tables.sql`**

```sql
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
```

- [ ] **Step 4: Apply the migration to local Supabase**

```bash
npx supabase migration up
```

Expected: prints "Applied migration 0001_foundation_tables.sql".

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/integration/foundation/tables.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): foundation tables (profiles, households, members, invites)"
```

---

## Task 9: Profile auto-create trigger

When a row is inserted into `auth.users` (i.e., someone signs up), a matching `public.profiles` row must be created automatically. Otherwise `household_members.user_id` FK fails for new users.

**Files:**
- Create: `supabase/migrations/0002_profile_trigger.sql`, `tests/integration/foundation/profile-trigger.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, resetDatabase } from '@/tests/helpers/supabase'

describe('profile auto-create trigger', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('inserts a profiles row when a user is created in auth.users', async () => {
    const user = await createTestUser('trigger-test@test.local')
    const service = serviceClient()

    const { data, error } = await service
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    expect(error).toBeNull()
    expect(data).toMatchObject({ id: user.id, email: 'trigger-test@test.local' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/integration/foundation/profile-trigger.test.ts
```

Expected: FAIL — profile row not found (`error.code === 'PGRST116'`).

- [ ] **Step 3: Write migration `supabase/migrations/0002_profile_trigger.sql`**

```sql
-- Auto-create a public.profiles row whenever an auth.users row is created.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: Apply migration and re-run test**

```bash
npx supabase migration up
npm test -- tests/integration/foundation/profile-trigger.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): trigger to auto-create profiles row on auth.users insert"
```

---

## Task 10: Max-2-members trigger

**Files:**
- Create: `supabase/migrations/0003_max_members_trigger.sql`, `tests/integration/foundation/max-members.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, resetDatabase } from '@/tests/helpers/supabase'

describe('max-2-members trigger', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('rejects a third member with a clear error', async () => {
    const u1 = await createTestUser()
    const u2 = await createTestUser()
    const u3 = await createTestUser()
    const service = serviceClient()

    const { data: household } = await service
      .from('households')
      .insert({ name: 'Test', owner_user_id: u1.id })
      .select()
      .single()

    const householdId = household!.id

    const { error: e1 } = await service
      .from('household_members')
      .insert({ household_id: householdId, user_id: u1.id, role: 'owner' })
    expect(e1).toBeNull()

    const { error: e2 } = await service
      .from('household_members')
      .insert({ household_id: householdId, user_id: u2.id, role: 'partner' })
    expect(e2).toBeNull()

    const { error: e3 } = await service
      .from('household_members')
      .insert({ household_id: householdId, user_id: u3.id, role: 'partner' })

    expect(e3).not.toBeNull()
    expect(e3!.message).toMatch(/max 2/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/integration/foundation/max-members.test.ts
```

Expected: FAIL — third insert succeeds (no enforcement yet).

- [ ] **Step 3: Write migration `supabase/migrations/0003_max_members_trigger.sql`**

```sql
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
```

- [ ] **Step 4: Apply migration and re-run test**

```bash
npx supabase migration up
npm test -- tests/integration/foundation/max-members.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): trigger enforcing max 2 members per household"
```

---

## Task 11: Foundation RLS policies

**Files:**
- Create: `supabase/migrations/0004_foundation_rls.sql`, `tests/integration/foundation/rls-isolation.test.ts`

- [ ] **Step 1: Write failing test — household A cannot see household B's data**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { serviceClient, createTestUser, authedClient, resetDatabase } from '@/tests/helpers/supabase'

describe('RLS — foundation isolation', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function makeHousehold(name: string) {
    const owner = await createTestUser()
    const partner = await createTestUser()
    const service = serviceClient()

    const { data: household } = await service
      .from('households')
      .insert({ name, owner_user_id: owner.id })
      .select()
      .single()

    await service.from('household_members').insert([
      { household_id: household!.id, user_id: owner.id, role: 'owner' },
      { household_id: household!.id, user_id: partner.id, role: 'partner' },
    ])

    return { household: household!, owner, partner }
  }

  it('user in household A cannot see household B in households table', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data, error } = await aClient.from('households').select('*')

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data![0].id).toBe(a.household.id)
    expect(data!.find(h => h.id === b.household.id)).toBeUndefined()
  })

  it('user in household A cannot see household B members', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data } = await aClient.from('household_members').select('*')

    expect(data!.every(m => m.household_id === a.household.id)).toBe(true)
  })

  it('user in household A cannot see household B invites', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')
    const service = serviceClient()

    await service.from('invites').insert({
      token: 'b-secret-token',
      household_id: b.household.id,
      created_by: b.owner.id,
    })

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data } = await aClient.from('invites').select('*')

    expect(data!.find(i => i.token === 'b-secret-token')).toBeUndefined()
  })

  it('user in household A cannot insert into household B', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { error } = await aClient
      .from('invites')
      .insert({
        token: 'malicious',
        household_id: b.household.id,
        created_by: a.owner.id,
      })

    expect(error).not.toBeNull()
  })

  it('any authenticated user can read their own profile only', async () => {
    const a = await makeHousehold('A')
    const b = await makeHousehold('B')

    const aClient = await authedClient(a.owner.email, a.owner.password)
    const { data } = await aClient.from('profiles').select('*')

    // a.owner should see their own profile, and also a.partner (same household)
    // but NOT b.owner or b.partner
    expect(data!.map(p => p.id).sort()).toEqual([a.owner.id, a.partner.id].sort())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/integration/foundation/rls-isolation.test.ts
```

Expected: FAIL — without RLS enabled, the anon client sees ALL rows.

- [ ] **Step 3: Write migration `supabase/migrations/0004_foundation_rls.sql`**

Note: this migration defines a `SECURITY DEFINER` helper function (`current_user_household_ids()`) that bypasses RLS to look up the caller's household memberships. Policies use this helper instead of subquerying `household_members` directly, which would otherwise infinitely recurse (the policy's subquery would itself be evaluated under RLS, requiring another subquery, etc.). This is the standard Supabase pattern for self-referencing tenancy.

```sql
-- Enable RLS and apply the tenant-isolation template to all foundation tables.

alter table public.households          enable row level security;
alter table public.household_members   enable row level security;
alter table public.invites             enable row level security;
alter table public.profiles            enable row level security;

-- Helper: returns the household IDs the calling user is a member of.
-- SECURITY DEFINER + `set search_path` bypasses RLS for the lookup, breaking
-- the recursion that would happen if RLS policies subqueried household_members directly.
create or replace function public.current_user_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id
    from public.household_members
    where user_id = auth.uid();
$$;

revoke all on function public.current_user_household_ids() from public;
grant execute on function public.current_user_household_ids() to authenticated;

-- Helper: returns the user IDs of all members of the caller's households (incl. self).
create or replace function public.current_user_co_member_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select user_id
    from public.household_members
    where household_id in (select public.current_user_household_ids());
$$;

revoke all on function public.current_user_co_member_ids() from public;
grant execute on function public.current_user_co_member_ids() to authenticated;

-- profiles: users see profiles of co-members in their households (incl. themselves)
create policy profiles_household_visible on public.profiles
  for select
  using (id in (select public.current_user_co_member_ids()));

create policy profiles_self_update on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- households: visible to members; INSERT performed by service role during onboarding
create policy households_member_visible on public.households
  for select
  using (id in (select public.current_user_household_ids()));

create policy households_owner_update on public.households
  for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

-- household_members: visible to members of the same household
create policy household_members_visible on public.household_members
  for select
  using (household_id in (select public.current_user_household_ids()));

-- invites: visible to members; INSERT by members of the household
create policy invites_member_visible on public.invites
  for select
  using (household_id in (select public.current_user_household_ids()));

create policy invites_member_insert on public.invites
  for insert
  with check (
    household_id in (select public.current_user_household_ids())
    and created_by = auth.uid()
  );

create policy invites_member_update on public.invites
  for update
  using (household_id in (select public.current_user_household_ids()));
```

- [ ] **Step 4: Apply migration and re-run test**

```bash
npx supabase migration up
npm test -- tests/integration/foundation/rls-isolation.test.ts
```

Expected: PASS — all 5 tests pass.

- [ ] **Step 5: Re-run ALL foundation tests to make sure nothing regressed**

```bash
npm test -- tests/integration/foundation
```

Expected: all tests across all foundation files pass (tables, profile-trigger, max-members, rls-isolation).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): enable RLS with tenant-isolation policies on foundation tables"
```

---

## Task 12: README and developer setup docs

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with setup and dev instructions**

```markdown
# Home

Shared home management app for couples. PWA built with Next.js 15, Supabase, and Google Drive integration.

## Prerequisites

- Node.js ≥20
- Docker Desktop (running, required for local Supabase)
- Supabase CLI: bundled as a dev dependency (use via `npx supabase …`)

## First-time setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start local Supabase (one-time pull of Docker images, then ~5s):
   ```bash
   npx supabase start
   ```

3. Copy the printed `anon key` and `service_role key` into `.env.local`:
   ```bash
   cp .env.local.example .env.local
   # then edit .env.local with the values from `supabase start`
   ```

4. Apply database migrations:
   ```bash
   npx supabase migration up
   ```

## Development

```bash
npm run dev               # Next.js dev server at http://localhost:3000
npx supabase status       # show local Supabase URLs and keys
npx supabase stop         # stop local containers (preserves data)
npx supabase db reset     # drop + recreate local DB, re-apply migrations + seed
```

Supabase Studio (local DB UI): http://localhost:54323

## Testing

```bash
npm test                  # run all tests once
npm run test:watch        # watch mode
```

Integration tests run against the local Supabase instance. Make sure `supabase start` is running first.

## Project structure

```
/app                  Next.js App Router routes
/components/ui        ShadCN primitives (restyled)
/lib                  Shared utilities (supabase clients, env, etc.)
/supabase/migrations  Database schema, applied in numbered order
/tests                Vitest test suite
/docs/superpowers     Design specs and implementation plans
```

## Theme

Warm/cozy palette: terracotta (#C77B5C), sage (#7A9B7A), cream (#FAF6EF). Headings: Fraunces (serif). Body: Inter (sans).
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README with setup and dev instructions"
```

---

## Task 13: GitHub Actions CI (typecheck + tests)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Start Supabase
        run: npx supabase start

      - name: Apply migrations
        run: npx supabase migration up

      - name: Write test env vars
        run: |
          status=$(npx supabase status -o json)
          echo "NEXT_PUBLIC_SUPABASE_URL=$(echo "$status" | jq -r .API_URL)" >> .env.local
          echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=$(echo "$status" | jq -r .ANON_KEY)" >> .env.local
          echo "SUPABASE_SERVICE_ROLE_KEY=$(echo "$status" | jq -r .SERVICE_ROLE_KEY)" >> .env.local

      - run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: typecheck + integration tests against local supabase"
```

(CI will start working as soon as you push to a GitHub remote; for now, this is local only — that's fine.)

---

## Final verification

- [ ] **Step 1: Full test run**

```bash
npm test
```

Expected: all foundation tests pass (tables, profile-trigger, max-members, rls-isolation x5).

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean exit.

- [ ] **Step 3: Dev server boot**

```bash
npm run dev
```

Expected: http://localhost:3000 renders the warm/cozy placeholder home page with Card and buttons. Kill with Ctrl+C.

- [ ] **Step 4: Git log review**

```bash
git log --oneline
```

Expected: ~13 commits since the initial spec commit, each with a clear feat/chore/docs prefix.

---

## What's next

After this plan completes:
- You have a working Next.js + Supabase project on `main` with a passing test suite.
- Foundation tables, RLS, and triggers are in place and proven correct.
- The theme is wired and the dev experience works.
- **Plan 02 (Auth & Onboarding)** will build Google OAuth sign-in, the create-household and join-via-invite flows, and a settings shell.

Push to a GitHub remote whenever you want — nothing in this plan requires a remote yet.
