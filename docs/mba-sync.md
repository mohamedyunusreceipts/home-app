# MBA module — local sync

The MBA screen (`/mba`) is fed from two directions:

| Source | How it gets in | What it provides |
|---|---|---|
| Your course folder (e.g. a synced Google Drive folder) | `npm run mba:sync` on your computer | Timetable sessions, deadlines, readings/slides per session, per-session summaries |
| Calendar feeds (LMS + mailbox ICS links) | Connected in-app; synced on open (if >6h old), on "Sync now", or by `/api/cron/mba` | Assignment/quiz due dates, team meetings, lecture invites + join links |

The app is deployed, so it can't read your disk — the local script is the bridge.

## Private config — `.mba/schedule.json`

**Gitignored on purpose: this repository is public.** It holds your schedule and
user id, so it must never be committed.

```jsonc
{
  "userId": "<your auth user id>",
  "mbaRoot": "G:/My Drive/<course folder>",
  "timezone": "Africa/Johannesburg",
  "sessionMinutes": 135,
  "courses":  [{ "code": "ABC", "name": "Course name", "convenor": "…", "color": "#C77B5C", "aliases": [] }],
  "sessions": [{ "course": "ABC", "key": "1", "title": "Topic", "start": "2026-10-08T08:00", "mode": "in_person",
                 "keys": ["1.1", "1.2"] /* optional: reading/summary keys this slot covers */ }],
  "deadlines": [{ "id": "abc-exam", "course": "ABC", "title": "Final exam", "kind": "exam",
                  "due": "2026-12-12T09:00" /* or "2026-12-12" = end of day */, "weight": "60%", "details": "…" }],
  "readings": [
    { "course": "ABC", "dir": "ABC/Pre readings", "match": "dir",  "pattern": "^Session (\\d+)", "kind": "reading" },
    { "course": "ABC", "dir": "ABC/Readings",     "match": "file", "pattern": "Session (\\d+)",  "kind": "reading" },
    { "course": "ABC", "dir": "ABC/Slides",       "match": "date", "pattern": "^(\\d{4})_(\\d{2})_(\\d{2})", "kind": "slides" },
    { "course": "ABC", "file": "ABC/Textbook.pdf", "key": "1", "kind": "book", "title": "Course textbook" }
  ],
  "summaryDocs": [{ "course": "ABC", "file": "ABC/Session Pre-reading Summaries.docx" }],
  "aiSummaries": [{ "course": "XYZ" }]
}
```

- `match: "dir"` — sub-folders named like the pattern hold that session's files.
- `match: "file"` — file names carry the session key.
- `match: "date"` — file names carry `YYYY_MM_DD`, matched to that day's session.
- `summaryDocs` — a .docx with one **Heading 2** per session ("Session 3 …",
  "Sessions 5 and 6 …") is split into per-session summaries.
- `aiSummaries` — for courses without notes, each PDF reading is summarised by
  Claude, then a session brief is synthesised. Needs `ANTHROPIC_API_KEY` in
  `.env.local` (set it in the file — never paste keys into chat). Model:
  `MBA_SUMMARY_MODEL` (default `claude-sonnet-5`). Existing AI summaries are kept
  unless you pass `--force-ai`.

## Running

```bash
npm run mba:sync                # everything
npm run mba:sync -- --dry-run   # report only, write nothing
npm run mba:sync -- --no-ai     # skip AI summaries
npm run mba:sync -- --only=XYZ  # AI summaries for one course
```

Writes use the service-role key from `.env.production.local`. Re-running is safe:
upserts never touch what you set in the app (prepared ticks, NotebookLM links,
notes, deadline "done"). Sessions/deadlines removed from the config are pruned.
