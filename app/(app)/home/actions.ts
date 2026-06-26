'use server'

import { revalidatePath } from 'next/cache'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { isValidRrule } from '@/lib/rrule'
import { computeTickOff, type SharedListItem } from '@/components/home/map'

type ActionResult = { error: string } | { success: true }

export type TickOffResult =
  | { error: string }
  | { success: true; nextDue: string | null }

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function optStr(formData: FormData, key: string): string | null {
  const v = str(formData, key)
  return v === '' ? null : v
}

function optNum(formData: FormData, key: string): number | null {
  const raw = str(formData, key)
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

/** Normalise an optional RRULE from the recurrence builder; '' / invalid → null. */
function optRrule(formData: FormData, key: string): string | null {
  const v = str(formData, key)
  if (v === '' || !isValidRrule(v)) return null
  return v
}

// ── Chores ───────────────────────────────────────────────────────────────────

export async function addChoreAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = str(formData, 'name')
  if (!name) return { error: 'Please give the chore a name.' }

  const { error } = await supabase.from('chores').insert({
    household_id: householdId,
    name,
    assignee_user_id: optStr(formData, 'assignee_user_id'),
    recurrence_rrule: optRrule(formData, 'recurrence_rrule'),
    next_due: optStr(formData, 'next_due'),
  })
  if (error) return { error: error.message }
  revalidatePath('/home')
  return { success: true }
}

export async function completeChoreAction(id: string): Promise<TickOffResult> {
  return tickOff('chores', '/home', id)
}

// ── Cleaning tasks ─────────────────────────────────────────────────────────────

export async function addCleaningTaskAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = str(formData, 'name')
  if (!name) return { error: 'Please give the task a name.' }

  const { error } = await supabase.from('cleaning_tasks').insert({
    household_id: householdId,
    name,
    assignee_user_id: optStr(formData, 'assignee_user_id'),
    recurrence_rrule: optRrule(formData, 'recurrence_rrule'),
    next_due: optStr(formData, 'next_due'),
  })
  if (error) return { error: error.message }
  revalidatePath('/home/cleaning')
  return { success: true }
}

export async function completeCleaningTaskAction(id: string): Promise<TickOffResult> {
  return tickOff('cleaning_tasks', '/home/cleaning', id)
}

// ── Maintenance reminders ──────────────────────────────────────────────────────

export async function addMaintenanceReminderAction(
  formData: FormData,
): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const item = str(formData, 'item')
  if (!item) return { error: 'Please name the maintenance item.' }

  const { error } = await supabase.from('maintenance_reminders').insert({
    household_id: householdId,
    item,
    recurrence_rrule: optRrule(formData, 'recurrence_rrule'),
    next_due: optStr(formData, 'next_due'),
    notes: optStr(formData, 'notes'),
  })
  if (error) return { error: error.message }
  revalidatePath('/home/maintenance')
  return { success: true }
}

export async function completeMaintenanceReminderAction(
  id: string,
): Promise<TickOffResult> {
  return tickOff('maintenance_reminders', '/home/maintenance', id)
}

/**
 * Shared tick-off for the three recurring entities. Loads the row's RRULE,
 * computes the patch via the pure helper, and persists it. RLS already scopes
 * the row to the caller's household; we also filter by household_id for safety.
 */
async function tickOff(
  table: 'chores' | 'cleaning_tasks' | 'maintenance_reminders',
  revalidate: string,
  id: string,
): Promise<TickOffResult> {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: row, error: loadError } = await supabase
    .from(table)
    .select('id, recurrence_rrule')
    .eq('id', id)
    .eq('household_id', householdId)
    .maybeSingle<{ id: string; recurrence_rrule: string | null }>()

  if (loadError) return { error: loadError.message }
  if (!row) return { error: 'That item no longer exists.' }

  const patch = computeTickOff(row.recurrence_rrule, user.id)

  const { error } = await supabase
    .from(table)
    .update(patch)
    .eq('id', id)
    .eq('household_id', householdId)

  if (error) return { error: error.message }
  revalidatePath(revalidate)
  return { success: true, nextDue: patch.next_due }
}

// ── Home projects ──────────────────────────────────────────────────────────────

export async function addHomeProjectAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = str(formData, 'name')
  if (!name) return { error: 'Please give the project a name.' }

  const status = str(formData, 'status') || 'idea'

  const { error } = await supabase.from('home_projects').insert({
    household_id: householdId,
    name,
    status,
    budget: optNum(formData, 'budget'),
    notes_md: optStr(formData, 'notes_md'),
    // photo_drive_file_ids defaults to '{}' — uploads via /api/drive/upload land
    // later; Drive-not-connected is handled gracefully by leaving this empty.
  })
  if (error) return { error: error.message }
  revalidatePath('/home/projects')
  return { success: true }
}

// ── Shared lists ───────────────────────────────────────────────────────────────

export async function addSharedListAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const name = str(formData, 'name')
  if (!name) return { error: 'Please give the list a name.' }

  // Seed items from a newline-separated textarea; each line becomes an unchecked item.
  const itemsRaw = str(formData, 'items')
  const items: SharedListItem[] = itemsRaw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((text) => ({ text, checked: false }))

  const { error } = await supabase.from('shared_lists').insert({
    household_id: householdId,
    name,
    items,
  })
  if (error) return { error: error.message }
  revalidatePath('/home/lists')
  return { success: true }
}

/** Toggle a single item's checked state within a shared list's jsonb array. */
export async function toggleSharedListItemAction(
  listId: string,
  index: number,
): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: list, error: loadError } = await supabase
    .from('shared_lists')
    .select('items')
    .eq('id', listId)
    .eq('household_id', householdId)
    .maybeSingle<{ items: SharedListItem[] }>()

  if (loadError) return { error: loadError.message }
  if (!list) return { error: 'That list no longer exists.' }

  const items = [...(list.items ?? [])]
  const target = items[index]
  if (!target) return { error: 'That item no longer exists.' }
  items[index] = { ...target, checked: !target.checked }

  const { error } = await supabase
    .from('shared_lists')
    .update({ items })
    .eq('id', listId)
    .eq('household_id', householdId)

  if (error) return { error: error.message }
  revalidatePath('/home/lists')
  return { success: true }
}

// ── Shopping links ─────────────────────────────────────────────────────────────

export async function addShoppingLinkAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const label = str(formData, 'label')
  const url = str(formData, 'url')
  if (!label) return { error: 'Please give the link a label.' }
  if (!url) return { error: 'Please paste a URL.' }

  const { error } = await supabase.from('shopping_links').insert({
    household_id: householdId,
    label,
    url,
    category: optStr(formData, 'category'),
    notes: optStr(formData, 'notes'),
  })
  if (error) return { error: error.message }
  revalidatePath('/home/shopping')
  return { success: true }
}
