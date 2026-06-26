'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { saveContactAction, deleteContactAction } from '@/app/(app)/calendar/actions'
import type { ContactRow } from './types'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

const dobFmt = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'short',
  timeZone: 'Africa/Johannesburg',
})

function formatDob(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00+02:00`)
  if (Number.isNaN(d.getTime())) return '—'
  return dobFmt.format(d)
}

export function ContactsManager({ contacts }: { contacts: ContactRow[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<ContactRow | 'new' | null>(null)

  return (
    <div className="space-y-4">
      {contacts.length === 0 ? (
        <p className="text-sage-600">No contacts yet. Add your first below.</p>
      ) : (
        <ul className="divide-y divide-sage-100">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-sage-900">{c.name}</p>
                <p className="text-sm text-sage-600">
                  {formatDob(c.dob)}
                  {c.relationship ? ` · ${c.relationship}` : ''}
                </p>
                {c.gift_ideas_text && (
                  <p className="mt-0.5 text-xs text-sage-500">Gift ideas: {c.gift_ideas_text}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(c)}>
                  Edit
                </Button>
                <DeleteButton id={c.id} onDeleted={() => router.refresh()} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing == null ? (
        <Button size="sm" onClick={() => setEditing('new')}>
          + Add contact
        </Button>
      ) : (
        <ContactForm
          contact={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function ContactForm({
  contact,
  onClose,
  onSaved,
}: {
  contact: ContactRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const res = await saveContactAction(formData)
    setPending(false)
    if ('error' in res) {
      setError(res.error)
      return
    }
    onSaved()
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-4 rounded-lg border border-sage-200 bg-sage-50/50 p-4"
    >
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="c-name" className="block text-sm font-medium text-sage-800">
            Name
          </label>
          <input
            id="c-name"
            name="name"
            type="text"
            required
            defaultValue={contact?.name ?? ''}
            className={inputClass}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="c-dob" className="block text-sm font-medium text-sage-800">
            Date of birth
          </label>
          <input
            id="c-dob"
            name="dob"
            type="date"
            defaultValue={contact?.dob ?? ''}
            className={inputClass}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="c-rel" className="block text-sm font-medium text-sage-800">
            Relationship <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="c-rel"
            name="relationship"
            type="text"
            defaultValue={contact?.relationship ?? ''}
            placeholder="e.g. Mum, friend"
            className={inputClass}
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="c-gifts" className="block text-sm font-medium text-sage-800">
            Gift ideas <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="c-gifts"
            name="gift_ideas_text"
            type="text"
            defaultValue={contact?.gift_ideas_text ?? ''}
            className={inputClass}
            disabled={pending}
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}

function DeleteButton({ id, onDeleted }: { id: string; onDeleted: () => void }) {
  const [pending, setPending] = useState(false)
  return (
    <Button
      size="sm"
      variant="destructive"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        const fd = new FormData()
        fd.set('id', id)
        const res = await deleteContactAction(fd)
        setPending(false)
        if (!('error' in res)) onDeleted()
      }}
    >
      {pending ? '…' : 'Delete'}
    </Button>
  )
}
