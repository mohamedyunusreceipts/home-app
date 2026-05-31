# Plan 02 — Auth & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Google OAuth sign-in, post-sign-in onboarding to create-or-join a household, an invite-link flow for the second person, and a minimal settings shell — so two people can complete the full sign-up flow and end up as co-members of a household.

**Architecture:** Supabase Auth handles the Google OAuth dance (PKCE flow); our `/auth/callback` route exchanges the code for a session. Onboarding state (no-session → no-household → has-household) is determined server-side per request via the existing middleware (`proxy.ts`) and redirect helpers in `lib/auth/`. Household creation and invite-acceptance go through SECURITY DEFINER Postgres RPCs (`public.create_household`, `public.generate_invite`, `public.accept_invite`) so the logic is atomic and policy-enforced at the DB layer, not the application layer. Drive integration is deliberately deferred to Plan 03 — household creation in Plan 02 leaves `drive_refresh_token_encrypted` and `drive_root_folder_id` NULL, and the settings page shows a "Drive not connected" banner that Plan 03 will wire up.

**Tech Stack:** Next.js 16 App Router (Server Components + Server Actions), TypeScript strict, Supabase Auth (`@supabase/ssr`), Postgres SECURITY DEFINER functions, ShadCN/UI (Card + Button + Input), Vitest integration tests against local Supabase.

**Prerequisites (Task 1 documents these — user does them in browser before any code lands):**
1. Google Cloud project with OAuth 2.0 Client ID configured.
2. Supabase Auth Google provider enabled (with the Google client ID + secret pasted in).
3. Supabase project Auth → URL Configuration updated with site URL + redirect allowlist.

---

## File Structure

| File | Responsibility |
|---|---|
| `docs/auth-setup.md` | One-time user actions for Google OAuth + Supabase configuration (Task 1) |
| `lib/auth/current-user.ts` | Server helper: `getCurrentUser()` returning `User | null` |
| `lib/auth/current-household.ts` | Server helper: `getCurrentHouseholdId()` returning `string | null` (queries `household_members` for `auth.uid()`) |
| `lib/auth/redirects.ts` | Server helpers: `requireUser()` (redirects to `/sign-in`), `requireHousehold()` (redirects to `/setup` if user has no membership) |
| `app/sign-in/page.tsx` | Public sign-in page rendering `SignInButton` |
| `app/sign-in/sign-in-button.tsx` | Client component: calls `supabase.auth.signInWithOAuth({ provider: 'google', ... })` |
| `app/auth/callback/route.ts` | GET route: exchanges OAuth `code` query param for a session via `supabase.auth.exchangeCodeForSession(code)`, redirects to `/` |
| `app/auth/sign-out/route.ts` | POST route: calls `supabase.auth.signOut()`, redirects to `/sign-in` |
| `app/page.tsx` | Server component: redirects to `/dashboard` (has-household) / `/setup` (signed in, no household) / `/sign-in` (anonymous) |
| `app/setup/page.tsx` | Server component: requires user; offers "Create household" or "Join via invite link" |
| `app/setup/create/page.tsx` | Server component rendering `CreateHouseholdForm` client component |
| `app/setup/create/create-form.tsx` | Client component: form posting to `createHouseholdAction` |
| `app/setup/create/actions.ts` | `'use server'` action calling `supabase.rpc('create_household', { p_name })` |
| `app/join/[token]/page.tsx` | Server component: looks up invite, shows accept screen, or redirects to sign-in carrying the token forward |
| `app/join/[token]/accept-form.tsx` | Client component: button posting to `acceptInviteAction` |
| `app/join/[token]/actions.ts` | `'use server'` action calling `supabase.rpc('accept_invite', { p_token })` |
| `app/dashboard/page.tsx` | Placeholder server component: requires user + household, shows household name + "Plan 04 dashboard coming soon" |
| `app/settings/page.tsx` | Server component: shows profile, household name, co-member (or "alone"), Drive status banner, invite-link card, sign-out form |
| `app/settings/invite-card.tsx` | Client component: shows existing invite link (with copy button) or "Generate invite" form posting to `generateInviteAction` |
| `app/settings/actions.ts` | `'use server'` actions: `generateInviteAction` (calls `supabase.rpc('generate_invite')`), `signOutAction` |
| `supabase/migrations/0006_create_household_rpc.sql` | `create_household(p_name text)` SECURITY DEFINER function |
| `supabase/migrations/0007_invite_rpcs.sql` | `generate_invite()` and `accept_invite(p_token text)` SECURITY DEFINER functions |
| `tests/integration/auth/create-household.test.ts` | Test `create_household` RPC works for authed user + idempotency + rejects unauthed |
| `tests/integration/auth/invite-flow.test.ts` | Test `generate_invite` and `accept_invite` happy path + invalid token + expired + already-used + max-2-members |
| `tests/integration/auth/e2e-onboarding.test.ts` | End-to-end DB flow: userA creates household, generates invite, userB accepts, both see household, RLS still isolates from a third household |

Conventions: all server actions in their own `actions.ts` file co-located with the page that uses them. Client components have explicit `'use client'` directives and minimal logic (they delegate to server actions for all state mutations).

---

## Task 1: Google OAuth + Supabase configuration documentation

**Files:**
- Create: `docs/auth-setup.md`

