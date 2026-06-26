'use server'

import { revalidatePath } from 'next/cache'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'

export type ActionResult = { error: string } | { success: true }

// ── small parse helpers ─────────────────────────────────────────────────────
function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}
function strOrNull(formData: FormData, key: string): string | null {
  const v = str(formData, key)
  return v === '' ? null : v
}
/** Parse an optional positive number; '' → null, invalid → null. */
function numOrNull(formData: FormData, key: string): number | null {
  const raw = str(formData, key)
  if (raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}
/** Parse an optional integer; '' → null. */
function intOrNull(formData: FormData, key: string): number | null {
  const n = numOrNull(formData, key)
  return n == null ? null : Math.round(n)
}
/** Split a comma/space separated tags string into a clean string[]. */
function tags(formData: FormData, key: string): string[] {
  return str(formData, key)
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

// ── documents ───────────────────────────────────────────────────────────────
export async function createDocumentAction(formData: FormData): Promise<ActionResult> {
  const { user, householdId } = await requireHousehold()
  const name = str(formData, 'name')
  const kind = str(formData, 'kind')
  if (!name) return { error: 'Please enter a document name.' }
  if (!kind) return { error: 'Please choose a document kind.' }

  const supabase = await createClient()
  const { error } = await supabase.from('documents').insert({
    household_id: householdId,
    name,
    kind,
    drive_file_id: strOrNull(formData, 'drive_file_id'),
    expiry_date: strOrNull(formData, 'expiry_date'),
    notes: strOrNull(formData, 'notes'),
    uploaded_by_user_id: user.id,
    tags: tags(formData, 'tags'),
  })
  if (error) return { error: error.message }
  revalidatePath('/vault')
  return { success: true }
}

// ── emergency contacts ────────────────────────────────────────────────────────
export async function createEmergencyContactAction(
  formData: FormData,
): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const name = str(formData, 'name')
  if (!name) return { error: 'Please enter a contact name.' }

  const supabase = await createClient()
  const { error } = await supabase.from('emergency_contacts').insert({
    household_id: householdId,
    name,
    relationship: strOrNull(formData, 'relationship'),
    phone: strOrNull(formData, 'phone'),
    email: strOrNull(formData, 'email'),
    notes: strOrNull(formData, 'notes'),
    is_medical: formData.get('is_medical') === 'on',
  })
  if (error) return { error: error.message }
  revalidatePath('/vault')
  return { success: true }
}

// ── vehicles ──────────────────────────────────────────────────────────────────
export async function createVehicleAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const label = str(formData, 'label')
  if (!label) return { error: 'Please enter a label for the vehicle.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vehicles').insert({
    household_id: householdId,
    label,
    make: strOrNull(formData, 'make'),
    model: strOrNull(formData, 'model'),
    year: intOrNull(formData, 'year'),
    plate: strOrNull(formData, 'plate'),
    vin: strOrNull(formData, 'vin'),
    insurance_expiry: strOrNull(formData, 'insurance_expiry'),
    license_expiry: strOrNull(formData, 'license_expiry'),
    service_due_date: strOrNull(formData, 'service_due_date'),
    notes: strOrNull(formData, 'notes'),
  })
  if (error) return { error: error.message }
  revalidatePath('/vault')
  return { success: true }
}

// ── vehicle docs ──────────────────────────────────────────────────────────────
export async function createVehicleDocAction(
  formData: FormData,
): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const vehicleId = str(formData, 'vehicle_id')
  const kind = str(formData, 'kind')
  if (!vehicleId) return { error: 'Please choose a vehicle.' }
  if (!kind) return { error: 'Please choose a document kind.' }

  const supabase = await createClient()
  const { error } = await supabase.from('vehicle_docs').insert({
    household_id: householdId,
    vehicle_id: vehicleId,
    kind,
    drive_file_id: strOrNull(formData, 'drive_file_id'),
    expiry_date: strOrNull(formData, 'expiry_date'),
  })
  if (error) return { error: error.message }
  revalidatePath('/vault')
  return { success: true }
}

// ── warranties ────────────────────────────────────────────────────────────────
export async function createWarrantyAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const item = str(formData, 'item')
  if (!item) return { error: 'Please enter the item.' }

  const supabase = await createClient()
  const { error } = await supabase.from('warranties').insert({
    household_id: householdId,
    item,
    purchase_date: strOrNull(formData, 'purchase_date'),
    expiry_date: strOrNull(formData, 'expiry_date'),
    retailer: strOrNull(formData, 'retailer'),
    drive_file_id: strOrNull(formData, 'drive_file_id'),
    notes: strOrNull(formData, 'notes'),
  })
  if (error) return { error: error.message }
  revalidatePath('/vault')
  return { success: true }
}

// ── gift ideas ────────────────────────────────────────────────────────────────
export async function createGiftIdeaAction(formData: FormData): Promise<ActionResult> {
  const { householdId } = await requireHousehold()
  const idea = str(formData, 'idea')
  if (!idea) return { error: 'Please enter a gift idea.' }

  const supabase = await createClient()
  const { error } = await supabase.from('gift_ideas').insert({
    household_id: householdId,
    for_user_id: strOrNull(formData, 'for_user_id'),
    idea,
    url: strOrNull(formData, 'url'),
    price_estimate: numOrNull(formData, 'price_estimate'),
    occasion: strOrNull(formData, 'occasion'),
  })
  if (error) return { error: error.message }
  revalidatePath('/vault')
  return { success: true }
}
