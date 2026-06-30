# Salaah prayer-time push — scheduling the cron

The Salaah module fires a push notification at each prayer time via the endpoint:

```
POST https://home-app-livid.vercel.app/api/cron/salaah
Authorization: Bearer <CRON_SECRET>
```

The endpoint is **idempotent** and meant to be called **once a minute**. On each
call it:

1. Reads every `salaah_settings` row with `push_enabled = true`.
2. Computes today's times in that household's own timezone/coords/method/madhab.
3. For each enabled prayer whose time falls in the last ~6 minutes, it claims a
   `salaah_notify_log` row (`unique(household_id, prayer_date, prayer)`); if the
   claim succeeds (first run for that prayer) it pushes to every household member
   and writes an in-app notification. The unique constraint dedupes concurrent
   and overlapping runs, so a prayer is only ever sent once.

It returns `{ checked, sent }`.

Auth:
- Missing `CRON_SECRET` env → **503** (not configured).
- Wrong / missing `Authorization` header → **401**.

## Why not `vercel.json` crons (by default)

Vercel **Hobby** crons only run **once per day**, which is far too coarse for
per-prayer reminders. So the recommended scheduler is **Supabase pg_cron +
pg_net**, which can run every minute on any plan.

## Recommended: Supabase pg_cron + pg_net (run once in the hosted SQL editor)

> Run this in the **hosted** project's SQL editor (production). Local Supabase
> does not ship `pg_cron`, which is why there is no migration for this — adding
> one would break `supabase migration up` locally.

```sql
-- 1. Enable the extensions (idempotent).
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Store the shared secret on the database so the SQL job can send it.
--    Must equal the CRON_SECRET set in Vercel (see below).
alter database postgres set app.cron_secret = 'PASTE_THE_SAME_SECRET_HERE';

-- 3. Schedule a per-minute POST to the cron endpoint.
select cron.schedule(
  'salaah-push',
  '* * * * *',
  $$
    select net.http_post(
      url := 'https://home-app-livid.vercel.app/api/cron/salaah',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
      )
    )
  $$
);
```

To inspect or remove the job later:

```sql
select * from cron.job;            -- list jobs
select cron.unschedule('salaah-push');  -- remove it
```

> Note: `current_setting('app.cron_secret', true)` is read at job-run time. If
> you change the secret, re-run the `alter database … set app.cron_secret` line
> (a reconnect picks up the new value).

## Required configuration (one-time, by the user)

1. **Vercel env** — set `CRON_SECRET` to a long random string (Project Settings
   → Environment Variables). Redeploy so it takes effect.
2. **Database setting** — run the `alter database postgres set app.cron_secret`
   line above with the **same** value.
3. Ensure VAPID push is configured (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
   `VAPID_SUBJECT`, and `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) — without it the in-app
   notification still lands but the browser push fan-out is a no-op.

## Alternative: Vercel Cron (Pro tier)

On Vercel **Pro**, minute-level crons are available. Add to `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/salaah", "schedule": "* * * * *" }]
}
```

Vercel automatically sends an `Authorization: Bearer <CRON_SECRET>` header to
cron routes when `CRON_SECRET` is set, which this endpoint already validates.
```
