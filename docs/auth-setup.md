# Auth setup (one-time, manual)

This document captures the browser-only steps needed before the Google OAuth sign-in flow works end-to-end. None of these are committed to the repo as code — they're configuration on Google, Supabase, and Vercel.

The code in Plan 02 (and later plans) assumes this setup is complete.

## 1. Google Cloud Console — OAuth 2.0 Client

### 1.1 Create the project

1. Go to https://console.cloud.google.com/
2. Top bar → project dropdown → **New Project**
3. Name: `home-app` → **Create**
4. Switch to the new project once it's created

### 1.2 Configure the OAuth consent screen

Google's UI changed in 2024. You'll see one of two layouts.

**New UI (sidebar tabs: Overview / Audience / Branding / Clients / Data access):**

- **Branding** — App name `Home`, user support email and developer contact = your email. Save.
- **Audience** — Confirm **External** user type. Scroll to **Test users**, add both partner Gmail addresses. Save.
- **Data access** — leave empty. We don't pre-declare scopes; Supabase requests them at OAuth time. Adding here just adds verification friction.

**Classic stepped wizard:**

1. **External** user type → **Create**
2. **App name** `Home`, **user support email** your email, **developer contact** your email. Skip the rest. **Save and continue**
3. **Scopes** step — **Save and continue** without adding any.
4. **Test users** — add both partner Gmail addresses. **Save and continue**
5. **Summary** → **Back to Dashboard**

Until Google verifies the app, only test users can complete the sign-in flow.

### 1.3 Create the OAuth 2.0 Client ID

1. Go to https://console.cloud.google.com/apis/credentials
2. **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**, name: `home-app`
4. **Authorized JavaScript origins** — add:
   - `http://localhost:3000`
   - `https://home-app-livid.vercel.app`
5. **Authorized redirect URIs** — these are the SUPABASE callback URLs, not the app's. Supabase brokers the OAuth handshake. Add:
   - `http://127.0.0.1:54321/auth/v1/callback` (local Supabase)
   - `https://gcltdipgyioxumloqaiz.supabase.co/auth/v1/callback` (hosted Supabase)
6. **Create**. The modal shows your **Client ID** and **Client Secret**. **Copy both immediately** — the secret is only shown once.

## 2. Supabase — Enable Google provider

For BOTH the local Supabase and the hosted project.

### 2.1 Hosted (`gcltdipgyioxumloqaiz`)

**Provider config:**

1. Go to https://supabase.com/dashboard/project/gcltdipgyioxumloqaiz/auth/providers
2. Find **Google** in the provider list → toggle ON.
3. Paste the **Client ID** and **Client Secret** from step 1.3.
4. Leave "Authorize Google client ID" off (we want sign-in, not just on-page auth).
5. Save.

**URL configuration:**

1. Go to https://supabase.com/dashboard/project/gcltdipgyioxumloqaiz/auth/url-configuration
2. **Site URL:** `https://home-app-livid.vercel.app`
3. **Redirect URLs (allowlist):**
   - `http://localhost:3000/**`
   - `https://home-app-livid.vercel.app/**`
4. Save.

### 2.2 Local Supabase

Already done in this repo:

- `supabase/config.toml` has an `[auth.external.google]` block with `client_id = "env(GOOGLE_OAUTH_CLIENT_ID)"` and `secret = "env(GOOGLE_OAUTH_CLIENT_SECRET)"`.
- `.env.local` has `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` populated. (`.env.local` is gitignored.)
- After editing either, restart local Supabase:
  ```bash
  npx supabase stop
  npx supabase start
  ```
  Confirm with `npx supabase status` — there's no provider list in the output but the kong logs at startup will mention `google` provider initialization.

## 3. Vercel — Production environment variables

1. Go to https://vercel.com → home-app project → **Settings** → **Environment Variables**.
2. Add for all environments (Production, Preview, Development):
   - `GOOGLE_OAUTH_CLIENT_ID` = the client ID from step 1.3
   - `GOOGLE_OAUTH_CLIENT_SECRET` = the client secret from step 1.3
3. Save. These aren't strictly needed for Plan 02's sign-in flow (the hosted Supabase project holds the provider credentials), but having them set early avoids surprises during Plan 03 (Drive scope upgrade calls the OAuth client directly from the Edge Function).

## 4. Smoke test (after Plan 02 Tasks 3-4 land)

1. Visit http://localhost:3000/sign-in
2. Click **Sign in with Google**
3. Complete the Google consent screen (must be one of the test users)
4. Expect to land back on http://localhost:3000/ as a signed-in user (next page will redirect you to `/setup` since you don't have a household yet)

Repeat for production at https://home-app-livid.vercel.app/sign-in.

## Common errors

| Error | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` from Google | The authorized redirect URI in Google Cloud doesn't exactly match what Supabase sends | Check step 1.3 — URLs must match including trailing slash (none), port, scheme |
| `provider is not enabled` from Supabase | Provider toggle is off on hosted, OR `enabled = false` in local `config.toml` | Re-check step 2 |
| `flow_state_not_found` after callback | PKCE cookies missing — middleware (proxy.ts) isn't running | Verify proxy.ts exists at project root with the matcher config; restart `npm run dev` |
| Access blocked: this app is not verified | Sign-in attempt from a user not in the test users list | Add the email to Audience → Test users in Google Cloud |
| `invalid_grant` from callback | OAuth code already used or expired | Re-attempt sign in; codes are single-use, 10-minute TTL |

## Security notes

- The Client Secret is a long-lived credential. Treat it like a password. Rotate at https://console.cloud.google.com/apis/credentials → click client → **Reset Secret** if it ever leaks.
- All secrets used here are gitignored (`.env.local`, `.env.production.local`). They are NEVER committed to the repo.
- The hosted Supabase project's provider config is stored on Supabase's side; we don't store the secret in the repo.
