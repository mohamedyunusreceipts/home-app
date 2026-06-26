import type { ReactNode } from 'react'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ScreenHeader } from '@/components/shell/screen-header'
import { ExpiryBadge } from '@/components/vault/expiry-badge'
import { SectionRowSummary, type VaultIcon } from '@/components/vault/section-row'
import { formatDate, formatZar, daysUntil } from '@/components/vault/format'
import type {
  DocumentRow,
  EmergencyContactRow,
  VehicleRow,
  VehicleDocRow,
  WarrantyRow,
  GiftIdeaRow,
  ExpiringEntry,
} from '@/components/vault/map'
import {
  DocumentForm,
  EmergencyContactForm,
  VehicleForm,
  VehicleDocForm,
  WarrantyForm,
  GiftIdeaForm,
} from './forms'

/** A collapsible Vault section: the row is the summary; the list + create form
 *  live inside, one tap away. */
function VaultSection({
  icon,
  label,
  count,
  children,
}: {
  icon: VaultIcon
  label: string
  count: number
  children: ReactNode
}) {
  return (
    <details className="vault-section group">
      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <SectionRowSummary icon={icon} label={label} count={count} />
      </summary>
      <div className="space-y-3 px-3 pb-2 pt-3 text-sage-800">{children}</div>
    </details>
  )
}

