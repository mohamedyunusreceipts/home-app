# MBA calendar feeds — optional background sync

The MBA module imports two private ICS calendar feeds per user
(`mba_calendar_feeds`): the course site's calendar (`lms` — deliverables) and a
mailbox calendar (`mail` — meetings and lecture invites with join links).

**No cron is required.** Feeds sync when a link is connected, when "Sync now" is
tapped, and automatically whenever the MBA page is opened and the last sync is
more than 6 hours old (`STALE_AFTER_MS` in `lib/mba/sync-calendar.ts`).

Schedule the endpoint only if you want feeds refreshed even when the page isn't
opened (e.g. for future deadline reminders):

```
POST https://home-app-livid.vercel.app/api/cron/mba
Authorization: Bearer <CRON_SECRET>
```

Each call syncs up to 25 feeds that are stale (oldest first) and returns
`{ checked, synced, failed }`. Per-feed failures are recorded on the feed row
(`last_sync_error`, shown in the app) and never fail the job.

Auth: missing `CRON_SECRET` env → **503**; wrong/missing header → **401**.

## Supabase pg_cron + pg_net (run once in the hosted SQL editor)

Use the **same secret** as the existing salaah / settlement jobs. If your role
can't `alter database … set app.cron_secret`, put the secret in the job as a
literal — copy it from an existing job with `select command from cron.job;`.

```sql
select cron.schedule(
  'mba-calendar-sync',
  '0 * * * *',  -- hourly; only stale (>6h) feeds are actually fetched
  $$
    select net.http_post(
      url := 'https://home-app-livid.vercel.app/api/cron/mba',
      headers := jsonb_build_object('Authorization', 'Bearer PASTE_THE_SAME_SECRET_HERE')
    )
  $$
);
```

Inspect / remove:

```sql
select * from cron.job;
select cron.unschedule('mba-calendar-sync');
```
