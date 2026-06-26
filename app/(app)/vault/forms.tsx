'use client'

import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { UploadField } from '@/components/vault/upload-field'
import {
  createDocumentAction,
  createEmergencyContactAction,
  createVehicleAction,
  createVehicleDocAction,
  createWarrantyAction,
  createGiftIdeaAction,
  type ActionResult,
} from './actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

function Field({
  label,
  optional,
  children,
}: {
  label: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-sage-800">
        {label}
        {optional && <span className="text-sage-500"> (optional)</span>}
      </label>
      {children}
    </div>
  )
}

/**
 * Wraps a server action with pending/error state and resets the form on success.
 * Mirrors the mortgage SetupForm pattern, generalised so every Vault create form
 * shares the same UX.
 */
function CreateForm({
  action,
  submitLabel,
  children,
}: {
  action: (formData: FormData) => Promise<ActionResult>
  submitLabel: string
  children: ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [formKey, setFormKey] = useState(0)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await action(formData)
    if ('error' in result) {
      setError(result.error)
      setPending(false)
      return
    }
    // Success: clear inputs by remounting the form.
    setPending(false)
    setFormKey((k) => k + 1)
  }

  return (
    <form key={formKey} action={handleSubmit} className="space-y-4">
      <fieldset disabled={pending} className="space-y-4">
        {children}
      </fieldset>
      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : submitLabel}
      </Button>
    </form>
  )
}

// ── Documents ────────────────────────────────────────────────────────────────
export function DocumentForm() {
  return (
    <CreateForm action={createDocumentAction} submitLabel="Save document">
      <Field label="Name">
        <input name="name" type="text" required maxLength={120} className={inputClass} placeholder="e.g. Lease agreement" />
      </Field>
      <Field label="Kind">
        <select name="kind" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose a kind…</option>
          <option value="id">ID</option>
          <option value="passport">Passport</option>
          <option value="contract">Contract</option>
          <option value="certificate">Certificate</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Expiry date" optional>
        <input name="expiry_date" type="date" className={inputClass} />
      </Field>
      <Field label="Tags" optional>
        <input name="tags" type="text" className={inputClass} placeholder="comma, separated, tags" />
      </Field>
      <Field label="Notes" optional>
        <textarea name="notes" rows={2} className={inputClass} />
      </Field>
      <UploadField module="Documents" subcategory="Other" />
    </CreateForm>
  )
}

// ── Emergency contacts ─────────────────────────────────────────────────────────
export function EmergencyContactForm() {
  return (
    <CreateForm action={createEmergencyContactAction} submitLabel="Save contact">
      <Field label="Name">
        <input name="name" type="text" required maxLength={120} className={inputClass} placeholder="e.g. Dr. Naidoo" />
      </Field>
      <Field label="Relationship" optional>
        <input name="relationship" type="text" maxLength={80} className={inputClass} placeholder="e.g. GP, neighbour" />
      </Field>
      <Field label="Phone" optional>
        <input name="phone" type="tel" maxLength={40} className={inputClass} placeholder="e.g. 082 123 4567" />
      </Field>
      <Field label="Email" optional>
        <input name="email" type="email" maxLength={120} className={inputClass} />
      </Field>
      <Field label="Notes" optional>
        <textarea name="notes" rows={2} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm font-medium text-sage-800">
        <input name="is_medical" type="checkbox" className="size-4 accent-terracotta-500" />
        Medical contact
      </label>
    </CreateForm>
  )
}