export default async function VaultPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  // Fetch every entity in parallel. RLS scopes all of these to the household,
  // and the gift_ideas policy additionally hides ideas targeted at the viewer.
  const [
    documentsRes,
    contactsRes,
    vehiclesRes,
    vehicleDocsRes,
    warrantiesRes,
    giftsRes,
    membersRes,
  ] = await Promise.all([
    supabase
      .from('documents')
      .select('id, household_id, name, kind, drive_file_id, expiry_date, notes, uploaded_by_user_id, tags')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .returns<DocumentRow[]>(),
    supabase
      .from('emergency_contacts')
      .select('id, household_id, name, relationship, phone, email, notes, is_medical')
      .is('deleted_at', null)
      .order('name', { ascending: true })
      .returns<EmergencyContactRow[]>(),
    supabase
      .from('vehicles')
      .select('id, household_id, label, make, model, year, plate, vin, insurance_expiry, license_expiry, service_due_date, notes')
      .is('deleted_at', null)
      .order('label', { ascending: true })
      .returns<VehicleRow[]>(),
    supabase
      .from('vehicle_docs')
      .select('id, household_id, vehicle_id, kind, drive_file_id, expiry_date')
      .is('deleted_at', null)
      .returns<VehicleDocRow[]>(),
    supabase
      .from('warranties')
      .select('id, household_id, item, purchase_date, expiry_date, retailer, drive_file_id, notes')
      .is('deleted_at', null)
      .order('expiry_date', { ascending: true })
      .returns<WarrantyRow[]>(),
    supabase
      .from('gift_ideas')
      .select('id, household_id, for_user_id, for_contact_id, idea, url, price_estimate, occasion, claimed_by_user_id')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .returns<GiftIdeaRow[]>(),
    supabase
      .from('household_members')
      .select('user_id, profiles(display_name, email)')
      .eq('household_id', householdId)
      .returns<{ user_id: string; profiles: { display_name: string | null; email: string } | null }[]>(),
  ])

  const documents = documentsRes.data ?? []
  const contacts = contactsRes.data ?? []
  const vehicles = vehiclesRes.data ?? []
  const vehicleDocs = vehicleDocsRes.data ?? []
  const warranties = warrantiesRes.data ?? []
  const gifts = giftsRes.data ?? []

  const members = (membersRes.data ?? []).map((m) => ({
    id: m.user_id,
    label: m.profiles?.display_name || m.profiles?.email || 'Household member',
  }))
  const memberLabel = (id: string | null) =>
    id ? members.find((m) => m.id === id)?.label ?? 'Someone' : null
  const vehicleLabel = (id: string) =>
    vehicles.find((v) => v.id === id)?.label ?? 'Vehicle'

  // ── Upcoming expiries (spec §9.7: reminders at 60/30/7 days) ──
  // Gather every expiry-bearing row, keep those within the next 60 days (or
  // already overdue), and sort soonest first.
  const expiring: ExpiringEntry[] = []
  for (const d of documents) {
    if (d.expiry_date) expiring.push({ label: d.name, detail: `Document · ${formatDate(d.expiry_date)}`, date: d.expiry_date })
  }
  for (const w of warranties) {
    if (w.expiry_date) expiring.push({ label: w.item, detail: `Warranty · ${formatDate(w.expiry_date)}`, date: w.expiry_date })
  }
  for (const v of vehicles) {
    if (v.insurance_expiry) expiring.push({ label: v.label, detail: `Vehicle insurance · ${formatDate(v.insurance_expiry)}`, date: v.insurance_expiry })
    if (v.license_expiry) expiring.push({ label: v.label, detail: `Vehicle licence · ${formatDate(v.license_expiry)}`, date: v.license_expiry })
    if (v.service_due_date) expiring.push({ label: v.label, detail: `Service due · ${formatDate(v.service_due_date)}`, date: v.service_due_date })
  }
  for (const vd of vehicleDocs) {
    if (vd.expiry_date) expiring.push({ label: vehicleLabel(vd.vehicle_id), detail: `Car document · ${formatDate(vd.expiry_date)}`, date: vd.expiry_date })
  }
  const upcoming = expiring
    .filter((e) => {
      const days = daysUntil(e.date)
      return days != null && days <= 60
    })
    .sort((a, b) => (daysUntil(a.date) ?? 0) - (daysUntil(b.date) ?? 0))

  return (
    <main style={{ padding: '8px 22px 120px' }}>
      <div className="mx-auto max-w-3xl">
        <ScreenHeader title="Vault" />

        <div className="space-y-4">
          {/* COMING UP — anything expiring within 60 days. */}
          {upcoming.length > 0 && (
            <section
              className="rounded-[20px] border border-cream-300 p-4"
              style={{ background: '#FBF7F0' }}
            >
              <h2 className="pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-sage-500">
                Coming up
              </h2>
              <ul>
                {upcoming.map((e, i) => (
                  <li
                    key={`${e.detail}-${e.label}-${i}`}
                    className="flex items-center justify-between gap-3 border-b border-cream-300/70 py-2.5 last:border-0 last:pb-0 first:pt-1"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-terracotta-900">{e.label}</p>
                      <p className="truncate text-xs text-sage-600">{e.detail}</p>
                    </div>
                    <ExpiryBadge date={e.date} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Section list — each row expands to its items + create form. */}
          <div className="space-y-3">
            {/* Documents (IDs, passports, contracts — same table). */}
            <VaultSection icon="documents" label="Documents" count={documents.length}>
              {documents.length === 0 ? (
                <p className="text-sm text-sage-600">No documents filed yet.</p>
              ) : (
                <ul className="space-y-2">
                  {documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 border-b border-cream-300/70 pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sage-900">{d.name}</p>
                        <p className="truncate text-xs text-sage-600">
                          {d.kind}
                          {d.drive_file_id ? ' · file attached' : ''}
                          {d.tags.length > 0 ? ` · ${d.tags.join(', ')}` : ''}
                        </p>
                      </div>
                      <ExpiryBadge date={d.expiry_date} />
                    </li>
                  ))}
                </ul>
              )}
              <details className="pt-1">
                <summary className="cursor-pointer text-sm font-medium text-terracotta-700">Add a document</summary>
                <div className="pt-3"><DocumentForm /></div>
              </details>
            </VaultSection>

            {/* Emergency contacts. */}
            <VaultSection icon="contacts" label="Emergency contacts" count={contacts.length}>
              {contacts.length === 0 ? (
                <p className="text-sm text-sage-600">No emergency contacts yet.</p>
              ) : (
                <ul className="space-y-2">
                  {contacts.map((c) => (
                    <li key={c.id} className="border-b border-cream-300/70 pb-2 last:border-0 last:pb-0">
                      <p className="font-medium text-sage-900">
                        {c.name}
                        {c.is_medical && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Medical</span>
                        )}
                      </p>
                      <p className="text-xs text-sage-600">
                        {[c.relationship, c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <details className="pt-1">
                <summary className="cursor-pointer text-sm font-medium text-terracotta-700">Add a contact</summary>
                <div className="pt-3"><EmergencyContactForm /></div>
              </details>
            </VaultSection>

            {/* Vehicles. */}
            <VaultSection icon="vehicles" label="Vehicles" count={vehicles.length}>
              {vehicles.length === 0 ? (
                <p className="text-sm text-sage-600">No vehicles yet.</p>
              ) : (
                <ul className="space-y-2">
                  {vehicles.map((v) => (
                    <li key={v.id} className="border-b border-cream-300/70 pb-2 last:border-0 last:pb-0">
                      <p className="font-medium text-sage-900">
                        {v.label}
                        {(v.make || v.model || v.year) && (
                          <span className="text-sage-600"> · {[v.make, v.model, v.year].filter(Boolean).join(' ')}</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1 text-xs text-sage-600">
                        {v.plate && <span>{v.plate}</span>}
                        {v.insurance_expiry && <span>Insurance: {formatDate(v.insurance_expiry)}</span>}
                        {v.license_expiry && <span>Licence: {formatDate(v.license_expiry)}</span>}
                        {v.service_due_date && <span>Service: {formatDate(v.service_due_date)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <details className="pt-1">
                <summary className="cursor-pointer text-sm font-medium text-terracotta-700">Add a vehicle</summary>
                <div className="pt-3"><VehicleForm /></div>
              </details>
            </VaultSection>

            {/* Car documents. */}
            <VaultSection icon="vehicleDocs" label="Car documents" count={vehicleDocs.length}>
              {vehicleDocs.length === 0 ? (
                <p className="text-sm text-sage-600">No car documents filed yet.</p>
              ) : (
                <ul className="space-y-2">
                  {vehicleDocs.map((vd) => (
                    <li key={vd.id} className="flex items-center justify-between gap-3 border-b border-cream-300/70 pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sage-900">{vehicleLabel(vd.vehicle_id)}</p>
                        <p className="truncate text-xs text-sage-600">
                          {vd.kind}
                          {vd.drive_file_id ? ' · file attached' : ''}
                        </p>
                      </div>
                      <ExpiryBadge date={vd.expiry_date} />
                    </li>
                  ))}
                </ul>
              )}
              <details className="pt-1">
                <summary className="cursor-pointer text-sm font-medium text-terracotta-700">Add a car document</summary>
                <div className="pt-3"><VehicleDocForm vehicles={vehicles.map((v) => ({ id: v.id, label: v.label }))} /></div>
              </details>
            </VaultSection>

            {/* Warranties. */}
            <VaultSection icon="warranties" label="Warranties" count={warranties.length}>
              {warranties.length === 0 ? (
                <p className="text-sm text-sage-600">No warranties tracked yet.</p>
              ) : (
                <ul className="space-y-2">
                  {warranties.map((w) => (
                    <li key={w.id} className="flex items-center justify-between gap-3 border-b border-cream-300/70 pb-2 last:border-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sage-900">{w.item}</p>
                        <p className="truncate text-xs text-sage-600">
                          {[w.retailer, w.purchase_date ? `bought ${formatDate(w.purchase_date)}` : null]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                          {w.drive_file_id ? ' · file attached' : ''}
                        </p>
                      </div>
                      <ExpiryBadge date={w.expiry_date} />
                    </li>
                  ))}
                </ul>
              )}
              <details className="pt-1">
                <summary className="cursor-pointer text-sm font-medium text-terracotta-700">Add a warranty</summary>
                <div className="pt-3"><WarrantyForm /></div>
              </details>
            </VaultSection>

            {/* Gift ideas — recipient never sees ideas for themselves (RLS). */}
            <VaultSection icon="gifts" label="Gift ideas" count={gifts.length}>
              {gifts.length === 0 ? (
                <p className="text-sm text-sage-600">No gift ideas yet.</p>
              ) : (
                <ul className="space-y-2">
                  {gifts.map((g) => (
                    <li key={g.id} className="border-b border-cream-300/70 pb-2 last:border-0 last:pb-0">
                      <p className="font-medium text-sage-900">
                        {g.url ? (
                          <a href={g.url} target="_blank" rel="noreferrer" className="underline decoration-sage-300 hover:decoration-terracotta-400">
                            {g.idea}
                          </a>
                        ) : (
                          g.idea
                        )}
                      </p>
                      <p className="text-xs text-sage-600">
                        {[
                          memberLabel(g.for_user_id) ? `for ${memberLabel(g.for_user_id)}` : null,
                          g.occasion,
                          g.price_estimate != null ? formatZar(g.price_estimate) : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <details className="pt-1">
                <summary className="cursor-pointer text-sm font-medium text-terracotta-700">Add a gift idea</summary>
                <div className="pt-3"><GiftIdeaForm members={members} /></div>
              </details>
            </VaultSection>
          </div>
        </div>
      </div>
    </main>
  )
}
