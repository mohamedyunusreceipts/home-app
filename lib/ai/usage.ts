import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Per-household soft monthly cap on AI suggestions (spec §8.1).
 * Configurable later; hard-coded default for v1.
 */
export const DEFAULT_MONTHLY_CAP = 100

/**
 * Current month key as 'YYYY-MM' in the Africa/Johannesburg timezone.
 *
 * SAST is UTC+2 with no DST, but we derive it via Intl rather than hard-coding
 * an offset so the boundary is correct regardless of the server's locale/TZ.
 */
export function currentMonth(now: Date = new Date()): string {
  // en-CA yields ISO-ish 'YYYY-MM-DD'; slice to 'YYYY-MM'.
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return ymd.slice(0, 7)
}

export interface UsageResult {
  allowed: boolean
  used: number
  cap: number
}

/**
 * Read the number of AI calls a household has made in `month` ('YYYY-MM').
 * Returns 0 if no row exists yet. RLS scopes this to the caller's household.
 */
export async function getUsage(
  supabase: SupabaseClient,
  householdId: string,
  month: string,
): Promise<number> {
  const { data, error } = await supabase
    .from('ai_usage')
    .select('calls')
    .eq('household_id', householdId)
    .eq('month', month)
    .maybeSingle<{ calls: number }>()

  if (error) throw error
  return data?.calls ?? 0
}

/**
 * Check the household's monthly cap and, if room remains, record one more call.
 *
 * - Computes the current month in Africa/Johannesburg.
 * - Reads current `calls`. If `>= cap`, returns `{ allowed: false }` WITHOUT
 *   incrementing.
 * - Otherwise upserts `calls = used + 1` and returns `{ allowed: true }`.
 *
 * v1 RACE TOLERANCE: this is a read-then-write, not a single atomic SQL
 * increment. The Supabase JS client cannot express
 * `set calls = ai_usage.calls + 1` in an upsert without a SQL function, and we
 * cannot add migrations here. Two concurrent requests from the same household
 * could therefore both read `used` and both write `used + 1`, under-counting by
 * one (or letting one extra call slip past the cap). For a soft per-household
 * cap on a two-person household this is acceptable; tighten later with a small
 * SQL `do update set calls = ai_usage.calls + 1` function when migrations open.
 */
export async function checkAndIncrement(
  supabase: SupabaseClient,
  householdId: string,
  cap: number = DEFAULT_MONTHLY_CAP,
): Promise<UsageResult> {
  const month = currentMonth()
  const used = await getUsage(supabase, householdId, month)

  if (used >= cap) {
    return { allowed: false, used, cap }
  }

  const next = used + 1
  const { error } = await supabase.from('ai_usage').upsert(
    {
      household_id: householdId,
      month,
      calls: next,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'household_id,month' },
  )
  if (error) throw error

  return { allowed: true, used: next, cap }
}
