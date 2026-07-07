'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatWeekday, formatDayMonth } from '@/components/food/format'
import { MEAL_SLOTS, type MealSlot } from '@/components/food/types'
import { assignMealAction, buildListFromWeekAction } from './actions'
import { MealCombobox } from '@/components/food/meal-combobox'

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

export type Assignment = {
  recipeId: string | null
  freeText: string | null
}

export type RecipeOption = { id: string; name: string }

export type CatalogueOption = { id: string; kind: 'food' | 'dessert'; name: string }

/** Map of `${date}|${slot}` → assignment. */
export type PlanMap = Record<string, Assignment | undefined>

function SlotCell({
  date,
  slot,
  current,
  recipes,
  catalogue,
  onSaved,
}: {
  date: string
  slot: MealSlot
  current: Assignment | undefined
  recipes: RecipeOption[]
  catalogue: CatalogueOption[]
  onSaved: () => void
}) {
  const [pending, setPending] = useState(false)
  const [recipeId, setRecipeId] = useState(current?.recipeId ?? '')
  const [freeText, setFreeText] = useState(current?.freeText ?? '')

  async function save() {
    setPending(true)
    const fd = new FormData()
    fd.set('date', date)
    fd.set('slot', slot)
    fd.set('recipe_id', recipeId)
    fd.set('free_text', recipeId ? '' : freeText)
    await assignMealAction(fd)
    setPending(false)
    onSaved()
  }

  return (
    <div className="space-y-1.5">
      <MealCombobox
        recipes={recipes}
        catalogue={catalogue}
        value={{ recipeId, freeText }}
        onChange={(v) => {
          setRecipeId(v.recipeId)
          setFreeText(v.freeText)
        }}
        disabled={pending}
        placeholder="Search or type…"
      />
      <Button
        type="button"
        size="xs"
        variant="outline"
        className="w-full"
        disabled={pending}
        onClick={save}
      >
        {pending ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}

export function MealPlanGrid({
  weekStart,
  dates,
  recipes,
  catalogue,
  plan,
}: {
  weekStart: string
  dates: string[]
  recipes: RecipeOption[]
  catalogue: CatalogueOption[]
  plan: PlanMap
}) {
  const router = useRouter()
  const [building, setBuilding] = useState(false)
  const [buildMsg, setBuildMsg] = useState<string | null>(null)

  async function buildList() {
    setBuilding(true)
    setBuildMsg(null)
    const result = await buildListFromWeekAction(weekStart)
    setBuilding(false)
    if ('error' in result) {
      setBuildMsg(result.error)
      return
    }
    setBuildMsg(
      result.added === 0
        ? 'Your pantry already covers this week — nothing to add.'
        : `Added ${result.added} ${result.added === 1 ? 'item' : 'items'} to your grocery list.`,
    )
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={buildList} disabled={building}>
          {building ? 'Building…' : "Build list from this week's meals"}
        </Button>
        {buildMsg && (
          <p className="text-sm text-sage-700" role="status">
            {buildMsg}
          </p>
        )}
      </div>

      {catalogue.length === 0 && (
        <p className="text-sm text-sage-600">
          Tip: build your{' '}
          <Link href="/food/catalogue" className="text-terracotta-600 hover:underline">
            meals &amp; desserts catalogue
          </Link>{' '}
          to pick favourite dishes straight into any slot.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-sm font-medium text-sage-600"></th>
              {dates.map((d) => (
                <th key={d} className="p-2 text-left text-sm font-medium text-sage-800">
                  <div>{formatWeekday(d)}</div>
                  <div className="text-xs font-normal text-sage-500">{formatDayMonth(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEAL_SLOTS.map((slot) => (
              <tr key={slot} className="border-t border-sage-100">
                <th className="p-2 text-left align-top text-sm font-medium text-terracotta-700">
                  {SLOT_LABEL[slot]}
                </th>
                {dates.map((d) => (
                  <td key={`${d}-${slot}`} className="p-2 align-top">
                    <SlotCell
                      date={d}
                      slot={slot}
                      current={plan[`${d}|${slot}`]}
                      recipes={recipes}
                      catalogue={catalogue}
                      onSaved={() => router.refresh()}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