This task contains NO code — only documentation of the manual setup the user does in browser. The code in Tasks 2-14 assumes this setup is complete.

- [ ] **Step 1: Create `docs/auth-setup.md`**

```markdown
# Auth setup (one-time, manual)

This document captures the browser-only steps needed before the auth flow works end-to-end. None of these are committed to the repo; they're configuration on Google + Supabase.

## 1. Google Cloud Console — OAuth 2.0 Client

1. Go to https://console.cloud.google.com/ and create a new project (or reuse one): `home-app`.
2. **Configure the OAuth consent screen** at https://console.cloud.google.com/apis/credentials/consent:
   - User type: **External**
   - App name: `Home`
   - User support email: your email
   - Developer contact: your email
   - Scopes: leave default (the `openid`, `email`, `profile` scopes — we add `drive.file` later in Plan 03)
   - Test users: add both partner emails (until the app is verified by Google, only test users can sign in)
3. **Create OAuth Client ID** at https://console.cloud.google.com/apis/credentials:
   - Application type: **Web application**
   - Name: `home-app`
   - Authorized JavaScript origins:
     - `http://localhost:3000`
     - `https://home-app-livid.vercel.app`
   - Authorized redirect URIs (these are the SUPABASE callback URLs, not ours — Supabase brokers the OAuth handshake):
     - `http://127.0.0.1:54321/auth/v1/callback` (local Supabase)
     - `https://gcltdipgyioxumloqaiz.supabase.co/auth/v1/callback` (hosted Supabase)
4. Save → copy the **Client ID** and **Client Secret** into a safe place; you'll paste them into Supabase next.

## 2. Supabase — Enable Google provider

For BOTH the local Supabase and the hosted project.

### Hosted (`gcltdipgyioxumloqaiz`)
1. Go to https://supabase.com/dashboard/project/gcltdipgyioxumloqaiz/auth/providers
2. Find **Google** in the provider list → toggle ON.
3. Paste the Client ID and Client Secret from step 1.
4. **Skip** "Authorize Google client ID" (we want sign-in, not just on-page auth).
5. Save.

### Hosted — URL Configuration
1. Go to https://supabase.com/dashboard/project/gcltdipgyioxumloqaiz/auth/url-configuration
2. **Site URL:** `https://home-app-livid.vercel.app`
3. **Redirect URLs (allowlist):**
   - `http://localhost:3000/**`
   - `https://home-app-livid.vercel.app/**`
4. Save.

### Local Supabase
Edit `supabase/config.toml`. Find the `[auth.external.google]` block and set:
```toml
[auth.external.google]
enabled = true
client_id = "env(GOOGLE_OAUTH_CLIENT_ID)"
secret = "env(GOOGLE_OAUTH_CLIENT_SECRET)"
redirect_uri = "http://127.0.0.1:54321/auth/v1/callback"
```

Then add the credentials to `.env.local`:
```
GOOGLE_OAUTH_CLIENT_ID=<from step 1>
GOOGLE_OAUTH_CLIENT_SECRET=<from step 1>
```

Restart local Supabase to pick up the config:
```bash
npx supabase stop
npx supabase start
```

For Vercel, set the same two env vars in the dashboard (Settings → Environment Variables → add for all environments). These aren't strictly needed by the Next.js app yet (Plan 03 uses them for Drive scope upgrade), but having them set early avoids surprises.

## 3. Test the configuration

After the code lands in Tasks 3-4, you can verify by:
1. Visiting http://localhost:3000/sign-in
2. Clicking "Sign in with Google"
3. Completing the Google consent screen (must be one of the test users you added)
4. Landing back on http://localhost:3000/ as a signed-in user (visible by checking `supabase.auth.getUser()` returns non-null, or by the redirect to /setup)

If you get "redirect_uri_mismatch" from Google — your authorized redirect URI in step 1.3 doesn't match what Supabase is sending. Double-check the URL exactly (no trailing slash, correct port).
```

- [ ] **Step 2: Commit**

```bash
git add docs/auth-setup.md
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "docs: Google OAuth + Supabase provider setup checklist"
```

**Note for the implementer:** this task has no executable verification — you can only verify the prerequisites have been done by trying to sign in (Task 3+). Move forward; the user is doing this setup in parallel.

---

## Task 2: Auth helpers + redirect utilities

**Files:**
- Create: `lib/auth/current-user.ts`
- Create: `lib/auth/current-household.ts`
- Create: `lib/auth/redirects.ts`

- [ ] **Step 1: Create `lib/auth/current-user.ts`**

```ts
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

/**
 * Returns the currently signed-in Supabase user, or null if not signed in.
 * Reads the session from the cookies attached to the current request.
 * Server-only — do not call from client components.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}
```

- [ ] **Step 2: Create `lib/auth/current-household.ts`**

```ts
import { createClient } from '@/lib/supabase/server'

/**
 * Returns the household_id the current user is a member of, or null if:
 * - the user isn't signed in, or
 * - the user has no household membership yet (pre-onboarding).
 *
 * The RLS policies on household_members ensure the user only sees their own row.
 * If the query returns multiple rows (shouldn't happen — one user per household in v1),
 * returns the first.
 */
