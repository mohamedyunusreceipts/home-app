'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { savePreferencesAction, type ActionResult } from '@/app/(app)/wardrobe/actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200'

type SizeRow = { key: string; value: string }

/**
 * Per-user sizes (freeform key/value, e.g. "Tops"→"M", "Ring"→"R/2") + style
 * notes. Backed by wardrobe_preferences, shared with the Vault "Sizes &
 * preferences" tab (spec §9.7).
 */
export function PreferencesForm({
  initialSizes,
  initialNotes,
}: {
  initialSizes: SizeRow[]
  initialNotes: string
}) {
  const [rows, setRows] = useState<SizeRow[]>(
    initialSizes.length > 0 ? initialSizes : [{ key: '', value: '' }],
  )
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function update(i: number, patch: Partial<SizeRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
  }
  function addRow() {
    setRows((prev) => [...prev, { key: '', value: '' }])
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setMessage(null)
    const result: ActionResult = await savePreferencesAction(formData)
    setPending(false)
    setMessage('error' in result ? result.error : 'Saved.')
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="space-y-3">
        <p className="text-sm font-medium text-sage-800">Sizes</p>
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <input
              name="size_key"
              type="text"
              value={row.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="e.g. Tops"
              className={inputClass}
              disabled={pending}
            />
            <input
              name="size_value"
              type="text"
              value={row.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="e.g. M"
              className={inputClass}
              disabled={pending}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => removeRow(i)}
              disabled={pending}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={addRow} disabled={pending}>
          Add size
        </Button>
      </div>

      <div className="space-y-2">
        <label htmlFor="style_notes_md" className="block text-sm font-medium text-sage-800">
          Style notes
        </label>
        <textarea
          id="style_notes_md"
          name="style_notes_md"
          rows={4}
          defaultValue={initialNotes}
          placeholder="Colours you love, fits to avoid, anything a stylist should know…"
          className={inputClass}
          disabled={pending}
        />
      </div>

      {message && (
        <p className="text-sm text-sage-600" role="status">
          {message}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save preferences'}
      </Button>
    </form>
  )
}
