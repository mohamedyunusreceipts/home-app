'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { generateOutfit, type GenItem } from './outfit-gen'
import { saveOutfitAction, type ActionResult } from '@/app/(app)/wardrobe/actions'
import { CATEGORY_LABELS } from './format'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200'

type DisplayItem = GenItem & { label: string }

/**
 * Client-side outfit generator UI. Runs the PURE deterministic generator
 * (components/wardrobe/outfit-gen) — re-roll bumps a seed (no Math.random).
 * The `excludeIds` prop lets a parent exclude items already packed for a trip.
 */
export function GeneratorClient({
  items,
  excludeIds = [],
  packingMode = false,
}: {
  items: DisplayItem[]
  excludeIds?: string[]
  packingMode?: boolean
}) {
  const [occasion, setOccasion] = useState('')
  const [season, setSeason] = useState('')
  const [seed, setSeed] = useState(0)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])

  const outfit = useMemo(
    () =>
      generateOutfit(
        items,
        { occasion: occasion || null, season: season || null },
        { seed, excludeIds },
      ),
    [items, occasion, season, seed, excludeIds],
  )

  async function handleSave(formData: FormData) {
    setSaving(true)
    setSaveMsg(null)
    outfit.itemIds.forEach((id) => formData.append('item_ids', id))
    if (occasion) formData.set('occasion', occasion)
    const result: ActionResult = await saveOutfitAction(formData)
    setSaving(false)
    setSaveMsg('error' in result ? result.error : 'Outfit saved.')
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="gen-occasion" className="block text-sm font-medium text-sage-800">
            Occasion <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="gen-occasion"
            type="text"
            value={occasion}
            onChange={(e) => {
              setOccasion(e.target.value)
              setSeed(0)
            }}
            placeholder="e.g. work"
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="gen-season" className="block text-sm font-medium text-sage-800">
            Season <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="gen-season"
            type="text"
            value={season}
            onChange={(e) => {
              setSeason(e.target.value)
              setSeed(0)
            }}
            placeholder="e.g. summer"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setSeed((s) => s + 1)}>
          {seed === 0 ? 'Generate outfit' : 'Re-roll'}
        </Button>
        {seed > 0 && (
          <Button type="button" variant="outline" onClick={() => setSeed(0)}>
            Reset
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="space-y-3 p-4">
          {outfit.itemIds.length === 0 ? (
            <p className="text-sage-700">
              {packingMode
                ? 'No eligible items — everything matching is either in the wash or already packed.'
                : 'No items match these filters yet. Add more clothes or loosen the occasion / season.'}
            </p>
          ) : (
            <ul className="space-y-1">
              {outfit.itemIds.map((id) => {
                const it = byId.get(id)
                if (!it) return null
                return (
                  <li key={id} className="text-sage-800">
                    <span className="font-medium">
                      {CATEGORY_LABELS[it.category] ?? it.category}:
                    </span>{' '}
                    {it.label}
                  </li>
                )
              })}
            </ul>
          )}

          {outfit.missingCategories.length > 0 && (
            <p className="text-xs text-sage-500">
              No{' '}
              {outfit.missingCategories
                .map((c) => (CATEGORY_LABELS[c] ?? c).toLowerCase())
                .join(', ')}{' '}
              available for this combination.
            </p>
          )}
        </CardContent>
      </Card>

      {outfit.itemIds.length > 0 && (
        <form action={handleSave} className="flex flex-wrap items-end gap-2">
          <div className="space-y-2">
            <label htmlFor="outfit-name" className="block text-sm font-medium text-sage-800">
              Save as
            </label>
            <input
              id="outfit-name"
              name="name"
              type="text"
              required
              placeholder="e.g. Friday smart-casual"
              className={inputClass}
            />
          </div>
          <Button type="submit" variant="outline" disabled={saving}>
            {saving ? 'Saving…' : 'Save outfit'}
          </Button>
        </form>
      )}

      {saveMsg && (
        <p className="text-sm text-sage-600" role="status">
          {saveMsg}
        </p>
      )}
    </div>
  )
}
