# Deploy checklist — make the live site work

**Goal:** get `https://home-app-livid.vercel.app` working end-to-end so the deployed app can be tested in a browser.

**Already done:** Google OAuth client ✓ · hosted Supabase Google provider + URL config ✓ · Vercel Node 22.x ✓ · code pushed to `main` ✓.

Items are split into **Required** (sign-in breaks without them) and **Optional** (those features degrade gracefully — fine to skip for a first test).

---

## REQUIRED

### 1. Confirm the Vercel project is connected to the repo
- Vercel → your project (the one serving `home-app-livid.vercel.app`) → **Settings → Git**. It should be linked to `mohamedyunusreceipts/home-app`, production branch `main`. If it's not linked, **Add New → Project → import that repo**.
- This is what makes a push to `main` auto-deploy.

### 2. Set Vercel environment variables
Vercel → project → **Settings → Environment Variables** → add each for **Production** (and Preview). The six below are the minimum for sign-in:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gcltdipgyioxumloqaiz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the **anon / publishable** key (see below) |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role / secret** key (see below) |
| `GOOGLE_OAUTH_CLIENT_ID` | `604489006445-fmhoddsulp70182btfjc5d0f4dncim7t.apps.googleusercontent.com` |
| `GOOGLE_OAUTH_CLIENT_SECRET` | copy from your local `.env.local` (the `GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX…` line) |
| `APP_URL` | `https://home-app-livid.vercel.app` |

**Where the two Supabase keys are:** https://supabase.com/dashboard/project/gcltdipgyioxumloqaiz/settings/api — copy the **anon/publishable** key and the **service_role/secret** key. (Don't paste them into chat — straight into Vercel.)

### 3. Apply the database migrations to the hosted Supabase
The hosted DB still has only the foundation tables — it needs all 18 migrations (every module's tables, RLS, RPCs, calendar views). **Two options:**

- **Easiest — I do it.** Create a gitignored file `.env.production.local` in the project root with these two lines, then tell me:
  ```
  SUPABASE_ACCESS_TOKEN=<from https://supabase.com/dashboard/account/tokens>
  SUPABASE_DB_PASSWORD=<Supabase → Project Settings → Database → your DB password>
  ```
  I'll run `supabase link` + `supabase db push` and confirm all 18 applied. (The file is gitignored; I won't print its contents.)

- **Or do it yourself:**
  ```bash
  npx supabase link --project-ref gcltdipgyioxumloqaiz
  npx supabase db push      # prompts for the DB password
  ```

### 4. Redeploy
Env-var changes only take effect on a fresh build. Vercel → **Deployments → ⋯ → Redeploy** the latest (or push any commit). Wait for it to go green.

---

## OPTIONAL (skip for the first test — these features fail gracefully without their keys)

Add to Vercel env vars when you want each feature live:

| Feature | Vars | How to get |
|---|---|---|
| Google Drive uploads | `DRIVE_TOKEN_ENCRYPTION_KEY` | `openssl rand -hex 32` |
| AI suggest / receipt OCR | `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys |
| Web Push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | already in your local `.env.local` (I generated them) — copy those values |

---

## Then hand back to me

Tell me once steps 1–4 are done (and whether you want me to run step 3). I'll:
1. Verify the deployment is live and healthy.
2. Drive `https://home-app-livid.vercel.app` in your connected browser — sign in (use a test-user account: `mohamedyunusreceipts@gmail.com`, `mohideenlaya@gmail.com`, or `rayhaanmy@gmail.com`), create a household, and walk every module, screenshotting as I go.
3. Fix anything that surfaces, then run Lighthouse on the live site.
