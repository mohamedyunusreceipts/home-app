'use client'

import { useId, useState } from 'react'

/**
 * Searchable meal picker: type to filter, choose from your recipes / catalogue
 * meals / desserts, or keep whatever you typed as free text. Replaces the old
 * recipe <select> + free-text <datalist> combo.
 *
 * Emits a single value shape the callers already use:
 *   { recipeId }  → a saved recipe was chosen
 *   { freeText }  → a catalogue item or typed-in meal
 */
type RecipeOpt = { id: string; name: string }
type CatalogueOpt = { id: string; kind: 'food' | 'dessert'; name: string }
export type MealValue = { recipeId: string; freeText: string }

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sm text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

export function MealCombobox({
  recipes,
  catalogue,
  value,
  onChange,
  disabled,
  placeholder = 'Search or type a meal…',
}: {
  recipes: RecipeOpt[]
  catalogue: CatalogueOpt[]
  value: MealValue
  onChange: (next: MealValue) => void
  disabled?: boolean
  placeholder?: string
}) {
  const selectedLabel = value.recipeId
    ? recipes.find((r) => r.id === value.recipeId)?.name ?? ''
    : value.freeText ?? ''
  const [query, setQuery] = useState(selectedLabel)
  const [open, setOpen] = useState(false)
  const listboxId = useId()

  const q = query.trim().toLowerCase()
  const has = (name: string) => !q || name.toLowerCase().includes(q)
  const recs = recipes.filter((r) => has(r.name)).slice(0, 8)
  const meals = catalogue.filter((c) => c.kind === 'food' && has(c.name)).slice(0, 8)
  const desserts = catalogue.filter((c) => c.kind === 'dessert' && has(c.name)).slice(0, 8)
  const exact = [...recipes, ...catalogue].some((o) => o.name.toLowerCase() === q)

  const pickRecipe = (r: RecipeOpt) => {
    onChange({ recipeId: r.id, freeText: '' })
    setQuery(r.name)
    setOpen(false)
  }
  const pickText = (name: string) => {
    onChange({ recipeId: '', freeText: name })
    setQuery(name)
    setOpen(false)
  }

  return (
    <div
      className="relative"
      onBlur={(e) => {
        // Closing when focus leaves the whole combobox. Commit typed text as
        // free text unless it exactly matches the already-selected recipe.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setOpen(false)
        const typed = query.trim()
        if (typed && typed !== selectedLabel && !recipes.some((r) => r.name === typed)) {
          pickText(typed)
        }
      }}
    >
      <input
        type="text"
        className={inputClass}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        maxLength={120}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter') {
            e.preventDefault()
            if (recs[0] && q) pickRecipe(recs[0])
            else if (query.trim()) pickText(query.trim())
          }
        }}
      />

      {open && (recs.length > 0 || meals.length > 0 || desserts.length > 0 || query.trim()) ? (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-sage-200 bg-cream-50 py-1 shadow-lg"
        >
          <Group label="Recipes" items={recs.map((r) => ({ key: `r${r.id}`, name: r.name, on: () => pickRecipe(r) }))} />
          <Group label="Meals" items={meals.map((c) => ({ key: `m${c.id}`, name: c.name, on: () => pickText(c.name) }))} />
          <Group label="Desserts" items={desserts.map((c) => ({ key: `d${c.id}`, name: c.name, on: () => pickText(c.name) }))} />
          {query.trim() && !exact ? (
            <button
              type="button"
              onClick={() => pickText(query.trim())}
              className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-sm text-sage-800 hover:bg-terracotta-50"
            >
              <span className="text-terracotta-500">＋</span> Use &ldquo;{query.trim()}&rdquo;
            </button>
          ) : null}
          {recs.length === 0 && meals.length === 0 && desserts.length === 0 && !query.trim() ? (
            <p className="px-3 py-2 text-sm text-sage-500">Start typing to search…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function Group({
  label,
  items,
}: {
  label: string
  items: { key: string; name: string; on: () => void }[]
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="px-3 pb-0.5 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-sage-400">
        {label}
      </p>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          onClick={it.on}
          className="block w-full px-3 py-1.5 text-left text-sm text-sage-900 hover:bg-terracotta-50"
        >
          {it.name}
        </button>
      ))}
    </div>
  )
}
