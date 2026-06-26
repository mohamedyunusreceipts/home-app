# Setup Checklist — everything *you* need to do

**Last updated:** 2026-06-26

This is the master list of **manual, human-only actions** to take the app from where it is now (auth & onboarding built) all the way to a launched, full-featured product. These are the things I (Claude) **cannot** do for you — creating accounts, granting permissions in a browser, generating secrets, entering your bank's figures, testing on real phones.

Everything *else* — writing code, migrations, tests, wiring the UI — I do. When a build phase is blocked on one of these items, this doc says so.

> **How to read the table:** ⛔ = blocks work I can't start without it · ⚠️ = needed soon · 🕓 = needed later, safe to defer.
> Tick the box when done. Items are ordered by when they're needed.

---

## Quick status table

| # | Item | Needed for | Priority | Done? |
|---|------|-----------|----------|-------|
| 1 | Google Cloud OAuth client | Live Google sign-in | ⛔ now | ☐ |
| 2 | Supabase hosted — enable Google + URL config | Live sign-in | ⛔ now | ☐ |
| 3 | Confirm `.env.local` values (local dev) | Local testing | ⚠️ now | ☐ |
| 4 | Vercel project + env vars | Deploying anything | ⛔ now | ☐ |
| 5 | Push DB migrations to hosted Supabase | Prod auth + every module | ⚠️ now | ☐ |
| 6 | `DRIVE_TOKEN_ENCRYPTION_KEY` secret | Plan 03 — Google Drive | ⚠️ before Drive | ☐ |
| 7 | Enable Google Drive API + `drive.file` scope | Plan 03 — Google Drive | ⚠️ before Drive | ☐ |
| 8 | Anthropic API key | AI suggest + receipt OCR | 🕓 before AI | ☐ |
| 9 | VAPID keys (web push) | Push notifications | 🕓 before notifications | ☐ |
| 10 | **Mortgage: gather your bond details** | **Mortgage module (your #1)** | ⚠️ before mortgage | ☐ |
| 11 | **Mortgage: decide the accuracy model** | **Mortgage module (your #1)** | ⛔ before mortgage | ☐ |
| 12 | Real-device push testing (iOS + Android) | Pre-launch | 🕓 pre-launch | ☐ |
| 13 | Custom domain (optional) | Pre-launch polish | 🕓 optional | ☐ |

---

## 1. Google Cloud OAuth client ⛔

Lets people sign in with Google. One client covers both sign-in now and Google Drive later.

The detailed click-by-click already exists in [docs/auth-setup.md](auth-setup.md) §1 — follow that. In short:

1. https://console.cloud.google.com/ → create project `home-app`.
2. **OAuth consent screen** → External · App name `Home` · your email for support + developer contact · add **both partner emails as Test users**.
3. **Credentials → Create OAuth Client ID → Web application** `home-app`:
   - **Authorized JavaScript origins:** `http://localhost:3000` and `https://home-app-livid.vercel.app`
   - **Authorized redirect URIs** (these are *Supabase's* callback URLs):
     - `http://127.0.0.1:54321/auth/v1/callback` (local)
     - `https://gcltdipgyioxumloqaiz.supabase.co/auth/v1/callback` (hosted)
4. Copy the **Client ID** and **Client Secret** somewhere safe — you'll paste them into Supabase (item 2), Vercel (item 4), and `.env.local` (item 3).

> While you're here, you can also do item 7 (enable the Drive API) in the same project — saves a trip back.

---

## 2. Supabase hosted — enable Google + URL config ⛔

Project ref: **`gcltdipgyioxumloqaiz`** (account: `mohamedyunusreceipts@gmail.com`).

Detailed steps in [docs/auth-setup.md](auth-setup.md) §2. In short:

1. **Auth → Providers → Google** → toggle ON → paste Client ID + Secret from item 1 → Save.
2. **Auth → URL Configuration:**
   - **Site URL:** `https://home-app-livid.vercel.app`
   - **Redirect URLs (allowlist):** `http://localhost:3000/**` and `https://home-app-livid.vercel.app/**`

---

## 3. Confirm `.env.local` (local dev) ⚠️

Your `.env.local` exists. Make sure these five are real values (not placeholders):

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from `npx supabase status`>
SUPABASE_SERVICE_ROLE_KEY=<from `npx supabase status`>
GOOGLE_OAUTH_CLIENT_ID=<from item 1>
GOOGLE_OAUTH_CLIENT_SECRET=<from item 1>
```

Get the local Supabase keys any time with: `npx supabase status` (Docker must be running).

---

## 4. Vercel project + env vars ⛔

Use your **personal** Vercel account — **not** the NUtec/`nutecdigital.com` work account (this is a personal project; locked decision #19).

1. Import the GitHub repo into Vercel.
2. **Settings → Environment Variables** — add for **all environments** (Production, Preview, Development). Start with the four below; add the rest as their features get built (items 6–9):

```
NEXT_PUBLIC_SUPABASE_URL=https://gcltdipgyioxumloqaiz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<hosted anon/publishable key — Supabase dashboard → Project Settings → API>
SUPABASE_SERVICE_ROLE_KEY=<hosted service_role/secret key — same page>
GOOGLE_OAUTH_CLIENT_ID=<from item 1>
GOOGLE_OAUTH_CLIENT_SECRET=<from item 1>
APP_URL=https://home-app-livid.vercel.app
```

> Supabase's dashboard may now label these "publishable" and "secret" keys; the code uses the older `ANON_KEY` / `SERVICE_ROLE_KEY` variable names — that's fine, just paste the matching values.

---

## 5. Push DB migrations to hosted Supabase ⚠️

The local DB has migrations `0001`–`0008`; the hosted one needs them before prod works. **I can run this for you** if you put `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` in a gitignored `.env.production.local` (tell me when it's there). Otherwise, do it yourself:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<from supabase.com → Account → Access Tokens>"
npx supabase link --project-ref gcltdipgyioxumloqaiz
npx supabase db push   # prompts for the DB password
```

The DB password is under Supabase dashboard → **Project Settings → Database → Connection string**.

---

## 6. `DRIVE_TOKEN_ENCRYPTION_KEY` ⚠️ (before Google Drive — Plan 03)

A 32-byte key that encrypts the Drive refresh token at rest (AES-256-GCM). Generate one:

```bash
openssl rand -hex 32
```

Copy the 64-character output into Vercel as `DRIVE_TOKEN_ENCRYPTION_KEY` and into `.env.local`. **Keep a backup** — if this key is lost, stored Drive tokens become undecryptable and the Drive owner must reconnect.

---

## 7. Enable Google Drive API + `drive.file` scope ⚠️ (before Plan 03)

In the same Google Cloud project from item 1:

1. **APIs & Services → Library** → search **Google Drive API** → **Enable**.
2. **OAuth consent screen → Edit → Scopes → Add** `.../auth/drive.file` (per-file access — the app only touches files it creates).
3. Save. (No new client needed — the existing OAuth client gains the scope when the app requests it during the "Connect Drive" step the owner does in-app.)

---

## 8. Anthropic API key 🕓 (before AI features)

Powers "Suggest with AI" and receipt-photo OCR. There's a per-household monthly call cap (default 100) so cost stays bounded.

1. https://console.anthropic.com → sign up → add billing.
2. **API Keys → Create Key** → copy it.
3. Add to Vercel as `ANTHROPIC_API_KEY`.

---

## 9. VAPID keys 🕓 (before push notifications)

Required for PWA web push. Generate a keypair:

```bash
npx web-push generate-vapid-keys
```

Add three vars to Vercel (and `.env.local`):

```
VAPID_PUBLIC_KEY=<public key from output>
VAPID_PRIVATE_KEY=<private key from output>
VAPID_SUBJECT=mailto:your-email@example.com
```

---

## 10. Mortgage — gather your bond details ⚠️ (your #1 priority)

For the access-bond tracker I need the real numbers. Please collect from your latest bond statement:

- [ ] **Bank** and bond account number (for your reference only)
- [ ] **Original loan amount** and **start date** of the bond
- [ ] **Term** (e.g. 20 years) — and how many months are left
- [ ] **Current outstanding balance** (the interest-bearing balance)
- [ ] **Interest rate** — the actual rate, and whether it's **prime-linked** (e.g. "prime − 0.5%"). If prime-linked, note today's prime.
- [ ] **Contractual monthly instalment**
- [ ] **(Optional) History** — if you want the dashboard to show the past, the extra payments/withdrawals you've already made and roughly when

> None of this is committed to the repo — you'll enter it into the app once the module is built (or hand it to me for a test seed).

---

## 11. Mortgage — decide the accuracy model ⛔ (open design question)

SA access bonds compound interest **daily** and are usually **prime-linked (variable)**, so a calculator that only projects from the original terms will drift from your real statement over time. We need to pick how to keep "available redraw" honest. Reply with one:

- **A — Computed only:** enter terms once, app calculates everything. Simplest; drifts; manual rate updates on prime changes.
- **B — Statement-driven:** each month you enter the real figures (opening balance, interest charged, payment, closing balance). Most accurate; ~2 min/month.
- **C — Hybrid (my recommendation):** app projects *and* lets you reconcile against the statement monthly, flagging drift. Live what-ifs + an honest balance.

Also tell me: **do you get a digital/PDF statement each month** (easy to copy figures from), or is manual entry the realistic path?

*(This is the one question that was open when we paused the mortgage design. Answering it unblocks the mortgage spec.)*

---

## 12. Real-device push testing 🕓 (pre-launch)

- **iOS (16.4+):** web push only works *after* "Add to Home Screen". Test on a real iPhone, installed as a PWA.
- **Android:** test push in Chrome.
- Verify a triggered notification (e.g. a bill due tomorrow) actually arrives on both.

---

## 13. Custom domain (optional) 🕓

If you want a nicer URL than `home-app-livid.vercel.app`:

1. Add the domain in Vercel → Domains.
2. Update `APP_URL` (Vercel env) and re-do the origins/redirect allowlists in **Google OAuth** (item 1) and **Supabase URL config** (item 2) with the new domain.

---

## What I do (no action needed from you)

For context — these are mine to build, gated only by the items above:

- **Plan 03 Drive adapter** — needs items 6 + 7.
- **App shell + dashboard, RRULE/recurrence helpers** — no manual items.
- **Notifications infra** — needs item 9 for live push (UI can be built before).
- **AI-suggest framework + receipt OCR** — needs item 8 for live calls.
- **All 7 feature modules + the mortgage module** — need only their data; mortgage needs items 10 + 11.
- Merging the current `plan-02-auth-onboarding` branch, pushing migrations (item 5 if you grant access), and per-module tests.

---

## The fastest unblock path

If you do these **four** in one sitting, I can build continuously for a long stretch without waiting on you:

1. **Items 1–4** (Google OAuth → Supabase → Vercel) — unblocks live sign-in and deploys.
2. **Item 11** (mortgage accuracy model) — one-line reply — unblocks your top-priority module.
3. **Item 10** (bond details) — so the mortgage dashboard shows your real numbers.
4. **Item 6** (`openssl rand -hex 32`) — so Drive isn't blocked when I get there.

Items 8, 9, 12, 13 can wait until those features come up.