export async function getCurrentHouseholdId(): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('household_members')
    .select('household_id')
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return data.household_id
}
```

- [ ] **Step 3: Create `lib/auth/redirects.ts`**

```ts
import { redirect } from 'next/navigation'
import { getCurrentUser } from './current-user'
import { getCurrentHouseholdId } from './current-household'

/**
 * Returns the signed-in user, or redirects to `/sign-in` if anonymous.
 * For use at the top of any server component that requires auth.
 */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  return user
}

/**
 * Returns the user + their household_id, or:
 * - redirects to `/sign-in` if anonymous
 * - redirects to `/setup` if signed in but no household
 */
export async function requireHousehold() {
  const user = await requireUser()
  const householdId = await getCurrentHouseholdId()
  if (!householdId) redirect('/setup')
  return { user, householdId }
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): current-user, current-household, and require-* helpers"
```

---

## Task 3: Sign-in page with Google button

**Files:**
- Create: `app/sign-in/page.tsx`
- Create: `app/sign-in/sign-in-button.tsx`

- [ ] **Step 1: Create `app/sign-in/sign-in-button.tsx` (client component)**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function SignInButton() {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setPending(false)
      console.error('Sign-in failed', error)
      alert(`Sign-in failed: ${error.message}`)
    }
    // On success, the browser navigates away to Google's OAuth page;
    // there's nothing to do here.
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? 'Redirecting…' : 'Sign in with Google'}
    </Button>
  )
}
```

- [ ] **Step 2: Create `app/sign-in/page.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInButton } from './sign-in-button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

export default async function SignInPage() {
  // If already signed in, bounce to home (which routes to setup or dashboard).
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Welcome home
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            Shared home management for couples. Sign in with the Google account you want
            tied to your household.
          </p>
          <SignInButton />
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Verify the page renders (no Google sign-in completion needed)**

Start the dev server and visit http://localhost:3000/sign-in.

```bash
npm run dev
```

Expected:
- Cream background, terracotta "Welcome home" heading
- Sage paragraph
- Terracotta "Sign in with Google" button
- Clicking the button (you don't have to complete the OAuth) should start a redirect — if everything is wired correctly in Task 1, you'll land on a Google consent screen. If you see an error, it'll typically be "provider not enabled" (Task 1 setup is incomplete) or a "redirect_uri_mismatch" (Google client config doesn't match Supabase callback URL).

Kill the dev server.

- [ ] **Step 5: Commit**

```bash
git add app/sign-in/
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): sign-in page with Google OAuth button"
```

---

## Task 4: Auth callback route

After Supabase finishes the OAuth handshake with Google, it redirects to our `/auth/callback?code=...&next=...`. This route exchanges the code for a session (PKCE flow) and redirects to the destination.

**Files:**
- Create: `app/auth/callback/route.ts`

- [ ] **Step 1: Create `app/auth/callback/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    )
  }

  // Validate `next` is a relative path; reject open-redirects.
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'
  return NextResponse.redirect(`${origin}${safeNext}`)
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Manual smoke test (only possible if Task 1 setup is done)**

Start `npm run dev`. Visit http://localhost:3000/sign-in. Click "Sign in with Google". Complete the consent screen. You should be redirected back to http://localhost:3000/ (which currently 404s — Task 6 fixes that). If you instead land on `/sign-in?error=...`, read the error. Common ones:
- `missing_code`: Supabase didn't send us a code — provider misconfiguration.
- `invalid_grant`: the code expired or was already used.
- `flow_state_not_found`: cookie-based PKCE state is missing — middleware (proxy.ts) might not be running. Verify by visiting any page that hits the proxy first.

Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/auth/callback/route.ts
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): OAuth callback route exchanges code for session"
```

---

## Task 5: Sign-out route

**Files:**
- Create: `app/auth/sign-out/route.ts`

- [ ] **Step 1: Create `app/auth/sign-out/route.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const { origin } = new URL(request.url)
  return NextResponse.redirect(`${origin}/sign-in`, { status: 303 })
}
```

(`303 See Other` ensures the browser follows with GET after the POST.)

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/auth/sign-out/route.ts
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): sign-out POST route clears session"
```

---

## Task 6: Root page redirect logic

The current `app/page.tsx` shows a placeholder card. Replace it with redirect logic based on auth + household state.

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getCurrentHouseholdId } from '@/lib/auth/current-household'

export default async function HomePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const householdId = await getCurrentHouseholdId()
  if (!householdId) redirect('/setup')

  redirect('/dashboard')
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Manual smoke test**

