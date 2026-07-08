# Settlement installment reminders — scheduling the cron

The settle-up module reminds the ower when an installment on their payment plan
is due, via the endpoint:

```
POST https://home-app-livid.vercel.app/api/cron/settlements
Authorization: Bearer <CRON_SECRET>
```

Installments are **daily-grain** (a plan's `next_due` is a date), so this does
not need per-minute precision — a **~15-minute** cadence is plenty. On each call
it:

1. Reads every `active` `settlement_plans` row whose `next_due <= today` (app
   timezone, Africa/Johannesburg).
2. Skips any plan already reminded today (`last_reminded_on = today`), so repeated
   15-min runs on the same day never double-send.
3. Recomputes the household's outstanding balance (split debt minus repayments).
   - If the household is **square** (or the debt has flipped so this plan's ower
     no longer owes), it **deactivates** the plan (`active = false`) instead of
     reminding.
   - Otherwise it pushes + writes an in-app notification to the **ower**
     ("Reminder: R<installment> repayment to <partner> is due"), stamps
     `last_reminded_on = today`, and advances `next_due` via the plan's RRULE
     (`nextOccurrence`).

Each plan is wrapped in its own try/catch, so one bad plan never 500s the job.
It returns `{ checked, sent }`.

Auth:
- Missing `CRON_SECRET` env → **503** (not configured).
- Wrong / missing `Authorization` header → **401**.

## Recommended: Supabase pg_cron + pg_net (run once in the hosted SQL editor)

> Run this in the **hosted** project's SQL editor (production). Local Supabase
> does not ship `pg_cron`, which is why there is no migration for this — adding
> one would break `supabase migration up` locally.

Reuse the **same** `CRON_SECRET` / `app.cron_secret` already configured for the
salaah cron (see `docs/salaah-cron.md`). If that is already set you only need the
`cron.schedule` call below.

```sql
-- Extensions + secret are shared with the salaah cron; included here for a
-- standalone setup (all idempotent).
create extension if not exists pg_cron;
create extension if not exists pg_net;
alter database postgres set app.cron_secret = 'PASTE_THE_SAME_SECRET_HERE';

-- Schedule a POST to the settlements cron every 15 minutes.
select cron.schedule(
  'settlement-reminders',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := 'https://home-app-livid.vercel.app/api/cron/settlements',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
      )
    )
  $$
);
```

To inspect or remove the job later:

```sql
select * from cron.job;                       -- list jobs
select cron.unschedule('settlement-reminders');
```

## Alternative: Vercel Cron (Pro tier)

On Vercel **Pro**, add to `vercel.json` (Vercel auto-sends the
`Authorization: Bearer <CRON_SECRET>` header to cron routes):

```json
{
  "crons": [{ "path": "/api/cron/settlements", "schedule": "*/15 * * * *" }]
}
```
