#!/usr/bin/env node
// MBA local sync: your Drive folder → the Home app's MBA tables.
//
//   npm run mba:sync                 # schedule + readings + doc summaries (+ AI if key set)
//   npm run mba:sync -- --dry-run    # show what would change, write nothing
//   npm run mba:sync -- --no-ai      # skip AI summary generation
//   npm run mba:sync -- --force-ai   # regenerate AI summaries that already exist
//   npm run mba:sync -- --only=PPM   # limit AI generation to one course
//
// Reads the PRIVATE config .mba/schedule.json (gitignored — the repo is public),
// scans the course folders for readings/slides, splits your "Session
// Pre-reading Summaries.docx" files into per-session summaries, optionally asks
// Claude to summarise PDF readings for courses without notes, and upserts it all
// with the service-role key from .env.production.local.
//
// It never sends user-owned columns (prepared, notebook link, notes, done), so
// re-running is always safe.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { docxSections, headingKey, headingTopic } from './docx.mjs'

const ROOT = process.cwd()
const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry-run')
const NO_AI = args.has('--no-ai')
const FORCE_AI = args.has('--force-ai')
const ONLY = [...args].find((a) => a.startsWith('--only='))?.slice(7)

// ── env + config ──────────────────────────────────────────────────────────────
function loadEnvFile(name) {
  const p = join(ROOT, name)
  if (!existsSync(p)) return {}
  return Object.fromEntries(
    readFileSync(p, 'utf8')
      .split(/\r?\n/)
      .filter((l) => /^[A-Z0-9_]+=/.test(l))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
      }),
  )
}
// Production (hosted) wins for Supabase; any file or the shell may supply the AI key.
const env = { ...loadEnvFile('.env.local'), ...loadEnvFile('.env.production.local'), ...process.env }

const configPath = join(ROOT, '.mba/schedule.json')
if (!existsSync(configPath)) {
  console.error('Missing .mba/schedule.json — see docs/mba-sync.md.')
  process.exit(1)
}
const cfg = JSON.parse(readFileSync(configPath, 'utf8'))
const TZ = cfg.timezone ?? 'Africa/Johannesburg'
const SESSION_MS = (cfg.sessionMinutes ?? 135) * 60_000
const MBA_ROOT = cfg.mbaRoot
if (!existsSync(MBA_ROOT)) {
  console.error(`MBA folder not found: ${MBA_ROOT}`)
  process.exit(1)
}

// ── time helpers (wall-clock in TZ → UTC) ────────────────────────────────────
function tzOffsetMs(utcMs) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs))
  const g = (t) => Number(parts.find((p) => p.type === t).value)
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - utcMs
}
function localToUtc(y, mo, d, h, mi) {
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  let t = guess - tzOffsetMs(guess)
  const off2 = tzOffsetMs(t)
  if (guess - off2 !== t) t = guess - off2
  return new Date(t)
}
/** "2026-10-29T19:00" → {date, allDay:false}; "2026-10-25" → 23:59 that day, allDay. */
function parseLocal(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(s)
  if (!m) throw new Error(`Bad date "${s}" (use YYYY-MM-DD or YYYY-MM-DDTHH:MM)`)
  const [, y, mo, d, h, mi] = m.map(Number)
  return m[4] === undefined
    ? { date: localToUtc(y, mo, d, 23, 59), allDay: true }
    : { date: localToUtc(y, mo, d, h, mi), allDay: false }
}
const dayKey = (date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)

// ── sessions from config ─────────────────────────────────────────────────────
const normKey = (k) => (/^0+\d/.test(k) ? String(Number(k)) : k)

const sessions = cfg.sessions.map((s, i) => {
  const start = s.start ? parseLocal(s.start).date : null
  return {
    course: s.course,
    key: s.key,
    keys: (s.keys ?? [s.key]).map(normKey),
    title: s.title,
    start,
    end: s.end ? parseLocal(s.end).date : start ? new Date(start.getTime() + SESSION_MS) : null,
    mode: s.mode ?? null,
    sortOrder: i,
    readings: [],
    summary: null,
    summarySource: null,
  }
})
const findSession = (course, key) =>
  sessions.find((s) => s.course === course && s.keys.includes(normKey(key)))