Start `npm run dev`. Visit http://localhost:3000/. You should be redirected to `/sign-in` (since you're not signed in). Kill the dev server.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat: root page redirects based on auth + household state"
```

---

## Task 7: `create_household` RPC (TDD)

A SECURITY DEFINER function that atomically creates a `households` row and the owner's `household_members` row. Using an RPC instead of two separate inserts ensures atomicity (both succeed or both fail) and avoids RLS-policy gymnastics for the bootstrap insert (the table has no INSERT policy for authenticated users by design).

**Files:**
- Create: `supabase/migrations/0006_create_household_rpc.sql`
- Create: `tests/integration/auth/create-household.test.ts`

- [ ] **Step 1: Write the failing test FIRST**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, serviceClient, resetDatabase } from '@/tests/helpers/supabase'

describe('create_household RPC', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('creates a household and adds the caller as owner', async () => {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)

    const { data, error } = await client.rpc('create_household', {
      p_name: 'Cosy Place',
    })

    expect(error).toBeNull()
    expect(data).toBeTypeOf('string') // returns the new household_id (uuid)

    const service = serviceClient()
    const { data: household } = await service
      .from('households')
      .select('*')
      .eq('id', data!)
      .single()

    expect(household).toMatchObject({
      name: 'Cosy Place',
      owner_user_id: user.id,
      currency: 'ZAR',
    })

    const { data: members } = await service
      .from('household_members')
      .select('*')
      .eq('household_id', data!)

    expect(members).toHaveLength(1)
    expect(members![0]).toMatchObject({
      household_id: data!,
      user_id: user.id,
      role: 'owner',
    })
  })

  it('rejects an empty household name', async () => {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)

    const { error } = await client.rpc('create_household', { p_name: '' })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/name/i)
  })

  it('rejects a call from an unauthenticated client', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { error } = await anonClient.rpc('create_household', { p_name: 'X' })

    expect(error).not.toBeNull()
  })

  it('rejects a second household for the same user', async () => {
    const user = await createTestUser()
    const client = await authedClient(user.email, user.password)

    const { error: firstError } = await client.rpc('create_household', {
      p_name: 'First',
    })
    expect(firstError).toBeNull()

    const { error: secondError } = await client.rpc('create_household', {
      p_name: 'Second',
    })
    expect(secondError).not.toBeNull()
    expect(secondError!.message).toMatch(/already.*household|already a member/i)
  })
})
```

- [ ] **Step 2: Run the test — expect FAIL**

```powershell
npm test -- tests/integration/auth/create-household.test.ts
```

Expected: all 4 tests FAIL because `create_household` RPC doesn't exist yet. Error will mention `Could not find the function public.create_household` or PGRST202.

- [ ] **Step 3: Write the migration `supabase/migrations/0006_create_household_rpc.sql`**

```sql
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
```

- [ ] **Step 4: Apply the migration locally**

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
npx supabase migration up --local
```

Expected: "Applied migration 0006_create_household_rpc.sql".

- [ ] **Step 5: Re-run the test — expect PASS**

```powershell
npm test -- tests/integration/auth/create-household.test.ts
```

Expected: 4 passed.

- [ ] **Step 6: Run all tests to confirm no regression**

```powershell
npm test
```

Expected: 6 test files / 13 tests passed (foundation 9 + auth 4).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0006_create_household_rpc.sql tests/integration/auth/create-household.test.ts
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(db): create_household RPC + integration tests"
```

---

## Task 8: Setup chooser page

**Files:**
- Create: `app/setup/page.tsx`

- [ ] **Step 1: Create `app/setup/page.tsx`**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireUser } from '@/lib/auth/redirects'
import { getCurrentHouseholdId } from '@/lib/auth/current-household'

export default async function SetupPage() {
  await requireUser()
  // If already in a household, skip setup.
  const householdId = await getCurrentHouseholdId()
  if (householdId) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Set up your household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sage-700">
            Two ways to start: create a new household, or join the one your partner
            already created using their invite link.
          </p>

          <div className="space-y-3">
            <Link href="/setup/create" className="block">
              <Button className="w-full">Create a new household</Button>
            </Link>
            <p className="text-sm text-sage-600 text-center">
              Or paste the invite link your partner shared with you into your browser to
              join their household.
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/setup/page.tsx
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): /setup chooser page (create or join)"
```

---

## Task 9: Create-household page + form + server action

**Files:**
- Create: `app/setup/create/page.tsx`
- Create: `app/setup/create/create-form.tsx`
- Create: `app/setup/create/actions.ts`

- [ ] **Step 1: Create `app/setup/create/actions.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type CreateHouseholdResult = { error: string } | { success: true }

export async function createHouseholdAction(formData: FormData): Promise<CreateHouseholdResult> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: 'Please enter a household name.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('create_household', { p_name: name })

  if (error) {
    if (error.message.match(/already a member/i)) {
      // Edge case — race or stale UI. Bounce to dashboard.
      redirect('/dashboard')
    }
    return { error: error.message }
  }

  redirect('/dashboard')
}
```

- [ ] **Step 2: Create `app/setup/create/create-form.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { createHouseholdAction } from './actions'

export function CreateHouseholdForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await createHouseholdAction(formData)
    if (result && 'error' in result) {
      setError(result.error)
      setPending(false)
    }
    // On success the action redirects, so this component unmounts.
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-sage-800">
          Household name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          maxLength={80}
          placeholder="e.g. Our Place"
          className="w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200"
          disabled={pending}
        />
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Creating…' : 'Create household'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/setup/create/page.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/redirects'
import { getCurrentHouseholdId } from '@/lib/auth/current-household'
import { CreateHouseholdForm } from './create-form'

