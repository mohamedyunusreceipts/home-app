'use client'

import { useState } from 'react'
import { AiSuggest } from '@/components/food/ai-suggest'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200'

export function BudgetMealsPanel({ pantryNames }: { pantryNames: string[] }) {
  const [budget, setBudget] = useState('')
  const [servings, setServings] = useState('')

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="budget" className="block text-sm font-medium text-sage-800">
            Weekly budget <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="budget"
            type="text"
            inputMode="numeric"
            placeholder="e.g. R800"
            className={inputClass}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="servings" className="block text-sm font-medium text-sage-800">
            Servings per meal <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="servings"
            type="number"
            min="1"
            placeholder="e.g. 2"
            className={inputClass}
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
        </div>
      </div>

      <AiSuggest
        kind="budget_meals"
        label="Suggest budget meals for the week"
        buildContext={() => ({
          budget: budget.trim() || undefined,
          servings: servings.trim() ? Number(servings) : undefined,
          pantry: pantryNames,
        })}
      />
    </div>
  )
}