// ── readings + slides from the Drive folders ─────────────────────────────────
const READABLE = new Set(['.pdf', '.docx', '.doc', '.pptx', '.ppt', '.xlsx'])
const cleanTitle = (file) =>
  file.replace(/\.[^.]+$/, '').replace(/\s*-\s*Copy$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim()
const filesIn = (dir) =>
  readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile() && READABLE.has(extname(f).toLowerCase()))

const unmatched = []
function attach(session, absPath, kind, title) {
  const rel = relative(MBA_ROOT, absPath).split('\\').join('/')
  if (session.readings.some((r) => r.path === rel)) return
  session.readings.push({ title: title ?? cleanTitle(absPath.split(/[\\/]/).pop()), kind, path: rel })
}

for (const rule of cfg.readings ?? []) {
  if (rule.file) {
    const abs = join(MBA_ROOT, rule.file)
    const s = findSession(rule.course, rule.key)
    if (s && existsSync(abs)) attach(s, abs, rule.kind, rule.title)
    else unmatched.push(rule.file)
    continue
  }
  const dir = join(MBA_ROOT, rule.dir)
  if (!existsSync(dir)) {
    unmatched.push(`${rule.dir}/ (folder missing)`)
    continue
  }
  const re = new RegExp(rule.pattern, 'i')

  if (rule.match === 'dir') {
    for (const sub of readdirSync(dir)) {
      const abs = join(dir, sub)
      if (!statSync(abs).isDirectory()) continue
      const m = re.exec(sub)
      const s = m && findSession(rule.course, m[1])
      if (!s) continue
      for (const f of filesIn(abs)) attach(s, join(abs, f), rule.kind)
    }
    continue
  }

  for (const f of filesIn(dir)) {
    const m = re.exec(f)
    let s = null
    if (m && rule.match === 'date') {
      const key = `${m[1]}-${m[2]}-${m[3]}`
      s = sessions.find((x) => x.course === rule.course && x.start && dayKey(x.start) === key)
    } else if (m) {
      s = findSession(rule.course, m[1])
    }
    if (s) attach(s, join(dir, f), rule.kind)
    else unmatched.push(`${rule.dir}/${f}`)
  }
}

// ── summaries from your pre-reading notes (.docx) ────────────────────────────
for (const doc of cfg.summaryDocs ?? []) {
  const abs = join(MBA_ROOT, doc.file)
  if (!existsSync(abs)) {
    console.warn(`! Summary doc not found: ${doc.file}`)
    continue
  }
  const byKey = new Map()
  for (const sec of docxSections(abs)) {
    const k = headingKey(sec.heading)
    if (k && sec.markdown) byKey.set(k, sec)
  }
  for (const s of sessions.filter((x) => x.course === doc.course)) {
    const secs = s.keys.map((k) => byKey.get(k)).filter(Boolean)
    if (!secs.length) continue
    s.summary =
      secs.length === 1
        ? secs[0].markdown
        : secs.map((sec) => `## ${headingTopic(sec.heading)}\n\n${sec.markdown}`).join('\n\n')
    s.summarySource = 'doc'
  }
}

// ── deadlines from config ────────────────────────────────────────────────────
const deadlines = cfg.deadlines.map((d) => {
  const due = parseLocal(d.due)
  return {
    external_uid: d.id,
    course_code: d.course ?? null,
    title: d.title,
    kind: d.kind ?? 'other',
    due_at: due.date.toISOString(),
    all_day: due.allDay,
    weight: d.weight ?? null,
    details: d.details ?? null,
  }
})

// ── write ────────────────────────────────────────────────────────────────────
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (.env.production.local).')
  process.exit(1)
}
const sb = createClient(url, serviceKey, { auth: { persistSession: false } })
const userId = cfg.userId
const now = new Date().toISOString()