export default async function CreateHouseholdPage() {
  await requireUser()
  const householdId = await getCurrentHouseholdId()
  if (householdId) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Create your household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            You can rename it later from settings.
          </p>
          <CreateHouseholdForm />
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/setup/create/
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): create-household page, form, and server action"
```

---

## Task 10: `generate_invite` and `accept_invite` RPCs (TDD)

Two RPCs:
- `generate_invite()` — caller must be a household member. Deletes any existing unused invite for that household (so there's always at most one active), then inserts a fresh one with a random URL-safe token and 24h expiry. Returns the token string.
- `accept_invite(p_token text)` — caller must be authenticated. Validates the token (exists, not used, not expired, household still has fewer than 2 members, caller isn't already a member of any household). Inserts caller as `partner`, marks invite as used. Returns the household_id.

**Files:**
- Create: `supabase/migrations/0007_invite_rpcs.sql`
- Create: `tests/integration/auth/invite-flow.test.ts`

- [ ] **Step 1: Write the failing test FIRST**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, serviceClient, resetDatabase } from '@/tests/helpers/supabase'

describe('invite RPCs', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  async function setupOwnerWithHousehold() {
    const owner = await createTestUser()
    const ownerClient = await authedClient(owner.email, owner.password)
    const { data: householdId, error } = await ownerClient.rpc('create_household', {
      p_name: 'Test Home',
    })
    expect(error).toBeNull()
    return { owner, ownerClient, householdId: householdId as string }
  }

  it('owner can generate an invite token', async () => {
    const { ownerClient, householdId } = await setupOwnerWithHousehold()

    const { data: token, error } = await ownerClient.rpc('generate_invite')

    expect(error).toBeNull()
    expect(token).toBeTypeOf('string')
    expect((token as string).length).toBeGreaterThanOrEqual(16)

    const service = serviceClient()
    const { data: invite } = await service
      .from('invites')
      .select('*')
      .eq('token', token!)
      .single()

    expect(invite).toMatchObject({
      household_id: householdId,
      used_at: null,
    })
  })

  it('generating a second invite replaces the first (only one active at a time)', async () => {
    const { ownerClient, householdId } = await setupOwnerWithHousehold()

    const { data: token1 } = await ownerClient.rpc('generate_invite')
    const { data: token2 } = await ownerClient.rpc('generate_invite')

    expect(token1).not.toBe(token2)

    const service = serviceClient()
    const { data: invites } = await service
      .from('invites')
      .select('*')
      .eq('household_id', householdId)

    expect(invites).toHaveLength(1)
    expect(invites![0].token).toBe(token2)
  })

  it('a non-member cannot generate an invite for any household', async () => {
    await setupOwnerWithHousehold()

    const stranger = await createTestUser()
    const strangerClient = await authedClient(stranger.email, stranger.password)

    const { error } = await strangerClient.rpc('generate_invite')

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/not a member|household/i)
  })

  it('partner can accept a valid invite and becomes a member', async () => {
    const { ownerClient, householdId } = await setupOwnerWithHousehold()
    const { data: token } = await ownerClient.rpc('generate_invite')

    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)

    const { data: returnedHouseholdId, error } = await partnerClient.rpc(
      'accept_invite',
      { p_token: token! },
    )

    expect(error).toBeNull()
    expect(returnedHouseholdId).toBe(householdId)

    const service = serviceClient()
    const { data: members } = await service
      .from('household_members')
      .select('*')
      .eq('household_id', householdId)
      .order('role')

    expect(members).toHaveLength(2)
    expect(members!.map(m => m.role).sort()).toEqual(['owner', 'partner'])

    const { data: invite } = await service.from('invites').select('*').eq('token', token!).single()
    expect(invite!.used_at).not.toBeNull()
    expect(invite!.used_by_user_id).toBe(partner.id)
  })

  it('a used invite cannot be accepted again', async () => {
    const { ownerClient } = await setupOwnerWithHousehold()
    const { data: token } = await ownerClient.rpc('generate_invite')

    const partner1 = await createTestUser()
    const partner1Client = await authedClient(partner1.email, partner1.password)
    await partner1Client.rpc('accept_invite', { p_token: token! })

    const partner2 = await createTestUser()
    const partner2Client = await authedClient(partner2.email, partner2.password)
    const { error } = await partner2Client.rpc('accept_invite', { p_token: token! })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/used|invalid|expired/i)
  })

  it('an expired invite cannot be accepted', async () => {
    const { householdId, owner } = await setupOwnerWithHousehold()
    const service = serviceClient()
    // Insert an already-expired invite directly.
    await service.from('invites').insert({
      token: 'expired-token-xyz',
      household_id: householdId,
      created_by: owner.id,
      expires_at: new Date(Date.now() - 60_000).toISOString(),
    })

    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)
    const { error } = await partnerClient.rpc('accept_invite', { p_token: 'expired-token-xyz' })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/expired|invalid/i)
  })

  it('an unknown token is rejected', async () => {
    const partner = await createTestUser()
    const partnerClient = await authedClient(partner.email, partner.password)
    const { error } = await partnerClient.rpc('accept_invite', { p_token: 'does-not-exist' })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/invalid|not found|unknown/i)
  })

  it('a user who is already in a household cannot accept an invite to another', async () => {
    const { ownerClient } = await setupOwnerWithHousehold()
    const { data: token } = await ownerClient.rpc('generate_invite')

    // Second user creates their own household first.
    const other = await createTestUser()
    const otherClient = await authedClient(other.email, other.password)
    await otherClient.rpc('create_household', { p_name: 'Other Home' })

    // Now they try to accept household 1's invite.
    const { error } = await otherClient.rpc('accept_invite', { p_token: token! })

    expect(error).not.toBeNull()
    expect(error!.message).toMatch(/already a member|already in a household/i)
  })
})
```

