'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatZar, formatDate, formatDayLabel } from '@/components/travel/format'
import { TRIP_DOC_KINDS } from '@/components/travel/map'
import type {
  ItineraryItemRow,
  PackingItemRow,
  PackingListRow,
  TripDocRow,
  TripExpenseRow,
  TripNoteRow,
  TripOutfitRow,
} from '@/components/travel/map'
import {
  addItineraryItemAction,
  deleteItineraryItemAction,
  addExpenseAction,
  deleteExpenseAction,
  addPackingListAction,
  addPackingItemAction,
  togglePackedAction,
  deletePackingItemAction,
  addTripDocAction,
  deleteTripDocAction,
  saveTripNotesAction,
  saveOutfitAction,
  deleteOutfitAction,
  type ActionResult,
} from '@/app/(app)/travel/[tripId]/actions'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

const TABS = [
  'Itinerary',
  'Budget',
  'Packing',
  'Documents',
  'Outfits',
  'Notes',
] as const
type Tab = (typeof TABS)[number]

export type TripDetailData = {
  tripId: string
  members: { id: string; label: string }[]
  itinerary: ItineraryItemRow[]
  expenses: TripExpenseRow[]
  budgetTotal: number | null
  packingLists: PackingListRow[]
  packingItems: PackingItemRow[]
  docs: TripDocRow[]
  outfits: TripOutfitRow[]
  note: TripNoteRow | null
}

/** A small inline create form that calls a server action and refreshes on success. */
function useSubmit() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function run(
    action: (fd: FormData) => Promise<ActionResult>,
    formData: FormData,
    form?: HTMLFormElement,
  ) {
    setPending(true)
    setError(null)
    const result = await action(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    form?.reset()
    router.refresh()
  }
  return { error, pending, run }
}

export function TripDetail(props: TripDetailData) {
  const [tab, setTab] = useState<Tab>('Itinerary')

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={
              tab === t
                ? 'rounded-md bg-terracotta-600 px-3 py-1.5 text-sm font-medium text-cream-50'
                : 'rounded-md bg-sage-100 px-3 py-1.5 text-sm font-medium text-sage-800 hover:bg-sage-200'
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Itinerary' && <ItineraryTab {...props} />}
      {tab === 'Budget' && <BudgetTab {...props} />}
      {tab === 'Packing' && <PackingTab {...props} />}
      {tab === 'Documents' && <DocumentsTab {...props} />}
      {tab === 'Outfits' && <OutfitsTab {...props} />}
      {tab === 'Notes' && <NotesTab {...props} />}
    </div>
  )
}

function memberLabel(members: TripDetailData['members'], id: string | null): string {
  if (!id) return ''
  return members.find((m) => m.id === id)?.label ?? 'a member'
}

// ── Itinerary ───────────────────────────────────────────────────────────────