// ── Vehicles ────────────────────────────────────────────────────────────────
export function VehicleForm() {
  return (
    <CreateForm action={createVehicleAction} submitLabel="Save vehicle">
      <Field label="Label">
        <input name="label" type="text" required maxLength={80} className={inputClass} placeholder="e.g. Hilux" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Make" optional>
          <input name="make" type="text" maxLength={60} className={inputClass} />
        </Field>
        <Field label="Model" optional>
          <input name="model" type="text" maxLength={60} className={inputClass} />
        </Field>
        <Field label="Year" optional>
          <input name="year" type="number" inputMode="numeric" step="1" min="1900" max="2100" className={inputClass} />
        </Field>
        <Field label="Plate" optional>
          <input name="plate" type="text" maxLength={20} className={inputClass} />
        </Field>
      </div>
      <Field label="VIN" optional>
        <input name="vin" type="text" maxLength={40} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Insurance expiry" optional>
          <input name="insurance_expiry" type="date" className={inputClass} />
        </Field>
        <Field label="Licence expiry" optional>
          <input name="license_expiry" type="date" className={inputClass} />
        </Field>
        <Field label="Service due" optional>
          <input name="service_due_date" type="date" className={inputClass} />
        </Field>
      </div>
      <Field label="Notes" optional>
        <textarea name="notes" rows={2} className={inputClass} />
      </Field>
    </CreateForm>
  )
}

// ── Vehicle docs ──────────────────────────────────────────────────────────────
export function VehicleDocForm({
  vehicles,
}: {
  vehicles: { id: string; label: string }[]
}) {
  if (vehicles.length === 0) {
    return (
      <p className="text-sm text-sage-600">
        Add a vehicle first, then you can file its documents here.
      </p>
    )
  }
  return (
    <CreateForm action={createVehicleDocAction} submitLabel="Save car document">
      <Field label="Vehicle">
        <select name="vehicle_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose a vehicle…</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Kind">
        <select name="kind" required defaultValue="" className={inputClass}>
          <option value="" disabled>Choose a kind…</option>
          <option value="insurance">Insurance</option>
          <option value="license">Licence</option>
          <option value="service">Service record</option>
          <option value="registration">Registration</option>
          <option value="other">Other</option>
        </select>
      </Field>
      <Field label="Expiry date" optional>
        <input name="expiry_date" type="date" className={inputClass} />
      </Field>
      <UploadField module="Documents" subcategory="Car" />
    </CreateForm>
  )
}

// ── Warranties ────────────────────────────────────────────────────────────────
export function WarrantyForm() {
  return (
    <CreateForm action={createWarrantyAction} submitLabel="Save warranty">
      <Field label="Item">
        <input name="item" type="text" required maxLength={120} className={inputClass} placeholder="e.g. Bosch dishwasher" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Purchase date" optional>
          <input name="purchase_date" type="date" className={inputClass} />
        </Field>
        <Field label="Expiry date" optional>
          <input name="expiry_date" type="date" className={inputClass} />
        </Field>
      </div>
      <Field label="Retailer" optional>
        <input name="retailer" type="text" maxLength={80} className={inputClass} placeholder="e.g. Makro" />
      </Field>
      <Field label="Notes" optional>
        <textarea name="notes" rows={2} className={inputClass} />
      </Field>
      <UploadField module="Documents" subcategory="Warranties" />
    </CreateForm>
  )
}

// ── Gift ideas ────────────────────────────────────────────────────────────────
export function GiftIdeaForm({
  members,
}: {
  members: { id: string; label: string }[]
}) {
  return (
    <CreateForm action={createGiftIdeaAction} submitLabel="Save gift idea">
      <Field label="Idea">
        <input name="idea" type="text" required maxLength={160} className={inputClass} placeholder="e.g. Running shoes" />
      </Field>
      <Field label="For" optional>
        <select name="for_user_id" defaultValue="" className={inputClass}>
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </Field>
      <Field label="Occasion" optional>
        <input name="occasion" type="text" maxLength={80} className={inputClass} placeholder="e.g. Birthday" />
      </Field>
      <Field label="Estimated price (R)" optional>
        <input name="price_estimate" type="number" inputMode="decimal" step="0.01" min="0" className={inputClass} />
      </Field>
      <Field label="Link" optional>
        <input name="url" type="url" maxLength={500} className={inputClass} placeholder="https://…" />
      </Field>
      <p className="text-xs text-sage-600">
        The person a gift is for won&apos;t be able to see it — only you and anyone
        else in your household will.
      </p>
    </CreateForm>
  )
}