- [ ] **Step 2: Run the test — expect FAIL**

```powershell
npm test -- tests/integration/auth/invite-flow.test.ts
```

Expected: all 8 tests FAIL because RPCs don't exist yet.

- [ ] **Step 3: Write the migration `supabase/migrations/0007_invite_rpcs.sql`**

```sql
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
```

- [ ] **Step 4: Apply migration locally**

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
npx supabase migration up --local
```

Expected: "Applied migration 0007_invite_rpcs.sql".

- [ ] **Step 5: Re-run the test — expect all 8 PASS**

```powershell
npm test -- tests/integration/auth/invite-flow.test.ts
```

Expected: 8 passed. If "an expired invite cannot be accepted" fails because the manual invite insert is rejected by RLS (we set RLS to require `created_by = auth.uid()` for inserts but service client bypasses RLS), that's still fine — service role bypasses RLS by design.

- [ ] **Step 6: Run all tests to confirm no regression**

```powershell
npm test
```

Expected: 7 test files / 21 tests passed.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0007_invite_rpcs.sql tests/integration/auth/invite-flow.test.ts
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(db): generate_invite + accept_invite RPCs with integration tests"
```

---

## Task 11: Settings page + invite link UI

**Files:**
- Create: `app/settings/page.tsx`
- Create: `app/settings/invite-card.tsx`
- Create: `app/settings/actions.ts`

- [ ] **Step 1: Create `app/settings/actions.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function generateInviteAction(): Promise<{ error: string } | { token: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('generate_invite')
  if (error) return { error: error.message }
  return { token: data as string }
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/sign-in')
}
```

- [ ] **Step 2: Create `app/settings/invite-card.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { generateInviteAction } from './actions'

export function InviteCard({
  appOrigin,
  initialToken,
}: {
  appOrigin: string
  initialToken: string | null
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [copied, setCopied] = useState(false)

  const inviteUrl = token ? `${appOrigin}/join/${token}` : null

  async function handleGenerate() {
    setPending(true)
    setError(null)
    const result = await generateInviteAction()
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setToken(result.token)
    setCopied(false)
  }

  async function handleCopy() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {inviteUrl ? (
        <>
          <p className="text-sm text-sage-700">
            Share this link with your partner. It expires in 24 hours and can only be
            used once.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sm text-sage-900"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button variant="outline" onClick={handleCopy}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <Button onClick={handleGenerate} disabled={pending} variant="outline">
            {pending ? 'Regenerating…' : 'Regenerate link'}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-sage-700">
            Generate a single-use invite link to add your partner to the household.
          </p>
          <Button onClick={handleGenerate} disabled={pending}>
            {pending ? 'Generating…' : 'Generate invite link'}
          </Button>
        </>
      )}
      {error && <p className="text-sm text-terracotta-700">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: Create `app/settings/page.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { headers } from 'next/headers'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { InviteCard } from './invite-card'
import { signOutAction } from './actions'

export default async function SettingsPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const [{ data: household }, { data: members }, { data: existingInvite }] = await Promise.all([
    supabase.from('households').select('name, drive_root_folder_id').eq('id', householdId).single(),
    supabase.from('household_members').select('user_id, role').eq('household_id', householdId),
    supabase
      .from('invites')
      .select('token')
      .eq('household_id', householdId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
  ])

  const hasPartner = (members?.length ?? 0) >= 2
  const driveConnected = Boolean(household?.drive_root_folder_id)

  // Build the app origin from the incoming request headers. Avoids hardcoding the URL.
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  const appOrigin = `${proto}://${host}`

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sage-800">
            <p>{user.email}</p>
            <form action={signOutAction} className="pt-3">
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Household</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sage-800">
            <p>
              <span className="font-medium">Name:</span> {household?.name ?? '—'}
            </p>
            <p>
              <span className="font-medium">Members:</span>{' '}
              {hasPartner ? '2 of 2 (full)' : '1 of 2 (waiting for partner)'}
            </p>
          </CardContent>
        </Card>

        {!hasPartner && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">Invite your partner</CardTitle>
            </CardHeader>
            <CardContent>
              <InviteCard appOrigin={appOrigin} initialToken={existingInvite?.token ?? null} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Google Drive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sage-800">
            {driveConnected ? (
              <p>Connected. Files are stored in your Drive under /HomeApp/.</p>
            ) : (
              <>
                <p>Drive is not connected yet. Document and image uploads will be enabled once you connect.</p>
                <p className="text-sm text-sage-600">
                  Drive connection is added in the next phase of the build.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/settings/
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): settings page with invite UI and sign-out"
```

---

## Task 12: Join invite page + acceptance flow

**Files:**
- Create: `app/join/[token]/page.tsx`
- Create: `app/join/[token]/accept-form.tsx`
- Create: `app/join/[token]/actions.ts`

- [ ] **Step 1: Create `app/join/[token]/actions.ts`**

```ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function acceptInviteAction(formData: FormData): Promise<{ error: string }> {
  const token = String(formData.get('token') ?? '')
  if (!token) return { error: 'Missing invite token.' }

  const supabase = await createClient()
  const { error } = await supabase.rpc('accept_invite', { p_token: token })

  if (error) return { error: error.message }

  redirect('/dashboard')
}
```

- [ ] **Step 2: Create `app/join/[token]/accept-form.tsx`**

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { acceptInviteAction } from './actions'

export function AcceptInviteForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await acceptInviteAction(formData)
    if (result?.error) {
      setError(result.error)
      setPending(false)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Joining…' : 'Accept invite'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 3: Create `app/join/[token]/page.tsx`**

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { AcceptInviteForm } from './accept-form'

export default async function JoinInvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const user = await getCurrentUser()

  // Anonymous visitors are sent to sign in; preserve the invite token via `next`.
  if (!user) {
    redirect(`/sign-in?next=${encodeURIComponent(`/join/${token}`)}`)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Join the household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            You've been invited to join a household on Home. Accepting will add you as
            the partner.
          </p>
          <AcceptInviteForm token={token} />
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 4: Update `app/auth/callback/route.ts` to honour the `next` query param when the URL is `/join/<token>`**

The existing callback already supports `next`; verify by reading the file. If the OAuth redirect is started from `/join/<token>` with `redirectTo: ${origin}/auth/callback?next=/join/<token>`, the SignInButton needs to know to include `next`. Update `app/sign-in/page.tsx` to read `?next=` from search params and pass it to the SignInButton.

Replace `app/sign-in/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SignInButton } from './sign-in-button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { next, error } = await searchParams
  const user = await getCurrentUser()
  if (user) redirect(next && next.startsWith('/') ? next : '/')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Welcome home
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            Shared home management for couples. Sign in with the Google account you want
            tied to your household.
          </p>
          {error && (
            <p className="text-sm text-terracotta-700" role="alert">
              {decodeURIComponent(error)}
            </p>
          )}
          <SignInButton nextPath={next} />
        </CardContent>
      </Card>
    </main>
  )
}
```

And update `app/sign-in/sign-in-button.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'

