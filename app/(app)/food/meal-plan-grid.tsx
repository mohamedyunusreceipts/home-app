'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { formatWeekday, formatDayMonth } from '@/components/food/format'
import { MEAL_SLOTS, type MealSlot } from '@/components/food/types'
import { assignMealAction, buildListFromWeekAction } from './actions'

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

/** Map of `${date}|${slot}` → assignment. */
export type PlanMap = Record<string, Assignment | undefined>

const selectClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-2 py-1.5 text-sm text-sage-900 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

function SlotCell({
  date,
  slot,
  current,
  recipes,
  onSaved,
}: {
  date: string
  slot: MealSlot
  current: Assignment | undefined
  recipes: RecipeOption[]
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
      <select
        aria-label={`${SLOT_LABEL[slot]} recipe`}
        className={selectClass}
        value={recipeId}
        disabled={pending}
        onChange={(e) => {
          setRecipeId(e.target.value)
          if (e.target.value) setFreeText('')
        }}
      >
        <option value="">— recipe —</option>
        {recipes.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      {!recipeId && (
        <input
          type="text"
          aria-label={`${SLOT_LABEL[slot]} free text`}
          placeholder="or type a meal"
          className={selectClass}
          value={freeText}
          disabled={pending}
          maxLength={120}
          onChange={(e) => setFreeText(e.target.value)}
        />
      )}
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
  plan,
}: {
  weekStart: string
  dates: string[]
  recipes: RecipeOption[]
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
