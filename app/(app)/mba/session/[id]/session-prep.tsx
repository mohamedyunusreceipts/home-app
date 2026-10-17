'use client'

import { useState, useTransition } from 'react'
import { useShell } from '@/components/shell/shell-context'
import { saveSessionDetails, setSessionPrepared } from '../../actions'
import { Card, Icon, ICONS, SectionTitle, Tick } from '../../parts'

export function SessionPrep({
  id,
  prepared: initialPrepared,
  notebookUrl: initialUrl,
  notes: initialNotes,
  readingTitles,
}: {
  id: string
  prepared: boolean
  notebookUrl: string | null
  notes: string | null
  readingTitles: string[]
}) {
  const { showToast } = useShell()
  const [pending, startTransition] = useTransition()
  const [prepared, setPrepared] = useState(initialPrepared)
  const [notebookUrl, setNotebookUrl] = useState(initialUrl ?? '')
  const [notes, setNotes] = useState(initialNotes ?? '')
  const dirty = notebookUrl !== (initialUrl ?? '') || notes !== (initialNotes ?? '')

  function togglePrepared(next: boolean) {
    setPrepared(next)
    startTransition(async () => {
      const r = await setSessionPrepared(id, next)
      if ('error' in r) {
        setPrepared(!next)
        showToast(r.error)
      } else {
        showToast(next ? 'Nice — marked as prepared' : 'Marked as not prepared')
      }
    })
  }

  function save() {
    startTransition(async () => {
      const r = await saveSessionDetails(id, { notebookUrl, notes })
      showToast('error' in r ? r.error : 'Saved')
    })
  }

  async function copyReadings() {
    try {
      await navigator.clipboard.writeText(readingTitles.join('\n'))
      showToast('Reading list copied')
    } catch {
      showToast('Could not copy on this device')
    }
  }

  return (
    <Card>
      <SectionTitle>Prep</SectionTitle>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] bg-white px-3 py-3">
        <div>
          <p className="text-[15px] font-semibold text-terracotta-900">Pre-reading done</p>
          <p className="text-[12px] text-[#8a7163]">Tick once you&apos;re ready for this session.</p>
        </div>
        <Tick checked={prepared} onChange={togglePrepared} label="Pre-reading done" disabled={pending} />
      </div>

      <div className="mt-4">
        <label htmlFor="nb" className="text-[12px] font-medium text-[#8a7163]">
          NotebookLM notebook / audio overview
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id="nb"
            type="url"
            inputMode="url"
            value={notebookUrl}
            onChange={(e) => setNotebookUrl(e.target.value)}
            placeholder="https://notebooklm.google.com/notebook/…"
            className="min-w-0 flex-1 rounded-[12px] border border-cream-300 bg-white px-3 py-2.5 text-[14px] text-terracotta-900"
          />
          {initialUrl ? (
            <a
              href={initialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#7A9B7A] px-4 text-[13px] font-semibold text-white hover:bg-[#6A8B6A]"
            >
              <Icon d={ICONS.headphones} size={14} /> Listen
            </a>
          ) : null}
        </div>
        {!initialUrl ? (
          <p className="mt-1.5 text-[12px] text-[#8a7163]">
            Make one at{' '}
            <a
              href="https://notebooklm.google.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-sage-600 hover:underline"
            >
              notebooklm.google.com
            </a>
            : add this session&apos;s readings from Drive, generate an Audio Overview, then paste the
            notebook link here.{' '}
            {readingTitles.length ? (
              <button type="button" onClick={copyReadings} className="font-semibold text-sage-600 hover:underline">
                Copy reading list
              </button>
            ) : null}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor="notes" className="text-[12px] font-medium text-[#8a7163]">
          My notes
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          maxLength={20_000}
          placeholder="Questions to raise, key takeaways, links…"
          className="mt-1 w-full rounded-[12px] border border-cream-300 bg-white px-3 py-2.5 text-[14px] text-terracotta-900"
        />
      </div>

      {dirty ? (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="mt-3 w-full rounded-full bg-terracotta-400 px-4 py-2.5 text-[14px] font-semibold text-cream-50 hover:bg-terracotta-500 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      ) : null}
    </Card>
  )
}