export function SignInButton({ nextPath }: { nextPath?: string }) {
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    const supabase = createClient()
    const callbackParams = new URLSearchParams()
    if (nextPath && nextPath.startsWith('/')) callbackParams.set('next', nextPath)
    const callbackUrl = `${window.location.origin}/auth/callback${
      callbackParams.toString() ? '?' + callbackParams.toString() : ''
    }`
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    })
    if (error) {
      setPending(false)
      alert(`Sign-in failed: ${error.message}`)
    }
  }

  return (
    <Button onClick={handleClick} disabled={pending}>
      {pending ? 'Redirecting…' : 'Sign in with Google'}
    </Button>
  )
}
```

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/join/ app/sign-in/
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): /join/[token] page + carry next param through sign-in"
```

---

## Task 13: Dashboard placeholder

A minimal authenticated dashboard so the redirect chain has a destination. Plan 04 builds the real dashboard.

**Files:**
- Create: `app/dashboard/page.tsx`

- [ ] **Step 1: Create `app/dashboard/page.tsx`**

```tsx
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .single()

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">
            {household?.name ?? 'Home'}
          </h1>
          <Link href="/settings">
            <Button variant="outline">Settings</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Welcome, {user.email}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sage-700">
            <p>
              You're signed in and your household is set up. The full dashboard — meals,
              bills, chores, calendar — is being built next.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "feat(auth): minimal dashboard placeholder"
```

---

## Task 14: End-to-end onboarding integration test

A single test that runs the full happy path at the database level: userA creates household, generates invite, userB accepts. Then verify RLS still isolates a third household.

