// Row shapes for the Vault module's six tables, as returned from supabase
// (snake_case). Kept inside components/vault to stay within the module's scope.

export type DocumentRow = {
  id: string
  household_id: string
  name: string
  kind: string
  drive_file_id: string | null
  expiry_date: string | null
  notes: string | null
  uploaded_by_user_id: string | null
  tags: string[]
}

export type EmergencyContactRow = {
  id: string
  household_id: string
  name: string
  relationship: string | null
  phone: string | null
  email: string | null
  notes: string | null
  is_medical: boolean
}

export type VehicleRow = {
  id: string
  household_id: string
  label: string
  make: string | null
  model: string | null
  year: number | null
  plate: string | null
  vin: string | null
  insurance_expiry: string | null
  license_expiry: string | null
  service_due_date: string | null
  notes: string | null
}

export type VehicleDocRow = {
  id: string
  household_id: string
  vehicle_id: string
  kind: string
  drive_file_id: string | null
  expiry_date: string | null
}

export type WarrantyRow = {
  id: string
  household_id: string
  item: string
  purchase_date: string | null
  expiry_date: string | null
  retailer: string | null
  drive_file_id: string | null
  notes: string | null
}

export type GiftIdeaRow = {
  id: string
  household_id: string
  for_user_id: string | null
  for_contact_id: string | null
  idea: string
  url: string | null
  price_estimate: number | null
  occasion: string | null
  claimed_by_user_id: string | null
}

/** A normalised upcoming-expiry entry surfaced on the Vault landing page. */
export type ExpiringEntry = {
  label: string
  detail: string
  date: string
}
