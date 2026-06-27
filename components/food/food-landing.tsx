'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatWeekday, formatDayMonth } from '@/components/food/format'
import { type MealSlot } from '@/components/food/types'
import { assignMealAction } from '@/app/(app)/food/actions'
import {
  MealPlanGrid,
  type CatalogueOption,
  type PlanMap,
  type RecipeOption,
} from '@/app/(app)/food/meal-plan-grid'

const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

export type SlotMeal = { slot: MealSlot; label: string | null }

export type DayPlan = {
  date: string
  dinner: string | null
  lunch: string | null
  breakfast: string | null
}

type EditTarget = { date: string; slot: MealSlot } | null

const selectClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-2 py-1.5 text-sm text-sage-900 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

/**
 * Food landing — Focus Timeline redesign.
 *
 * Keeps every piece of the original meal-plan functionality intact:
 *  - each "Today's meals" row opens the same assign flow (recipe <select> +
 *    free-text input backed by the catalogue <datalist>) and calls
 *    assignMealAction;
 *  - the full week MealPlanGrid (with its catalogue datalist + "build list")
 *    stays reachable below "Rest of the week";
 *  - links to all Food sub-routes (recipes / grocery / pantry / leftovers /
 *    budget / catalogue) are preserved.
 */
export function FoodLanding({
  today,
  weekStart,
  dates,
  todayMeals,
  restOfWeek,
  groceryCount,
  recipes,
  catalogue,
  plan,
}: {
  today: string
  weekStart: string
  dates: string[]
  todayMeals: SlotMeal[]
  restOfWeek: DayPlan[]
  groceryCount: number
  recipes: RecipeOption[]
  catalogue: CatalogueOption[]
  plan: PlanMap
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<EditTarget>(null)
  const [showGrid, setShowGrid] = useState(false)

  function isEditing(date: string, slot: MealSlot) {
    return editing?.date === date && editing.slot === slot
  }

  return (
    <div className="space-y-6">
      {/* ── TODAY'S MEALS ─────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Today&apos;s meals</SectionLabel>
        <div className="space-y-3">
          {todayMeals.map((meal) => {
            const isDinner = meal.slot === 'dinner'
            const current = plan[`${today}|${meal.slot}`]
            return (
              <div key={meal.slot}>
                <button
                  type="button"
                  onClick={() =>
                    setEditing(isEditing(today, meal.slot) ? null : { date: today, slot: meal.slot })
                  }
                  className="block w-full text-left"
                  aria-expanded={isEditing(today, meal.slot)}
                  style={{
                    background: isDinner ? '#FBF2EE' : '#FFFDF9',
                    border: `1px solid ${isDinner ? '#F4DDD2' : '#E8DFCE'}`,
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <div className="flex items-center gap-3.5">
                    <Thumb solid={isDinner} />
                    <div className="min-w-0">
                      <div
                        style={{
                          fontWeight: 500,
                          fontSize: 11,
                          letterSpacing: '0.07em',
                          textTransform: 'uppercase',
                          color: isDinner ? '#B36548' : '#7A9B7A',
                        }}
                      >
                        {isDinner ? 'Dinner · Tonight' : SLOT_LABEL[meal.slot]}
                      </div>
                      <div
                        className="mt-0.5 break-words"
                        style={{
                          fontWeight: 600,
                          fontSize: 15,
                          color: meal.label ? '#3F2118' : '#8a7163',
                        }}
                      >
                        {meal.label ?? 'Tap to plan'}
                      </div>
                    </div>
                  </div>
                </button>
                {isEditing(today, meal.slot) && (
                  <MealEditor
                    date={today}
                    slot={meal.slot}
                    current={current}
                    recipes={recipes}
                    catalogue={catalogue}
                    onDone={() => {
                      setEditing(null)
                      router.refresh()
                    }}
                    onCancel={() => setEditing(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── GROCERY BANNER ────────────────────────────────────────────── */}
      <Link href="/food/grocery" className="block">
        <div
          className="flex items-center justify-between gap-3"
          style={{ background: '#3B523C', borderRadius: 18, padding: '16px 18px' }}
        >
          <div className="min-w-0">
            <div
              style={{
                fontWeight: 600,
                fontSize: 11,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color: '#B9CFB9',
              }}
            >
              Grocery list
            </div>
            <div className="mt-0.5" style={{ fontWeight: 600, fontSize: 15, color: '#F1F5F1' }}>
              {groceryCount} {groceryCount === 1 ? 'item' : 'items'} ·{' '}
              <span style={{ fontWeight: 500 }}>from this week&apos;s meals</span>
            </div>
          </div>
          <span
            className="shrink-0"
            style={{
              background: '#7A9B7A',
              color: '#FFFDF9',
              borderRadius: 20,
              padding: '7px 16px',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            View
          </span>
        </div>
      </Link>

      {/* ── REST OF THE WEEK ──────────────────────────────────────────── */}
      <section>
        <SectionLabel>Rest of the week</SectionLabel>
        {restOfWeek.length === 0 ? (
          <p style={{ fontSize: 13, color: '#8a7163' }}>
            That&apos;s the week wrapped — nothing left to plan.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {restOfWeek.map((day) => {
              const headline = day.dinner ?? day.lunch ?? day.breakfast
              return headline ? (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setEditing({ date: day.date, slot: 'dinner' })}
                  className="block w-full text-left"
                  style={{
                    background: '#FFFDF9',
                    border: '1px solid #E8DFCE',
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <DayHeading date={day.date} />
                  <div
                    className="mt-1.5 break-words"
                    style={{ fontWeight: 600, fontSize: 14, color: '#3F2118' }}
                  >
                    {headline}
                  </div>
                </button>
              ) : (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => setEditing({ date: day.date, slot: 'dinner' })}
                  className="flex flex-col text-left"
                  style={{
                    background: 'transparent',
                    border: '1px dashed #DBCFB7',
                    borderRadius: 16,
                    padding: 14,
                  }}
                >
                  <DayHeading date={day.date} />
                  <div className="mt-1.5" style={{ fontWeight: 600, fontSize: 14, color: '#8a7163' }}>
                    + plan
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Inline editor for a tapped day-card (dinner slot by default). */}
        {editing && editing.date !== today && (
          <div
            className="mt-3"
            style={{
              background: '#FFFDF9',
              border: '1px solid #E8DFCE',
              borderRadius: 16,
              padding: 14,
            }}
          >
            <div className="mb-2 flex items-center justify-between">
              <span style={{ fontWeight: 600, fontSize: 13, color: '#3F2118' }}>
                {formatWeekday(editing.date)} {formatDayMonth(editing.date)} · {SLOT_LABEL[editing.slot]}
              </span>
              <SlotSwitch
                value={editing.slot}
                onChange={(slot) => setEditing({ date: editing.date, slot })}
              />
            </div>
            <MealEditor
              date={editing.date}
              slot={editing.slot}
              current={plan[`${editing.date}|${editing.slot}`]}
              recipes={recipes}
              catalogue={catalogue}
              onDone={() => {
                setEditing(null)
                router.refresh()
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
      </section>

      {/* ── FULL WEEK GRID (preserved meal-plan functionality) ────────── */}
      <section>
        <button
          type="button"
          onClick={() => setShowGrid((v) => !v)}
          className="flex w-full items-center justify-between"
          aria-expanded={showGrid}
          style={{
            background: '#FFFDF9',
            border: '1px solid #E8DFCE',
            borderRadius: 14,
            padding: '12px 16px',
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 14, color: '#3F2118' }}>
            Full week meal plan
          </span>
          <Chevron open={showGrid} />
        </button>
        {showGrid && (
          <div
            className="mt-3"
            style={{
              background: '#FFFDF9',
              border: '1px solid #E8DFCE',
              borderRadius: 14,
              padding: 14,
            }}
          >
            <MealPlanGrid
              weekStart={weekStart}
              dates={dates}
              recipes={recipes}
              catalogue={catalogue}
              plan={plan}
            />
          </div>
        )}
      </section>

      {/* ── SUB-ROUTE LINKS ───────────────────────────────────────────── */}
      <section>
        <SectionLabel>More food</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <RouteTile href="/food/recipes" label="Recipes" />
          <RouteTile href="/food/catalogue" label="Catalogue" />
          <RouteTile href="/food/pantry" label="Pantry" />
          <RouteTile href="/food/leftovers" label="Leftovers" />
          <RouteTile href="/food/budget" label="Budget meals" />
          <RouteTile href="/food/grocery" label="Grocery list" />
        </div>
      </section>
    </div>
  )
}

/** The recipe <select> + free-text/datalist editor — same flow as the grid. */
function MealEditor({
  date,
  slot,
  current,
  recipes,
  catalogue,
  onDone,
  onCancel,
}: {
  date: string
  slot: MealSlot
  current: PlanMap[string]
  recipes: RecipeOption[]
  catalogue: CatalogueOption[]
  onDone: () => void
  onCancel: () => void
}) {
  const listId = `catalogue-${date}-${slot}`
  const meals = catalogue.filter((c) => c.kind === 'food')
  const desserts = catalogue.filter((c) => c.kind === 'dessert')
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
    onDone()
  }

  return (
    <div className="mt-2 space-y-1.5">
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
        <>
          <input
            type="text"
            aria-label={`${SLOT_LABEL[slot]} free text`}
            placeholder={catalogue.length ? 'or type / pick a meal' : 'or type a meal'}
            className={selectClass}
            value={freeText}
            disabled={pending}
            maxLength={120}
            list={catalogue.length ? listId : undefined}
            onChange={(e) => setFreeText(e.target.value)}
          />
          {catalogue.length > 0 && (
            <datalist id={listId}>
              {meals.map((c) => (
                <option key={c.id} value={c.name} />
              ))}
              {desserts.map((c) => (
                <option key={c.id} value={c.name} label={`${c.name} (dessert)`} />
              ))}
            </datalist>
          )}
        </>
      )}
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="min-h-[44px]"
          style={{
            background: '#C77B5C',
            color: '#FFFDF9',
            borderRadius: 12,
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
            opacity: pending ? 0.5 : 1,
          }}
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="min-h-[44px]"
          style={{
            background: 'transparent',
            border: '1px solid #E8DFCE',
            color: '#8a7163',
            borderRadius: 12,
            padding: '7px 16px',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function SlotSwitch({
  value,
  onChange,
}: {
  value: MealSlot
  onChange: (slot: MealSlot) => void
}) {
  return (
    <div className="flex gap-1">
      {(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          style={{
            fontSize: 11,
            fontWeight: 600,
            borderRadius: 10,
            padding: '4px 8px',
            background: value === s ? '#F4DDD2' : '#F1F5F1',
            color: value === s ? '#793F2D' : '#5F8160',
          }}
        >
          {SLOT_LABEL[s].charAt(0)}
        </button>
      ))}
    </div>
  )
}

function DayHeading({ date }: { date: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span style={{ fontWeight: 600, fontSize: 13, color: '#3F2118' }}>{formatWeekday(date)}</span>
      <span style={{ fontSize: 11, color: '#8a7163' }}>{formatDayMonth(date)}</span>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-2.5"
      style={{
        fontWeight: 600,
        fontSize: 11,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: '#7A9B7A',
      }}
    >
      {children}
    </div>
  )
}

/** 46px meal thumbnail placeholder: dinner solid terracotta, others striped. */
function Thumb({ solid }: { solid: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="shrink-0"
      style={{
        width: 46,
        height: 46,
        borderRadius: 12,
        background: solid
          ? '#C77B5C'
          : 'repeating-linear-gradient(45deg, #EADFCB, #EADFCB 6px, #EDE4D4 6px, #EDE4D4 12px)',
      }}
    />
  )
}

function RouteTile({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between"
      style={{
        background: '#FFFDF9',
        border: '1px solid #E8DFCE',
        borderRadius: 16,
        padding: '14px 16px',
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 14, color: '#3F2118' }}>{label}</span>
      <Chevron />
    </Link>
  )
}

function Chevron({ open = false }: { open?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#C8B79C"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  )
}