function ItineraryTab({ tripId, itinerary }: TripDetailData) {
  const { error, pending, run } = useSubmit()
  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {itinerary.length === 0 && (
          <li className="text-sm text-sage-600">No itinerary items yet.</li>
        )}
        {itinerary.map((item) => (
          <li key={item.id}>
            <Card>
              <CardContent className="flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium text-sage-900">
                    {formatDayLabel(item.day)}
                    {item.time ? ` · ${item.time.slice(0, 5)}` : ''} — {item.title}
                  </p>
                  {item.location && (
                    <p className="text-sm text-sage-600">{item.location}</p>
                  )}
                  {item.notes && <p className="text-sm text-sage-600">{item.notes}</p>}
                </div>
                <form action={deleteItineraryItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="trip_id" value={tripId} />
                  <button type="submit" className="text-sm text-terracotta-700">
                    Remove
                  </button>
                </form>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          run(addItineraryItemAction, new FormData(e.currentTarget), e.currentTarget)
        }}
        className="space-y-3 rounded-md border border-sage-200 p-4"
      >
        <input type="hidden" name="trip_id" value={tripId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="day" type="date" required className={inputClass} disabled={pending} />
          <input name="time" type="time" className={inputClass} disabled={pending} />
        </div>
        <input
          name="title"
          type="text"
          required
          placeholder="Activity"
          className={inputClass}
          disabled={pending}
        />
        <input
          name="location"
          type="text"
          placeholder="Location (optional)"
          className={inputClass}
          disabled={pending}
        />
        <input
          name="notes"
          type="text"
          placeholder="Notes (optional)"
          className={inputClass}
          disabled={pending}
        />
        {error && <p className="text-sm text-terracotta-700">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add itinerary item'}
        </Button>
      </form>
    </div>
  )
}

// ── Budget / expenses ────────────────────────────────────────────────────────

function BudgetTab({ tripId, expenses, budgetTotal }: TripDetailData) {
  const { error, pending, run } = useSubmit()
  const spent = expenses.reduce((sum, e) => sum + e.amount, 0)
  const remaining = budgetTotal != null ? budgetTotal - spent : null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-sage-600">Budget</p>
            <p className="text-lg font-medium text-sage-900">{formatZar(budgetTotal)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-sage-600">Spent</p>
            <p className="text-lg font-medium text-sage-900">{formatZar(spent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-xs text-sage-600">Remaining</p>
            <p className="text-lg font-medium text-sage-900">{formatZar(remaining)}</p>
          </CardContent>
        </Card>
      </div>

      <ul className="space-y-2">
        {expenses.length === 0 && (
          <li className="text-sm text-sage-600">No expenses logged yet.</li>
        )}
        {expenses.map((e) => (
          <li key={e.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium text-sage-900">
                    {formatZar(e.amount)}
                    {e.category ? ` · ${e.category}` : ''}
                  </p>
                  <p className="text-sm text-sage-600">
                    {formatDate(e.date)}
                    {e.description ? ` · ${e.description}` : ''}
                    {e.also_count_in_monthly_budget ? ' · counts in monthly budget' : ''}
                  </p>
                </div>
                <form action={deleteExpenseAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="trip_id" value={tripId} />
                  <button type="submit" className="text-sm text-terracotta-700">
                    Remove
                  </button>
                </form>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          run(addExpenseAction, new FormData(ev.currentTarget), ev.currentTarget)
        }}
        className="space-y-3 rounded-md border border-sage-200 p-4"
      >
        <input type="hidden" name="trip_id" value={tripId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="date" type="date" required className={inputClass} disabled={pending} />
          <input
            name="amount"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="Amount (R)"
            className={inputClass}
            disabled={pending}
          />
        </div>
        <input
          name="category"
          type="text"
          placeholder="Category (optional)"
          className={inputClass}
          disabled={pending}
        />
        <input
          name="description"
          type="text"
          placeholder="Description (optional)"
          className={inputClass}
          disabled={pending}
        />
        <label className="flex items-center gap-2 text-sm text-sage-800">
          <input type="checkbox" name="also_count_in_monthly_budget" disabled={pending} />
          Also count in our monthly budget
        </label>
        {error && <p className="text-sm text-terracotta-700">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Adding…' : 'Add expense'}
        </Button>
      </form>
    </div>
  )
}

// ── Packing ─────────────────────────────────────────────────────────────────

function PackingTab({ tripId, packingLists, packingItems, members }: TripDetailData) {
  const { error, pending, run } = useSubmit()
  return (
    <div className="space-y-4">
      {packingLists.length === 0 && (
        <p className="text-sm text-sage-600">No packing lists yet.</p>
      )}
      {packingLists.map((list) => {
        const items = packingItems.filter((i) => i.list_id === list.id)
        return (
          <Card key={list.id}>
            <CardContent className="space-y-3 p-4">
              <p className="font-medium text-sage-900">{list.name}</p>
              <ul className="space-y-1">
                {items.length === 0 && (
                  <li className="text-sm text-sage-600">No items yet.</li>
                )}
                {items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2">
                    <form action={togglePackedAction} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="trip_id" value={tripId} />
                      <input type="hidden" name="packed" value={String(!item.packed)} />
                      <button type="submit" className="flex items-center gap-2 text-left">
                        <span
                          className={
                            item.packed
                              ? 'flex h-4 w-4 items-center justify-center rounded border border-terracotta-600 bg-terracotta-600 text-[10px] text-cream-50'
                              : 'flex h-4 w-4 items-center justify-center rounded border border-sage-400'
                          }
                          aria-hidden
                        >
                          {item.packed ? '✓' : ''}
                        </span>
                        <span
                          className={
                            item.packed
                              ? 'text-sm text-sage-500 line-through'
                              : 'text-sm text-sage-900'
                          }
                        >
                          {item.name}
                          {item.packed && item.packed_by_user_id
                            ? ` (${memberLabel(members, item.packed_by_user_id)})`
                            : ''}
                        </span>
                      </button>
                    </form>
                    <form action={deletePackingItemAction}>
                      <input type="hidden" name="id" value={item.id} />
                      <input type="hidden" name="trip_id" value={tripId} />
                      <button type="submit" className="text-xs text-terracotta-700">
                        Remove
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
              <form
                onSubmit={(ev) => {
                  ev.preventDefault()
                  run(addPackingItemAction, new FormData(ev.currentTarget), ev.currentTarget)
                }}
                className="flex gap-2"
              >
                <input type="hidden" name="trip_id" value={tripId} />
                <input type="hidden" name="list_id" value={list.id} />
                <input
                  name="name"
                  type="text"
                  required
                  placeholder="Add item"
                  className={inputClass}
                  disabled={pending}
                />
                <Button type="submit" disabled={pending}>
                  Add
                </Button>
              </form>
            </CardContent>
          </Card>
        )
      })}

      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          run(addPackingListAction, new FormData(ev.currentTarget), ev.currentTarget)
        }}
        className="flex gap-2 rounded-md border border-sage-200 p-4"
      >
        <input type="hidden" name="trip_id" value={tripId} />
        <input
          name="name"
          type="text"
          required
          placeholder="New packing list (e.g. Carry-on)"
          className={inputClass}
          disabled={pending}
        />
        <Button type="submit" disabled={pending}>
          Add list
        </Button>
      </form>
      {error && <p className="text-sm text-terracotta-700">{error}</p>}
    </div>
  )
}

// ── Documents ─────────────────────────────────────────────────────────────

function DocumentsTab({ tripId, docs }: TripDetailData) {
  const { error, pending, run } = useSubmit()
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'uploading' | 'done' | 'not_connected' | 'error'
  >('idle')
  const [driveFileId, setDriveFileId] = useState('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadStatus('uploading')
    setDriveFileId('')
    const body = new FormData()
    body.set('file', file)
    body.set('module', 'Travel')
    body.set('subcategory', tripId) // per-trip subfolder under /HomeApp/Travel
    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body })
      if (res.status === 409) {
        setUploadStatus('not_connected')
        return
      }
      if (!res.ok) {
        setUploadStatus('error')
        return
      }
      const json = (await res.json()) as { driveFileId?: string }
      if (json.driveFileId) {
        setDriveFileId(json.driveFileId)
        setUploadStatus('done')
      } else {
        setUploadStatus('error')
      }
    } catch {
      setUploadStatus('error')
    }
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {docs.length === 0 && (
          <li className="text-sm text-sage-600">No travel documents yet.</li>
        )}
        {docs.map((doc) => (
          <li key={doc.id}>
            <Card>
              <CardContent className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium capitalize text-sage-900">{doc.kind}</p>
                  <p className="text-sm text-sage-600">
                    {doc.drive_file_id ? 'File attached' : 'No file attached'}
                    {doc.expiry_date ? ` · expires ${formatDate(doc.expiry_date)}` : ''}
                  </p>
                </div>
                <form action={deleteTripDocAction}>
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="trip_id" value={tripId} />
                  <button type="submit" className="text-sm text-terracotta-700">
                    Remove
                  </button>
                </form>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          run(addTripDocAction, new FormData(ev.currentTarget), ev.currentTarget)
        }}
        className="space-y-3 rounded-md border border-sage-200 p-4"
      >
        <input type="hidden" name="trip_id" value={tripId} />
        <input type="hidden" name="drive_file_id" value={driveFileId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <select name="kind" className={inputClass} disabled={pending} defaultValue="passport">
            {TRIP_DOC_KINDS.map((k) => (
              <option key={k} value={k}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </option>
            ))}
          </select>
          <input
            name="expiry_date"
            type="date"
            className={inputClass}
            disabled={pending}
          />
        </div>
        <input
          type="file"
          onChange={handleFile}
          disabled={pending || uploadStatus === 'uploading'}
          className="block w-full text-sm text-sage-700 file:mr-3 file:rounded-md file:border-0 file:bg-sage-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sage-800 hover:file:bg-sage-200 disabled:opacity-50"
        />
        {uploadStatus === 'uploading' && (
          <p className="text-xs text-sage-600">Uploading…</p>
        )}
        {uploadStatus === 'done' && (
          <p className="text-xs text-sage-600">File attached.</p>
        )}
        {uploadStatus === 'not_connected' && (
          <p className="text-xs text-terracotta-700">
            Drive is not connected yet, so the file was not uploaded. You can still
            save this document and attach the file later once Drive is set up.
          </p>
        )}
        {uploadStatus === 'error' && (
          <p className="text-xs text-terracotta-700">
            That upload did not work. You can still save the document without a file.
          </p>
        )}
        {error && <p className="text-sm text-terracotta-700">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add document'}
        </Button>
      </form>
    </div>
  )
}

// ── Outfits ─────────────────────────────────────────────────────────────────

function OutfitsTab({ tripId, outfits }: TripDetailData) {
  const { error, pending, run } = useSubmit()
  return (
    <div className="space-y-4">
      <p className="text-sm text-sage-600">
        Assign wardrobe item ids to a day. The wardrobe lives in another module, so
        outfits store item ids only — item details show once the wardrobe module is open.
      </p>
      <ul className="space-y-2">
        {outfits.length === 0 && (
          <li className="text-sm text-sage-600">No outfits planned yet.</li>
        )}
        {outfits.map((o) => (
          <li key={o.id}>
            <Card>
              <CardContent className="flex items-start justify-between gap-3 p-3">
                <div>
                  <p className="text-sm font-medium text-sage-900">{formatDayLabel(o.day)}</p>
                  <p className="break-all text-xs text-sage-600">
                    {o.wardrobe_item_ids.length === 0
                      ? 'No items'
                      : `${o.wardrobe_item_ids.length} item(s): ${o.wardrobe_item_ids.join(', ')}`}
                  </p>
                </div>
                <form action={deleteOutfitAction}>
                  <input type="hidden" name="id" value={o.id} />
                  <input type="hidden" name="trip_id" value={tripId} />
                  <button type="submit" className="text-sm text-terracotta-700">
                    Remove
                  </button>
                </form>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(ev) => {
          ev.preventDefault()
          run(saveOutfitAction, new FormData(ev.currentTarget), ev.currentTarget)
        }}
        className="space-y-3 rounded-md border border-sage-200 p-4"
      >
        <input type="hidden" name="trip_id" value={tripId} />
        <input name="day" type="date" required className={inputClass} disabled={pending} />
        <textarea
          name="wardrobe_item_ids"
          rows={2}
          placeholder="Wardrobe item ids, comma or space separated"
          className={inputClass}
          disabled={pending}
        />
        {error && <p className="text-sm text-terracotta-700">{error}</p>}
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Add outfit plan'}
        </Button>
      </form>
    </div>
  )
}

// ── Notes ─────────────────────────────────────────────────────────────────

function NotesTab({ tripId, note }: TripDetailData) {
  const { error, pending, run } = useSubmit()
  const [saved, setSaved] = useState(false)
  return (
    <form
      onSubmit={async (ev) => {
        ev.preventDefault()
        setSaved(false)
        await run(saveTripNotesAction, new FormData(ev.currentTarget))
        setSaved(true)
      }}
      className="space-y-3"
    >
      <input type="hidden" name="trip_id" value={tripId} />
      {note && <input type="hidden" name="note_id" value={note.id} />}
      <textarea
        name="body_md"
        rows={10}
        defaultValue={note?.body_md ?? ''}
        placeholder="Shared travel notes (Markdown)…"
        className={inputClass}
        disabled={pending}
      />
      {error && <p className="text-sm text-terracotta-700">{error}</p>}
      {saved && !error && <p className="text-sm text-sage-600">Notes saved.</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save notes'}
      </Button>
    </form>
  )
}