async function must(promise, what) {
  const { data, error } = await promise
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

console.log(`MBA sync → ${new URL(url).host}${DRY ? '  (dry run — nothing will be written)' : ''}\n`)

if (!DRY) {
  await must(
    sb.from('mba_courses').upsert(
      cfg.courses.map((c) => ({
        user_id: userId, code: c.code, name: c.name, convenor: c.convenor ?? null,
        color: c.color, aliases: c.aliases ?? [], updated_at: now,
      })),
      { onConflict: 'user_id,code' },
    ),
    'courses',
  )

  // Sessions with a doc summary send it; the rest leave summary untouched (an
  // earlier AI summary survives).
  const sessionRow = (s) => ({
    user_id: userId, course_code: s.course, session_key: s.key, sort_order: s.sortOrder,
    title: s.title, starts_at: s.start?.toISOString() ?? null, ends_at: s.end?.toISOString() ?? null,
    mode: s.mode, readings: s.readings, updated_at: now,
  })
  const withDoc = sessions.filter((s) => s.summarySource === 'doc')
  const withoutDoc = sessions.filter((s) => s.summarySource !== 'doc')
  if (withDoc.length) {
    await must(
      sb.from('mba_sessions').upsert(
        withDoc.map((s) => ({ ...sessionRow(s), summary: s.summary, summary_source: 'doc' })),
        { onConflict: 'user_id,course_code,session_key' },
      ),
      'sessions',
    )
  }
  if (withoutDoc.length) {
    await must(
      sb.from('mba_sessions').upsert(withoutDoc.map(sessionRow), { onConflict: 'user_id,course_code,session_key' }),
      'sessions',
    )
  }

  await must(
    sb.from('mba_deadlines').upsert(
      deadlines.map((d) => ({ ...d, user_id: userId, source: 'schedule', updated_at: now })),
      { onConflict: 'user_id,source,external_uid' },
    ),
    'deadlines',
  )

  // Drop schedule rows that were removed from the config.
  const keep = new Set(deadlines.map((d) => d.external_uid))
  const existingD = await must(
    sb.from('mba_deadlines').select('id, external_uid').eq('user_id', userId).eq('source', 'schedule'),
    'read deadlines',
  )
  const staleD = existingD.filter((r) => !keep.has(r.external_uid)).map((r) => r.id)
  if (staleD.length) await must(sb.from('mba_deadlines').delete().in('id', staleD), 'prune deadlines')

  const keepS = new Set(sessions.map((s) => `${s.course}|${s.key}`))
  const existingS = await must(
    sb.from('mba_sessions').select('id, course_code, session_key').eq('user_id', userId),
    'read sessions',
  )
  const staleS = existingS.filter((r) => !keepS.has(`${r.course_code}|${r.session_key}`)).map((r) => r.id)
  if (staleS.length) await must(sb.from('mba_sessions').delete().in('id', staleS), 'prune sessions')
}

// ── report ───────────────────────────────────────────────────────────────────
const byCourse = new Map()
for (const s of sessions) byCourse.set(s.course, [...(byCourse.get(s.course) ?? []), s])
console.log('Course  Sessions  Readings  Slides  Summaries(doc)')
for (const [code, list] of byCourse) {
  const n = (kind) => list.reduce((a, s) => a + s.readings.filter((r) => r.kind === kind).length, 0)
  console.log(
    `${code.padEnd(8)}${String(list.length).padStart(8)}${String(n('reading') + n('book')).padStart(10)}${String(n('slides')).padStart(8)}${String(list.filter((s) => s.summarySource === 'doc').length).padStart(16)}`,
  )
}
console.log(`\nDeadlines: ${deadlines.length}`)
if (unmatched.length) {
  console.log(`\nFiles not matched to a session (fine if they're extras):`)
  for (const u of unmatched) console.log(`  · ${u}`)
}

// ── AI summaries for courses without notes ──────────────────────────────────
const aiCourses = (cfg.aiSummaries ?? []).map((a) => a.course).filter((c) => !ONLY || c === ONLY)
if (NO_AI || !aiCourses.length) {
  console.log('\nAI summaries: skipped.')
  process.exit(0)
}
const apiKey = env.ANTHROPIC_API_KEY
if (!apiKey) {
  console.log(
    `\nAI summaries: skipped — no ANTHROPIC_API_KEY.\n` +
      `  Add ANTHROPIC_API_KEY=... to .env.local (never paste it in chat) and re-run to\n` +
      `  generate summaries for: ${aiCourses.join(', ')}.`,
  )
  process.exit(0)
}

const { default: Anthropic } = await import('@anthropic-ai/sdk')
const anthropic = new Anthropic({ apiKey })
const MODEL = env.MBA_SUMMARY_MODEL || 'claude-sonnet-5'
const MAX_PDF_BYTES = 30 * 1024 * 1024

const existing = DRY
  ? []
  : await must(
      sb.from('mba_sessions').select('course_code, session_key, summary_source').eq('user_id', userId),
      'read summaries',
    )
const hasSummary = (s) =>
  existing.some((r) => r.course_code === s.course && r.session_key === s.key && r.summary_source)

const FORMAT_RULES = `Use ONLY this markdown subset: "## " headings, "### " sub-headings, "- " bullets, **bold**, and plain paragraphs. No tables, links, numbered lists or other syntax.
Write in your own words — do not reproduce passages (at most one short quotation per reading). Stay faithful to the source; if something isn't in it, don't add it.`

async function noteOnReading(course, session, reading) {
  const abs = join(MBA_ROOT, reading.path)
  const size = statSync(abs).size
  if (extname(abs).toLowerCase() !== '.pdf') return null
  if (size > MAX_PDF_BYTES) return `### ${reading.title}\n\n- (Skipped: file too large to summarise.)`
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: readFileSync(abs).toString('base64') }, title: reading.title },
          {
            type: 'text',
            text: `I'm an MBA student preparing for ${course.name} — Session ${session.key}: "${session.title}". Write concise study notes on this pre-reading.

Start with "### " followed by the reading's real title and authors (from the document). Then:
- 1–2 sentence gist
- the key arguments, frameworks or models (bulleted, with one-line explanations)
- the most important evidence, examples or cases
- one bullet on how it relates to "${session.title}"

${FORMAT_RULES} Aim for 200–350 words.`,
          },
        ],
      },
    ],
  })
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
}

