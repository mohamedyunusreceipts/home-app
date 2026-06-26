'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createRecipeAction } from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

type IngredientDraft = { name: string; qty: string; unit: string }

const emptyIngredient: IngredientDraft = { name: '', qty: '', unit: '' }

/**
 * Upload a recipe photo via /api/drive/upload (subcategory RecipePhotos).
 * Returns the Drive file id, or null with a human message when Drive isn't
 * connected (409) or upload otherwise fails — the recipe still saves without it.
 */
async function uploadPhoto(file: File): Promise<{ id: string } | { message: string }> {
  const fd = new FormData()
  fd.set('file', file)
  fd.set('module', 'Food')
  fd.set('subcategory', 'RecipePhotos')
  const res = await fetch('/api/drive/upload', { method: 'POST', body: fd })
  if (res.status === 409) {
    return { message: 'Google Drive isn’t connected, so the photo wasn’t saved. The recipe will still be saved.' }
  }
  if (!res.ok) {
    return { message: 'Couldn’t upload the photo. The recipe will still be saved.' }
  }
  const body = (await res.json().catch(() => ({}))) as { driveFileId?: string }
  const id = body.driveFileId
  return id ? { id } : { message: 'Photo upload returned no id; saving without it.' }
}

export function RecipeForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([{ ...emptyIngredient }])
  const [photo, setPhoto] = useState<File | null>(null)

  function updateIngredient(idx: number, patch: Partial<IngredientDraft>) {
    setIngredients((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    setNotice(null)

    // Optional photo upload first (degrades gracefully).
    if (photo) {
      const result = await uploadPhoto(photo)
      if ('id' in result) {
        formData.set('photo_drive_file_id', result.id)
      } else {
        setNotice(result.message)
      }
    }

    const cleaned = ingredients
      .map((i) => ({
        name: i.name.trim(),
        qty: i.qty.trim() === '' ? null : Number(i.qty),
        unit: i.unit.trim() || null,
      }))
      .filter((i) => i.name !== '')
    formData.set('ingredients', JSON.stringify(cleaned))

    const result = await createRecipeAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setIngredients([{ ...emptyIngredient }])
    setPhoto(null)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-sage-800">
            Recipe name
          </label>
          <input id="name" name="name" type="text" required className={inputClass} disabled={pending} />
        </div>

        <div className="space-y-2">
          <label htmlFor="servings" className="block text-sm font-medium text-sage-800">
            Servings
          </label>
          <input id="servings" name="servings" type="number" min="0" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="prep_min" className="block text-sm font-medium text-sage-800">
            Prep (min)
          </label>
          <input id="prep_min" name="prep_min" type="number" min="0" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="cook_min" className="block text-sm font-medium text-sage-800">
            Cook (min)
          </label>
          <input id="cook_min" name="cook_min" type="number" min="0" className={inputClass} disabled={pending} />
        </div>
        <div className="space-y-2">
          <label htmlFor="source_url" className="block text-sm font-medium text-sage-800">
            Source URL <span className="text-sage-500">(optional)</span>
          </label>
          <input id="source_url" name="source_url" type="url" className={inputClass} disabled={pending} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="tags" className="block text-sm font-medium text-sage-800">
            Tags <span className="text-sage-500">(comma-separated)</span>
          </label>
          <input id="tags" name="tags" type="text" placeholder="e.g. vegetarian, quick" className={inputClass} disabled={pending} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="instructions_md" className="block text-sm font-medium text-sage-800">
            Instructions <span className="text-sage-500">(Markdown)</span>
          </label>
          <textarea id="instructions_md" name="instructions_md" rows={4} className={inputClass} disabled={pending} />
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="photo" className="block text-sm font-medium text-sage-800">
            Photo <span className="text-sage-500">(optional, saved to Google Drive)</span>
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            className={inputClass}
            disabled={pending}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      <fieldset className="space-y-3 rounded-md border border-sage-200 p-3">
        <legend className="px-1 text-sm font-medium text-terracotta-700">Ingredients</legend>
        {ingredients.map((row, idx) => (
          <div key={idx} className="grid grid-cols-[1fr_80px_80px_auto] gap-2">
            <input
              type="text"
              aria-label={`Ingredient ${idx + 1} name`}
              placeholder="Ingredient"
              className={inputClass}
              value={row.name}
              disabled={pending}
              onChange={(e) => updateIngredient(idx, { name: e.target.value })}
            />
            <input
              type="number"
              step="0.001"
              min="0"
              aria-label={`Ingredient ${idx + 1} quantity`}
              placeholder="Qty"
              className={inputClass}
              value={row.qty}
              disabled={pending}
              onChange={(e) => updateIngredient(idx, { qty: e.target.value })}
            />
            <input
              type="text"
              aria-label={`Ingredient ${idx + 1} unit`}
              placeholder="Unit"
              className={inputClass}
              value={row.unit}
              disabled={pending}
              onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={pending || ingredients.length === 1}
              onClick={() => setIngredients((prev) => prev.filter((_, i) => i !== idx))}
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => setIngredients((prev) => [...prev, { ...emptyIngredient }])}
        >
          Add ingredient
        </Button>
      </fieldset>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-sage-600" role="status">
          {notice}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Save recipe'}
      </Button>
    </form>
  )
}
