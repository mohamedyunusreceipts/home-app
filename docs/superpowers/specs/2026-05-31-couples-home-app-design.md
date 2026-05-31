# Couples Home App — Design Spec

**Date:** 2026-05-31
**Status:** Draft for review
**Author:** Rayhaan Yunus (with Claude)

## 1. Purpose & scope

A shared home-management PWA for couples (exactly two people per household). Multi-tenant: many independent couples can use the same deployment, each fully isolated. Single Google Drive (the household owner's) stores all binary files in a predictable folder structure; Supabase stores all relational data and enforces isolation via row-level security.

The app covers seven feature areas — Money, Food & Groceries, Home Management, Calendar & Planning, Travel & Packing, Wardrobe, and Documents & Important Info — all surfaced through a unified dashboard that gives an at-a-glance daily overview.

**Build approach:** designed and built as a single comprehensive release (user decision; risks acknowledged). Implementation is phased internally so each piece is testable before the next is built on top — but the spec covers the whole product.

## 2. Locked decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Platform | PWA (installable, push-capable web app) |
| 2 | Tech stack | Next.js 16 (App Router) + TypeScript + Tailwind + ShadCN/UI; Supabase (Postgres + Auth + RLS + Edge Functions); Vercel hosting |
| 3 | Sign-in | Google OAuth only (covers Drive scope in one consent) |
| 4 | Storage model | Household *owner's* Google Drive holds all files; partner does not need Drive scope |
| 5 | Joining a household | Single-use invite link (`/join/<token>`, 24-hour expiry) |
| 6 | Drive folder layout | `/HomeApp/<Module>/<Subcategory>/` |
| 7 | Dashboard | All 8 cards exist from day 1, each fed by a real module |
| 8 | Generators | Deterministic backbone + optional "Suggest with AI" buttons (Anthropic Claude Haiku, with per-household monthly call cap) |
| 9 | Calendar | Built-in source of truth; one-way `.ics` export feed per household |
| 10 | Notifications | In-app bell + PWA Web Push (VAPID) |
| 11 | Money | Manual entry + receipt photo OCR via AI |
| 12 | Locale | South Africa — ZAR, `Africa/Johannesburg`, metric, ZA date format |
| 13 | Visual direction | Warm & cozy — terracotta (#C77B5C) + sage (#7A9B7A) + cream (#FAF6EF), serif headings (Fraunces) + sans body (Inter) |
| 14 | Household size | Fixed at 2 (couple); enforced by trigger |
| 15 | Document vault encryption | Google Drive at-rest only (no client-side encryption in v1) |
| 16 | Wardrobe images | Phone camera upload to Drive (no AI background removal) |
| 17 | Offline | Cache reads only — no offline editing |
| 18 | Supabase account | `mohamedyunusreceipts@gmail.com` |
| 19 | Vercel account | Personal account (NOT NUtec / `nutecdigital.com` work account — this is a personal project) |

> _Plan 01 execution note: `create-next-app@latest` shipped Next.js 16 by the time this plan ran; minor breaking changes (e.g. `middleware` file convention → `proxy`) have been adopted accordingly._

## 3. Architecture

### 3.1 Stack
- **Frontend:** Next.js 16 App Router, TypeScript strict, Tailwind CSS, ShadCN/UI primitives restyled to the warm/cozy palette.
- **Backend:** Supabase (managed Postgres + Auth + Realtime + Edge Functions). `pg_cron` extension for scheduled jobs.
- **Storage:** Google Drive (owner's account) for all binary files. Supabase Storage is **not** used.
- **AI:** Anthropic API (Claude Haiku) for suggest features and receipt OCR; server-side only.
- **Hosting:** Vercel (personal account), free tier.
- **PWA:** `next-pwa` for manifest + service worker; Web Push via `web-push` library with VAPID keys.

### 3.2 Code organization

```
/app                  Next.js App Router routes
  /(auth)             setup, join/[token], sign-in
  /(app)              authenticated shell with bottom-nav / sidebar layout
    /page.tsx           dashboard
    /money/*  /food/*  /home/*  /calendar/*  /travel/*  /wardrobe/*  /vault/*
    /settings/*
  /api                Edge Function routes (Drive proxy, AI suggest, push, ical)
/lib
  /supabase           browser + server clients, auth helpers
  /drive              DriveClient, folder resolver, AES-GCM token crypto
  /ai                 prompt builders per kind, anthropic client, usage tracker
  /notifications      VAPID, scheduler triggers, in-app writers
  /ical               feed builder
  /rrule              recurrence helpers (wraps `rrule` npm package)
/components
  /ui                 shadcn primitives (restyled)
  /dashboard/cards    one component per dashboard card
  /<module>           module-specific components
/db
  /migrations         versioned SQL files (Supabase CLI)
  /seed.sql           default categories, etc.
/types                generated Supabase types + domain types
```

**Module boundary rule:** one feature module = one folder under `/app/(app)/` + one folder under `/components/` + its own SQL migrations + its own tests. Modules do NOT import from each other directly — cross-module data (Calendar reading from Bills, Travel referencing Wardrobe) flows through the database (views, foreign keys), not through code imports.

### 3.3 Environment variables (Vercel)

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged key |
| `GOOGLE_OAUTH_CLIENT_ID` | For Drive scope upgrade |
| `GOOGLE_OAUTH_CLIENT_SECRET` | For Drive scope upgrade |
| `DRIVE_TOKEN_ENCRYPTION_KEY` | 32-byte hex; AES-256-GCM for refresh tokens at rest |
| `ANTHROPIC_API_KEY` | AI suggest + OCR |
| `VAPID_PUBLIC_KEY` | Web Push |
| `VAPID_PRIVATE_KEY` | Web Push |
| `VAPID_SUBJECT` | `mailto:…` for VAPID |
| `APP_URL` | Used in iCal feed deep links, OAuth callbacks |

## 4. Auth & household model

### 4.1 Core foundation tables

- `profiles` — one row per Supabase user. `id (uuid pk)`, `email`, `display_name`, `avatar_url`, `created_at`.
- `households` — `id`, `name`, `owner_user_id (fk profiles)`, `drive_refresh_token_encrypted (bytea)`, `drive_root_folder_id (text)`, `currency (default 'ZAR')`, `timezone (default 'Africa/Johannesburg')`, `created_at`.
- `household_members` — `household_id (fk)`, `user_id (fk profiles)`, `role ('owner'|'partner')`, `joined_at`. PK (household_id, user_id). Trigger enforces **max 2 rows per household_id**.
- `invites` — `household_id`, `token (url-safe random, unique)`, `created_by (fk profiles)`, `expires_at (default now()+'24 hours')`, `used_at`, `used_by_user_id`.

### 4.2 Row-level security

Every domain table carries a `household_id` column. A single policy template, applied to every table:

```sql
CREATE POLICY tenant_isolation ON <table>
  USING (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ))
  WITH CHECK (household_id IN (
    SELECT household_id FROM household_members WHERE user_id = auth.uid()
  ));
```

Cross-household isolation is enforced at the database, not the application. The test suite has one isolation test per table that proves household A's user cannot read or write household B's rows.

### 4.3 Onboarding flow

1. User clicks **Sign in with Google** → Supabase OAuth → `profiles` row inserted (trigger on `auth.users`).
2. First-time user lands on `/setup` with two options: **Create household** or **Join with invite link**.
3. **Create:** enter household name → in-app consent screen explaining Drive permission → re-OAuth with `drive.file` scope added → store encrypted refresh token → create `/HomeApp/` root folder in Drive → insert `households` row + `household_members` row (role='owner').
4. **Join:** paste invite link or land on `/join/<token>` → verify token (unused, not expired, partner slot still empty) → insert `household_members` row (role='partner'). Partner does NOT grant Drive scope.

## 5. Google Drive storage adapter

### 5.1 Module
`lib/drive/DriveClient.ts` — a class instantiated per request from the household's encrypted refresh token. All Drive API calls funnel through this client.

### 5.2 Token security
- Refresh tokens encrypted with **AES-256-GCM** at rest. Key in `DRIVE_TOKEN_ENCRYPTION_KEY`.
- Refresh tokens decrypted only inside Edge Functions, never returned to the browser.
- Access tokens (1-hour TTL) held in memory only, fetched on demand.

### 5.3 Public API
```ts
upload(module, subcategory, file, metadata) → { driveFileId, webViewLink, thumbnailLink }
download(driveFileId) → ReadableStream
delete(driveFileId) → void
list(module, subcategory?) → File[]
getThumbnail(driveFileId, size) → URL
```

### 5.4 Folder layout (lazy-created)
```
/HomeApp/
  /Documents/{IDs,Passports,Warranties,Car,Other}/
  /Money/{Receipts,Bills}/
  /Food/RecipePhotos/
  /Home/{MaintenanceDocs,HomeProjects}/
  /Travel/<TripId>-<TripNameSlug>/
  /Wardrobe/<UserId>/
  /Calendar/Attachments/
```

Folder IDs cached in a `drive_folders (household_id, path, drive_folder_id)` table to avoid repeated Drive lookups.

### 5.5 Upload path
Browser → Edge Function (`/api/drive/upload`) → Drive. Keeps the refresh token server-side. Thumbnails served via `drive.thumbnailLink` proxied through `/api/drive/thumb/[id]` for auth.

### 5.6 Failure modes
- **Owner revokes Drive permission:** app shows persistent "Drive disconnected — owner must reconnect" banner; new uploads blocked; reads still work for cached metadata where possible.
- **Refresh token expired:** triggers re-OAuth flow for owner on next action.
- **Quota exceeded:** Drive 403 surfaced as a friendly error.

## 6. App shell & navigation

- **Top bar:** household name (tap → switcher placeholder for future multi-household), notification bell with unread count, avatar menu (settings, sign out, "Manage Drive" for owner).
- **Bottom tab bar (mobile <768px) / left sidebar (desktop ≥768px):** Home · Money · Food · House · Calendar · Travel · Wardrobe · Vault (8 destinations).
- **FAB ("+"):** context-aware quick-add on every screen. Home → pick anything; module pages → most common create action.
- **Routes:** `/` (dashboard), `/money/*`, `/food/*`, `/home/*`, `/calendar/*`, `/travel/*`, `/wardrobe/*`, `/vault/*`, `/settings/*`, `/setup`, `/join/[token]`.

## 7. Dashboard

Single scrollable column on mobile / 2-column grid on desktop. Each card is glanceable, tap-to-expand-or-jump-to-module. Fixed order in v1; configurable later.

| Card | Source | Display |
|---|---|---|
| Today's meals | `meal_plan` for today | breakfast / lunch / dinner |
| Upcoming bills | `bills` due ≤ 7 days | next 3 with amount + days-until; red if overdue |
| Chores due | `chores` due today / overdue | count + top 3; tap to tick off |
| Calendar events | `v_calendar_all` for today + tomorrow | next 3 with time |
| Grocery reminders | `grocery_items` unchecked | count + highlights |
| Trip countdown | next `trips` row | "N days until <trip>"; hidden if none upcoming |
| Budget warning | `expenses` vs `budgets` this month | progress bar; warning if >80% in any category |
| Maintenance reminders | `maintenance_reminders` due ≤ 30 days | next 2 |

Each card is a self-contained component that fetches its own slice. Empty states are warm and useful ("No meals planned for today — pick some →"), never blank.

## 8. Cross-cutting systems

### 8.1 AI Suggest pattern
- **UI contract:** every "Suggest with AI" button opens a modal with context summary, **Generate** CTA, results pane with **Save** / **Try again** / **Cancel**.
- **Backend:** single Edge Function `POST /api/ai/suggest` accepting `{ kind, context }`. Per-kind prompt builders in `lib/ai/prompts/`.
- **Cost control:** each household has a soft monthly call cap (default 100, configurable in settings). Usage tracked in `ai_usage (household_id, month, calls)`. Settings shows "78/100 used this month". Hard cap blocks calls past the limit with a clear message; resets on the 1st.
- **Models:** Claude Haiku for text; Claude Haiku with vision for receipt OCR.

### 8.2 Notifications
- **In-app:** `notifications (household_id, user_id, kind, title, body, link, read_at, created_at)`. Bell icon shows unread count. Realtime via Supabase channel subscription.
- **PWA push:** `push_subscriptions (user_id, endpoint, p256dh, auth)`. A `pg_cron` job runs every 15 min, scans for triggers (bills due tomorrow, chores due today, maintenance ≤7 days, trip countdown 30/7/1 days, leftovers expiring), fires Web Push + writes in-app notification.
- **Per-user preferences:** settings page toggles each notification kind on/off (default: all on).
- **iOS:** push requires "Add to Home Screen" first on iOS 16.4+. Setup screen has a one-time explainer.

### 8.3 Calendar export (`.ics`)
- **Source of truth:** `calendar_events` for manual events. Module-sourced events come from Postgres views (`v_calendar_bills`, `v_calendar_chores`, `v_calendar_meals`, `v_calendar_trips`, `v_calendar_birthdays`, `v_calendar_maintenance`), UNIONed with `calendar_events` as `v_calendar_all`.
- **Per-household feed URL:** `/api/ical/[householdToken].ics` — long random token, separate from auth (so iOS Calendar / Google Calendar can poll without logging in). Token rotatable in settings if leaked.
- **Format:** iCalendar 2.0 with UID, DTSTART/DTEND, SUMMARY, DESCRIPTION (containing deep link back to the app), CATEGORIES (Bills / Chores / Meals / Trips / Birthdays / Maintenance / Manual).
- **Filtering (v1.1):** `?include=bills,chores` query param.

### 8.4 Recurrence
All recurring patterns (chores, bills, cleaning, maintenance, birthdays) store **RFC 5545 RRULE strings**. One library (`rrule` npm) is used by the calendar export, the next-due calculator, and the scheduler trigger.

## 9. Feature modules

Notation: tables listed by name only — all carry `household_id` and standard timestamps (`created_at`, `updated_at`); soft-delete (`deleted_at`) on user-content tables.

### 9.1 Money
- **Tabs:** Dashboard · Monthly budget · Bills & subscriptions · Split expenses · Savings goals · Who owes who
- **Tables:** `expenses` (date, amount, category, paid_by_user_id, split_type, description, receipt_drive_file_id), `expense_splits` (expense_id, user_id, share_amount), `bills` (name, amount, recurrence_rrule, next_due, category, auto_pay), `subscriptions` (name, amount, recurrence_rrule, next_charge, category, cancel_url), `budgets` (month, category, limit_amount), `savings_goals` (name, target, current, deadline, drive_image_id)
- **Categories:** seeded list (Groceries, Dining, Transport, Utilities, Rent, Entertainment, Personal, Other); household-editable
- **Split logic:** per-expense — `equal` / `me_only` / `partner_only` / `custom_amount`. "Who owes who" is a single running balance — recomputed live, not stored
- **Receipt OCR:** snap → upload to `/HomeApp/Money/Receipts/` → AI returns `{ amount, merchant, date, suggested_category }` → user confirms in pre-filled form
- **Budget warning:** dashboard card red when `month_spent / month_limit > 0.8` in any category; push fires once per crossing per month

### 9.2 Food & Groceries
- **Tabs:** Weekly meal plan · Recipes · Grocery list · Pantry · Budget meals · Leftovers ideas
- **Tables:** `recipes` (name, photo_drive_file_id, servings, prep_min, cook_min, instructions_md, source_url, tags[]), `recipe_ingredients` (recipe_id, name, qty, unit, pantry_item_id?), `meal_plan` (date, slot ['breakfast'|'lunch'|'dinner'], recipe_id|free_text), `pantry_items` (name, qty, unit, expires_on?), `grocery_items` (name, qty, unit, source ['manual'|'meal_plan'|'recipe'], checked, added_by_user_id), `leftovers` (name, consume_by, from_recipe_id?)
- **Grocery list generator (deterministic):** "Build list from this week's meals" diffs `recipe_ingredients` for planned meals against `pantry_items`; emits missing items into `grocery_items`; duplicates merged by name+unit
- **AI suggest:** "Recipe ideas using my pantry"; "Leftover ideas"; "Budget meals for the week"
- **Leftovers tracking:** appears on dashboard "expiring soon" + seeds leftover-ideas AI

### 9.3 Home Management
- **Tabs:** Chores · Cleaning schedule · Maintenance reminders · Home projects · Shared lists · Shopping links
- **Tables:** `chores` (name, assignee_user_id|null, recurrence_rrule, next_due, last_done_at, last_done_by), `cleaning_tasks` (same columns as `chores`; separated as a distinct table so the Chores tab and Cleaning Schedule tab can be queried, scoped, and styled independently without a discriminator column — keeps simple queries simple), `maintenance_reminders` (item, next_due, recurrence_rrule, notes, attachment_drive_file_id), `home_projects` (name, status, budget, notes_md, photo_drive_file_ids[]), `shared_lists` (name, items jsonb), `shopping_links` (label, url, category, notes)
- **Tick-off flow:** tap "done" stamps `last_done_at` / `last_done_by`, computes `next_due` via RRULE, fires "✓ Nice" toast (no push)
- **Fairness view:** bar chart per chore tab showing chores completed per partner over last 30 days

### 9.4 Calendar & Planning
- **Tabs:** Couple calendar (month/week/day) · Appointments · Birthdays · Bill due dates · Chore schedule · Meal schedule · Trip dates
- **Tables:** `calendar_events` (start, end, all_day, title, location, notes, color, created_by) for manual events; `contacts` (name, dob, relationship, gift_ideas_text) for birthdays
- **Views:** `v_calendar_bills`, `v_calendar_chores`, `v_calendar_meals`, `v_calendar_trips`, `v_calendar_birthdays`, `v_calendar_maintenance`; UNION as `v_calendar_all`
- **Color coding:** bills=red, chores=blue, meals=orange, trips=purple, birthdays=pink, maintenance=brown, manual=user-chosen; filter chips toggle sources
- **Tap event → deep link** to source row in source module

### 9.5 Travel & Packing
- **Tabs:** Trip ideas · Trip budget · Itinerary · Packing list · Travel documents · Outfit packing plan · Shared travel notes
- **Tables:** `trips` (name, destination, start, end, status ['idea'|'planning'|'booked'|'completed'], budget_total, cover_image_drive_file_id), `trip_itinerary_items` (trip_id, day, time?, title, location, notes, attachment_drive_file_id), `trip_expenses` (trip_id, date, amount, category, description, also_count_in_monthly_budget bool), `packing_lists` (trip_id, name), `packing_items` (list_id, name, packed_by_user_id?, packed), `trip_docs` (trip_id, kind ['passport'|'visa'|'ticket'|'booking'|'insurance'|'other'], drive_file_id, expiry_date?), `trip_notes` (trip_id, body_md), `trip_outfits` (trip_id, day, wardrobe_item_ids[])
- **Drive folder:** on trip create, `/HomeApp/Travel/<TripId>-<TripNameSlug>/` created (ID prefix prevents collisions on duplicate trip names); all trip attachments live there
- **Outfit packing plan:** cross-module — assigning wardrobe items to trip days auto-adds the underlying clothes to packing list
- **Countdown:** dashboard card uses `MIN(start) WHERE status IN ('planning','booked') AND start > now()`

### 9.6 Wardrobe
- **Tabs:** My wardrobe · Partner wardrobe · Outfit generator · Occasion outfits · Laundry-aware outfits · Packing outfits · Sizes & preferences
- **Tables:** `wardrobe_items` (owner_user_id, category ['top'|'bottom'|'dress'|'shoes'|'outerwear'|'accessory'|'underwear'], color, season[], occasion[], photo_drive_file_id, brand?, size?, notes, laundry_status ['clean'|'worn'|'in_wash'], visible_to_partner bool default true), `outfits` (owner_user_id, name, occasion, item_ids[], saved_at, photo_drive_file_id?), `wardrobe_preferences` (user_id, sizes jsonb, style_notes_md)
- **Per-user privacy:** items default visible to partner; togglable per item; `underwear` category defaults to `visible_to_partner=false`
- **Outfit generator (deterministic):** filters by occasion / season / weather (manual or fetched) / excludes `laundry_status='in_wash'` / excludes items in any active trip's packing list; picks one per required category; shuffle re-rolls; save → outfit row
- **AI suggest:** "Suggest an outfit for <occasion>" — feeds wardrobe list + occasion to Claude
- **Laundry-aware:** "worn" / "send to wash" / "wash done" actions; bulk supported

### 9.7 Documents & Important Info (Vault)
- **Tabs:** Documents vault · Emergency contacts · Car documents · Warranty documents · IDs/passports · Gift ideas · Sizes & preferences
- **Tables:** `documents` (name, kind, drive_file_id, expiry_date?, notes, uploaded_by_user_id, tags[]), `emergency_contacts` (name, relationship, phone, email, notes, is_medical), `vehicles` (label, make, model, year, plate, vin, insurance_expiry, license_expiry, service_due_date, notes), `vehicle_docs` (vehicle_id, kind, drive_file_id, expiry_date?), `warranties` (item, purchase_date, expiry_date, retailer, drive_file_id, notes), `gift_ideas` (for_user_id?, for_contact_id?, idea, url?, price_estimate, occasion, claimed_by_user_id?)
- **Expiry tracking:** any row with `expiry_date` triggers reminders at 60/30/7 days before expiry; surfaces in dashboard maintenance card
- **Gift ideas privacy:** RLS includes additional clause `AND (for_user_id IS NULL OR for_user_id != auth.uid())` — recipient cannot see gifts targeted at them
- **Sensitive docs:** stored in Drive with native at-rest encryption only; no client-side encryption in v1
- **"Sizes & preferences" tab:** reads from the same `wardrobe_preferences` table as the Wardrobe module. The `sizes jsonb` field accommodates both clothing (tops, bottoms, shoes) and non-clothing entries (ring size, watch band, etc.) as freeform keys. One source of truth, surfaced in two places

## 10. Consolidated data model summary

**Foundation (4):** `profiles` · `households` · `household_members` · `invites`
**Infrastructure (4):** `drive_folders` · `notifications` · `push_subscriptions` · `ai_usage`
**Money (6):** `expenses` · `expense_splits` · `bills` · `subscriptions` · `budgets` · `savings_goals`
**Food (6):** `recipes` · `recipe_ingredients` · `meal_plan` · `pantry_items` · `grocery_items` · `leftovers`
**Home (6):** `chores` · `cleaning_tasks` · `maintenance_reminders` · `home_projects` · `shared_lists` · `shopping_links`
**Calendar (2 + 6 views):** `calendar_events` · `contacts` + `v_calendar_{bills,chores,meals,trips,birthdays,maintenance,all}`
**Travel (8):** `trips` · `trip_itinerary_items` · `trip_expenses` · `packing_lists` · `packing_items` · `trip_docs` · `trip_notes` · `trip_outfits`
**Wardrobe (3):** `wardrobe_items` · `outfits` · `wardrobe_preferences`
**Vault (6):** `documents` · `emergency_contacts` · `vehicles` · `vehicle_docs` · `warranties` · `gift_ideas`

**Total: 45 tables + 7 views.** Every table has `household_id` and identical RLS. UUIDs as PKs. `timestamptz` everywhere.

## 11. Testing

- **Unit (Vitest):** pure logic — split calculator, recurrence next-due, AI prompt builders, ICS generation.
- **Integration (Vitest + local Supabase):** one RLS isolation test per table proving household A cannot read or write household B's rows.
- **E2E (Playwright):** golden path per module — sign in, create household, invite partner accept, create a record, see on dashboard, log out.
- **Seed:** test seed creates two households with two users each, used by isolation tests.

## 12. Build order (within the single release)

1. Project skeleton — Next.js + Tailwind + ShadCN + theme tokens + folder structure + Supabase project + CI.
2. Foundation tables + RLS policies + isolation tests.
3. Auth & onboarding — Google sign-in, create-household, join-via-invite, settings shell.
4. Drive adapter — token crypto, OAuth scope upgrade, DriveClient, folder bootstrap, upload/download/list Edge Functions.
5. App shell + empty dashboard — nav, top bar, FAB, 8 empty-state cards.
6. Cross-cutting infra — notifications (in-app + push + VAPID), AI suggest framework + usage cap, ICS feed endpoint, RRULE helpers.
7. Feature modules in this order (each = tables → RLS → routes → UI → dashboard card wiring → tests):
   1. **Vault** — simplest, exercises Drive heavily (good shakedown).
   2. **Money** — exercises AI framework (receipt OCR) and Drive together.
   3. **Home** — exercises RRULE and calendar view contract.
   4. **Food** — most relational tables; grocery generator + meal plan.
   5. **Wardrobe** — most photo-heavy; per-item privacy.
   6. **Travel** — cross-module link to Wardrobe (packing).
   7. **Calendar** — last; mostly views over modules above. Built late so its sources exist.
8. Polish pass — empty states, error toasts, loading skeletons, PWA install prompts, iOS push instructions.
9. Pre-launch checklist — RLS cross-household audit, Drive token rotation test, push test on real iOS + Android device, full E2E run, Lighthouse PWA score.

## 13. Out of scope (v1)

- Bank integration (Plaid / TrueLayer)
- Two-way Google Calendar sync
- Client-side encryption for vault docs
- Wardrobe background removal
- Multi-household per user
- Native mobile app (PWA covers it)
- Email digests
- SMS notifications
- Family / >2 person households (architecture is 2-person-specifically — enforced by trigger)

## 14. Open risks (acknowledged)

- **Scope.** Building 7 modules in one release was a user decision against the recommended foundation-first phasing. Risk: long time-to-first-usable; bugs in shared infrastructure block testing across many modules; design pivots during use will cause rework. Mitigation: strict build order (§12) so each layer is testable before the next is built on it.
- **Single point of failure on Drive owner.** If the owner revokes Drive permission or deletes their Google account, the partner loses access to all stored files. Mitigation: clear in-app banner on disconnect; future enhancement to allow ownership transfer.
- **AI cost runaway.** Mitigated by per-household monthly cap (default 100 calls).
- **PWA push on iOS.** Requires installation as PWA first. Setup screen has explainer; acceptable trade-off vs native build.
