'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PhotoField } from './photo-field'
import { saveItemAction, type ActionResult } from '@/app/(app)/wardrobe/actions'
import { WARDROBE_CATEGORIES } from './types'
import { CATEGORY_LABELS } from './format'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export type ItemDefaults = {
  id: string
  category: string
  color: string
  brand: string
  size: string
  notes: string
  season: string
  occasion: string
  photoDriveFileId: string
  visibleToPartner: boolean
}

export function ItemForm({
  defaults,
  ownerUserId,
}: {
  defaults: ItemDefaults
  ownerUserId: string
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [category, setCategory] = useState(defaults.category || 'top')
  // Spec §9.6: underwear defaults to private. For a brand-new underwear item the
  // share box starts unticked; otherwise honour the stored value.
  const [share, setShare] = useState(
    defaults.id ? defaults.visibleToPartner : defaults.category === 'underwear' ? false : true,
  )

  function onCategoryChange(next: string) {
    setCategory(next)
    // Only auto-flip the default for a NEW item (no id yet).
    if (!defaults.id) setShare(next !== 'underwear')
  }

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result: ActionResult = await saveItemAction(formData)
    if (result && 'error' in result) {
      setError(result.error)
      setPending(false)
    }
    // On success the action redirects.
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}

      <div className="space-y-2">
        <label htmlFor="category" className="block text-sm font-medium text-sage-800">
          Category
        </label>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={inputClass}
          disabled={pending}
        >
          {WARDROBE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="color" className="block text-sm font-medium text-sage-800">
            Colour <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="color"
            name="color"
            type="text"
            maxLength={40}
            defaultValue={defaults.color}
            placeholder="e.g. navy"
            className={inputClass}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="brand" className="block text-sm font-medium text-sage-800">
            Brand <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="brand"
            name="brand"
            type="text"
            maxLength={60}
            defaultValue={defaults.brand}
            className={inputClass}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="size" className="block text-sm font-medium text-sage-800">
            Size <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="size"
            name="size"
            type="text"
            maxLength={30}
            defaultValue={defaults.size}
            className={inputClass}
            disabled={pending}
          />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="season" className="block text-sm font-medium text-sage-800">
          Seasons <span className="text-sage-500">(comma-separated)</span>
        </label>
        <input
          id="season"
          name="season"
          type="text"
          defaultValue={defaults.season}
          placeholder="e.g. summer, autumn"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="occasion" className="block text-sm font-medium text-sage-800">
          Occasions <span className="text-sage-500">(comma-separated)</span>
        </label>
        <input
          id="occasion"
          name="occasion"
          type="text"
          defaultValue={defaults.occasion}
          placeholder="e.g. work, formal"
          className={inputClass}
          disabled={pending}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes" className="block text-sm font-medium text-sage-800">
          Notes <span className="text-sage-500">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          defaultValue={defaults.notes}
          className={inputClass}
          disabled={pending}
        />
      </div>

      <PhotoField
        ownerUserId={ownerUserId}
        initialDriveFileId={defaults.photoDriveFileId}
        disabled={pending}
      />

      <label className="flex items-center gap-2 rounded-md border border-sage-200 p-3 text-sm font-medium text-sage-800">
        <input
          name="visible_to_partner"
          type="checkbox"
          checked={share}
          onChange={(e) => setShare(e.target.checked)}
          className="size-4 accent-terracotta-500"
          disabled={pending}
        />
        Visible to my partner
        {category === 'underwear' && (
          <span className="text-xs font-normal text-sage-500">
            (underwear is private by default)
          </span>
        )}
      </label>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save item'}
      </Button>
    </form>
  )
}