async function synthesise(course, session, notes) {
  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1200,
    messages: [
      {
        role: 'user',
        content: `I'm an MBA student preparing for ${course.name} — Session ${session.key}: "${session.title}". Below are my notes on each pre-reading. Write the opening of my session brief.

Output exactly these sections:
## Big picture
(2–3 sentences tying the readings together)
## Key concepts
(5–8 bullets: **term** — one-line definition)
## How the readings connect
(2–4 bullets on agreements, tensions, or how one builds on another)
## Questions to bring to class
(3–5 bullets, applied to managing people in practice)
## If you only have 10 minutes
(3 bullets)

${FORMAT_RULES} Base everything only on these notes.

NOTES:
${notes.join('\n\n')}`,
      },
    ],
  })
  return res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim()
}

console.log(`\nAI summaries (${MODEL}) for: ${aiCourses.join(', ')}`)
let generated = 0
for (const code of aiCourses) {
  const course = cfg.courses.find((c) => c.code === code)
  for (const s of sessions.filter((x) => x.course === code)) {
    const readings = s.readings.filter((r) => r.kind === 'reading' && extname(r.path).toLowerCase() === '.pdf')
    if (!readings.length) continue
    if (hasSummary(s) && !FORCE_AI) {
      console.log(`  ${code} ${s.key}: has a summary (use --force-ai to regenerate)`)
      continue
    }
    if (DRY) {
      console.log(`  ${code} ${s.key}: would summarise ${readings.length} reading(s)`)
      continue
    }
    try {
      process.stdout.write(`  ${code} ${s.key} "${s.title}": ${readings.length} reading(s)… `)
      const notes = []
      for (const r of readings) {
        const n = await noteOnReading(course, s, r)
        if (n) notes.push(n)
      }
      const brief = await synthesise(course, s, notes)
      const summary = `${brief}\n\n## Reading by reading\n\n${notes.join('\n\n')}`
      await must(
        sb.from('mba_sessions')
          .update({ summary, summary_source: 'ai', updated_at: new Date().toISOString() })
          .eq('user_id', userId).eq('course_code', code).eq('session_key', s.key),
        'save summary',
      )
      generated++
      console.log('done')
    } catch (e) {
      console.log(`failed — ${e.message}`)
    }
  }
}
console.log(`\nGenerated ${generated} AI summar${generated === 1 ? 'y' : 'ies'}.`)
