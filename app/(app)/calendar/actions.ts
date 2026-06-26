'use server'

import { revalidatePath } from 'next/cache'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string } | { success: true }

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function optStr(formData: FormData, key: string): string | null {
  const v = str(formData, key)
  return v === '' ? null : v
}

/**
 * Build an ISO timestamp from a datetime-local / date input value. For all-day
 * events the input is a plain date (YYYY-MM-DD); we anchor it to midnight in the
 * app's timezone (Africa/Johannesburg, UTC+2) so it lands on the intended day.
 */
function toIso(value: string, allDay: boolean): string | null {
  if (!value) return null
  if (allDay) {
    // Date-only → midnight SAST (UTC+2) → 22:00 UTC the previous day. Encode the
    // SAST offset explicitly so the day is unambiguous.
    const d = new Date(`${value}T00:00:00+02:00`)
    return Number.isNaN(d.getTime()) ? null : d.toISOString()
  }
  // datetime-local has no zone; interpret as SAST.
  const d = new Date(`${value}:00+02:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Create or update a manual calendar event. An `id` field switches to update. */
export async function saveEventAction(formData: FormData): Promise<ActionResult> {
  const { householdId, user } = await requireHousehold()
  const supabase = await createClient()

  const id = optStr(formData, 'id')
  const title = str(formData, 'title')
  const allDay = str(formData, 'all_day') === 'on'
  const startRaw = str(formData, 'start')
  const endRaw = str(formData, 'end')
  const location = optStr(formData, 'location')
  const notes = optStr(formData, 'notes')
  const color = optStr(formData, 'color')

  if (!title) return { error: 'Please give the event a title.' }

  const start = toIso(startRaw, allDay)
  if (!start) return { error: 'Please choose a valid start date and time.' }

  let end: string | null = null
  if (endRaw) {
    end = toIso(endRaw, allDay)
    if (!end) return { error: 'The end date/time is not valid.' }
    if (end < start) return { error: 'The end must be after the start.' }
  }

  const payload = {
    household_id: householdId,
    title,
    start,
    end,
    all_day: allDay,
    location,
    notes,
    color,
  }

  if (id) {
    const { error } = await supabase
      .from('calendar_events')
      .update(payload)
      .eq('id', id)
      .eq('household_id', householdId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase
      .from('calendar_events')
      .insert({ ...payload, created_by: user.id })
    if (error) return { error: error.message }
  }

  revalidatePath('/calendar')
  return { success: true }
}

/** Soft-delete a manual calendar event. */
export async function deleteEventAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const id = str(formData, 'id')
  if (!id) return { error: 'Missing event id.' }

  const { error } = await supabase
    .from('calendar_events')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  if (error) return { error: error.message }

  revalidatePath('/calendar')
  return { success: true }
}

export type RotateTokenResult = { error: string } | { success: true; token: string }

/** Rotate (mint) the household's iCal feed token via the rotate_ical_token RPC. */
export async function rotateIcalTokenAction(): Promise<RotateTokenResult> {
  await requireHousehold()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('rotate_ical_token')
  if (error) return { error: error.message }
  if (typeof data !== 'string') return { error: 'Could not rotate the feed token.' }

  revalidatePath('/calendar/settings')
  return { success: true, token: data }
}

// ── Contacts (birthdays sub-page) ──────────────────────────────────────────

export async function saveContactAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const id = optStr(formData, 'id')
  const name = str(formData, 'name')
  const dob = optStr(formData, 'dob')
  const relationship = optStr(formData, 'relationship')
  const giftIdeas = optStr(formData, 'gift_ideas_text')

  if (!name) return { error: 'Please enter a name.' }
  if (dob && Number.isNaN(new Date(dob).getTime())) {
    return { error: 'The date of birth is not valid.' }
  }

  const payload = {
    household_id: householdId,
    name,
    dob,
    relationship,
    gift_ideas_text: giftIdeas,
  }

  if (id) {
    const { error } = await supabase
      .from('contacts')
      .update(payload)
      .eq('id', id)
      .eq('household_id', householdId)
    if (error) return { error: error.message }
  } else {
    const { error } = await supabase.from('contacts').insert(payload)
    if (error) return { error: error.message }
  }

  revalidatePath('/calendar/birthdays')
  return { success: true }
}

export async function deleteContactAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const id = str(formData, 'id')
  if (!id) return { error: 'Missing contact id.' }

  const { error } = await supabase
    .from('contacts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('household_id', householdId)
  if (error) return { error: error.message }

  revalidatePath('/calendar/birthdays')
  return { success: true }
}