**Files:**
- Create: `tests/integration/auth/e2e-onboarding.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createTestUser, authedClient, serviceClient, resetDatabase } from '@/tests/helpers/supabase'

describe('e2e onboarding flow', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('two users complete create + invite + accept and end up co-members', async () => {
    // userA signs up and creates a household
    const userA = await createTestUser()
    const clientA = await authedClient(userA.email, userA.password)

    const { data: householdId } = await clientA.rpc('create_household', {
      p_name: 'A and B',
    })
    expect(householdId).toBeTypeOf('string')

    // userA generates an invite
    const { data: token } = await clientA.rpc('generate_invite')
    expect(token).toBeTypeOf('string')

    // userB signs up and accepts the invite
    const userB = await createTestUser()
    const clientB = await authedClient(userB.email, userB.password)

    const { data: acceptedHouseholdId, error: acceptErr } = await clientB.rpc(
      'accept_invite',
      { p_token: token! },
    )
    expect(acceptErr).toBeNull()
    expect(acceptedHouseholdId).toBe(householdId)

    // Both users can see the household via RLS
    const { data: householdsA } = await clientA.from('households').select('*')
    const { data: householdsB } = await clientB.from('households').select('*')
    expect(householdsA).toHaveLength(1)
    expect(householdsB).toHaveLength(1)
    expect(householdsA![0].id).toBe(householdId)
    expect(householdsB![0].id).toBe(householdId)

    // Both see the same 2 members
    const { data: membersA } = await clientA.from('household_members').select('*')
    const { data: membersB } = await clientB.from('household_members').select('*')
    expect(membersA).toHaveLength(2)
    expect(membersB).toHaveLength(2)

    // Both see both profiles
    const { data: profilesA } = await clientA.from('profiles').select('id')
    expect(profilesA!.map(p => p.id).sort()).toEqual([userA.id, userB.id].sort())
  })

  it('a third user creating their own household is isolated', async () => {
    // First couple
    const userA = await createTestUser()
    const clientA = await authedClient(userA.email, userA.password)
    const { data: householdAB } = await clientA.rpc('create_household', { p_name: 'AB' })
    const { data: tokenAB } = await clientA.rpc('generate_invite')
    const userB = await createTestUser()
    const clientB = await authedClient(userB.email, userB.password)
    await clientB.rpc('accept_invite', { p_token: tokenAB! })

    // Third user creates a separate household
    const userC = await createTestUser()
    const clientC = await authedClient(userC.email, userC.password)
    const { data: householdC } = await clientC.rpc('create_household', { p_name: 'C alone' })

    // userC cannot see household AB
    const { data: householdsC } = await clientC.from('households').select('*')
    expect(householdsC).toHaveLength(1)
    expect(householdsC![0].id).toBe(householdC)

    // userA cannot see userC's household
    const { data: householdsA } = await clientA.from('households').select('*')
    expect(householdsA!.find(h => h.id === householdC)).toBeUndefined()

    // userA cannot see userC's profile
    const { data: profilesA } = await clientA.from('profiles').select('id')
    expect(profilesA!.map(p => p.id).sort()).toEqual([userA.id, userB.id].sort())
    expect(profilesA!.find(p => p.id === userC.id)).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test**

```powershell
npm test -- tests/integration/auth/e2e-onboarding.test.ts
```

Expected: 2 passed.

- [ ] **Step 3: Run the full suite for a final check**

```powershell
npm test
```

Expected: 8 test files / 23 tests passed (foundation 9 + create-household 4 + invite-flow 8 + e2e-onboarding 2).

- [ ] **Step 4: Typecheck + lint + build**

```powershell
npx tsc --noEmit
npm run lint
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"; npm run build
```

All three should pass cleanly.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/auth/e2e-onboarding.test.ts
git -c user.email=rayhaan.yunus@nutecdigital.com -c user.name="Rayhaan Yunus" \
  commit -m "test(auth): e2e onboarding flow + cross-household isolation"
```

---

## Task 15: Push migrations to hosted Supabase + manual production smoke test

**Files:** none (operations task)

- [ ] **Step 1: Push the 2 new migrations to hosted Supabase**

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
$env:SUPABASE_ACCESS_TOKEN = "<read from .env.production.local>"
$env:SUPABASE_DB_PASSWORD = "<read from .env.production.local>"
echo "y" | npx supabase db push --password "$env:SUPABASE_DB_PASSWORD"
```

Expected: "Applying migration 0006_create_household_rpc.sql..." then "Applying migration 0007_invite_rpcs.sql..." then "Finished supabase db push."

(For the implementer running this: read the two values from `.env.production.local` — it's gitignored and contains `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`. Do not echo them anywhere or include in your report.)

- [ ] **Step 2: Manual smoke test on production**

Open https://home-app-livid.vercel.app/ in a private browser window.

Expected sequence:
1. Lands on `/sign-in` (because not signed in).
2. Click "Sign in with Google" → Google consent screen.
3. Complete consent → land back on `/setup` (signed in, no household yet).
4. Click "Create a new household" → name it (e.g. "Test home").
5. Submit → land on `/dashboard` showing the household name + your email.
6. Visit `/settings` → see profile + household + "1 of 2 members" + "Generate invite link" button.
7. Click "Generate invite link" → URL appears.
8. Open invite URL in a second private window → sign in as the second test user → accept invite → both end up co-members.

If any step fails, note the URL + error before bailing.

If everything works, manually clean up the test household (it's polluting production data):

```powershell
$env:PATH = "C:\Program Files\Docker\Docker\resources\bin;$env:PATH"
# psql one-liner — delete the test household; cascade handles members + invites
$env:PGPASSWORD = "<DB password from .env.production.local>"
psql "postgresql://postgres.gcltdipgyioxumloqaiz@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" -c "delete from public.households where name = 'Test home';"
# Also delete the test users from auth.users (cascades to profiles)
# Use the Supabase dashboard for this: https://supabase.com/dashboard/project/gcltdipgyioxumloqaiz/auth/users
```

(The connection string format for the pooler is `postgresql://postgres.<project_ref>@<pooler-host>:5432/postgres`. The hosted Supabase dashboard's Database settings page shows the exact string.)

- [ ] **Step 3: Mark plan complete in commit message (no actual commit needed)**

Plan 02 is operationally complete. No commit for this task — the migration push and smoke test are runtime operations, not code changes.

---

## What's next

After this plan completes:
- Users can sign in with Google, create or join a household, and reach a placeholder dashboard.
- The household has `drive_refresh_token_encrypted` and `drive_root_folder_id` columns sitting NULL — those are populated by Plan 03 (Drive adapter).
- The settings page already shows a "Drive not connected" placeholder that Plan 03 will replace with a "Connect Drive" button.
- Plan 03 will: implement the OAuth scope upgrade flow for the household owner (re-request consent with `drive.file` scope), encrypt and store the refresh token, create the `/HomeApp/` root folder, and expose an upload/download/list API the modules in Plans 06+ will consume.
