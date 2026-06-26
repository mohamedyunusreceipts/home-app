'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { addExpenseAction } from './actions'
import { parseReceiptResult } from '@/components/money/receipt'
import type { MemberOption } from '@/components/money/map'
import type { SplitType } from '@/components/money/split'

const inputClass =
  'w-full rounded-md border border-sage-300 bg-cream-50 px-3 py-2 text-sage-900 placeholder:text-sage-400 focus:border-terracotta-400 focus:outline-none focus:ring-2 focus:ring-terracotta-200 disabled:opacity-50'

type Props = {
  members: MemberOption[]
  currentUserId: string
  categories: string[]
  /** Today's date as YYYY-MM-DD, computed server-side in the app timezone. */
  today: string
}

export function ExpenseForm({ members, currentUserId, categories, today }: Props) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [splitType, setSplitType] = useState<SplitType>('equal')

  // Receipt OCR state.
  const [ocrBusy, setOcrBusy] = useState(false)
  const [ocrNote, setOcrNote] = useState<string | null>(null)
  const [receiptFileId, setReceiptFileId] = useState<string>('')

  // Controlled pre-fillable fields (so OCR can populate them).
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today)
  const [category, setCategory] = useState(categories[0] ?? 'Other')
  const [description, setDescription] = useState('')

  // The other household member (for the split). Falls back to current user.
  const partnerUserId = useMemo(
    () => members.find((m) => m.userId !== currentUserId)?.userId ?? '',
    [members, currentUserId],
  )

  async function handleReceipt(file: File) {
    setOcrBusy(true)
    setOcrNote(null)
    setError(null)
    try {
      // 1. Try to upload the image to Drive (subcategory Receipts). Degrade on 409.
      const uploadForm = new FormData()
      uploadForm.append('file', file)
      uploadForm.append('module', 'Money')
      uploadForm.append('subcategory', 'Receipts')
      try {
        const up = await fetch('/api/drive/upload', { method: 'POST', body: uploadForm })
        if (up.ok) {
          const { driveFileId } = (await up.json()) as { driveFileId?: string }
          if (driveFileId) setReceiptFileId(driveFileId)
        } else if (up.status === 409) {
          setOcrNote('Drive isn’t connected — saving without the receipt image.')
        }
      } catch {
        setOcrNote('Could not reach Drive — saving without the receipt image.')
      }

      // 2. OCR via the AI suggest endpoint. Read the image as base64 for the prompt.
      const base64 = await fileToBase64(file)
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'receipt_ocr',
          context: { imageBase64: base64, mediaType: file.type || 'image/jpeg' },
        }),
      })

      if (res.status === 500) {
        const body = (await res.json().catch(() => ({}))) as { code?: string }
        if (body.code === 'AI_NOT_CONFIGURED') {
          setOcrNote('Receipt scanning isn’t set up — please enter the details manually.')
          return
        }
      }
      if (res.status === 429) {
        setOcrNote('Monthly AI limit reached — please enter the details manually.')
        return
      }
      if (!res.ok) {
        setOcrNote('Couldn’t read the receipt — please enter the details manually.')
        return
      }

      const { result } = (await res.json()) as { result?: string }
      const prefill = parseReceiptResult(result ?? '')
      if (prefill.amount != null) setAmount(String(prefill.amount))
      if (prefill.date) setDate(prefill.date)
      if (prefill.suggestedCategory && categories.includes(prefill.suggestedCategory)) {
        setCategory(prefill.suggestedCategory)
      }
      if (prefill.merchant) setDescription(prefill.merchant)
      setOcrNote((prev) =>
        prefill.amount != null || prefill.merchant
          ? 'Pre-filled from the receipt — please check and confirm.'
          : (prev ?? 'Couldn’t read much — please enter the details manually.'),
      )
    } finally {
      setOcrBusy(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setError(null)
    const result = await addExpenseAction(formData)
    setPending(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    // Reset the most volatile fields and refresh server data.
    setAmount('')
    setDescription('')
    setReceiptFileId('')
    setOcrNote(null)
    router.refresh()
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Hidden fields the action needs. */}
      <input type="hidden" name="partner_user_id" value={partnerUserId} />
      <input type="hidden" name="receipt_drive_file_id" value={receiptFileId} />

      {/* Receipt OCR. */}
      <div className="space-y-2 rounded-md border border-sage-200 p-3">
        <label htmlFor="receipt" className="block text-sm font-medium text-sage-800">
          Snap a receipt <span className="text-sage-500">(optional)</span>
        </label>
        <input
          id="receipt"
          type="file"
          accept="image/*"
          capture="environment"
          className="block w-full text-sm text-sage-700 file:mr-3 file:rounded-md file:border-0 file:bg-sage-100 file:px-3 file:py-2 file:text-sage-800"
          disabled={pending || ocrBusy}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleReceipt(f)
          }}
        />
        {ocrBusy && <p className="text-sm text-sage-600">Reading the receipt…</p>}
        {ocrNote && typeof ocrNote === 'string' && (
          <p className="text-sm text-sage-700">{ocrNote}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="amount" className="block text-sm font-medium text-sage-800">
            Amount (R)
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="e.g. 250"
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="date" className="block text-sm font-medium text-sage-800">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass}
            disabled={pending}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="category" className="block text-sm font-medium text-sage-800">
            Category
          </label>
          <select
            id="category"
            name="category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
            disabled={pending}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="paid_by_user_id" className="block text-sm font-medium text-sage-800">
            Paid by
          </label>
          <select
            id="paid_by_user_id"
            name="paid_by_user_id"
            required
            defaultValue={currentUserId}
            className={inputClass}
            disabled={pending}
          >
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.userId === currentUserId ? 'You' : m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="split_type" className="block text-sm font-medium text-sage-800">
            Split
          </label>
          <select
            id="split_type"
            name="split_type"
            required
            value={splitType}
            onChange={(e) => setSplitType(e.target.value as SplitType)}
            className={inputClass}
            disabled={pending}
          >
            <option value="equal">Equal (50 / 50)</option>
            <option value="me_only">Payer only</option>
            <option value="partner_only">Other person only</option>
            <option value="custom_amount">Custom amounts</option>
          </select>
        </div>

        <div className="space-y-2 sm:col-span-2">
          <label htmlFor="description" className="block text-sm font-medium text-sage-800">
            Description <span className="text-sage-500">(optional)</span>
          </label>
          <input
            id="description"
            name="description"
            type="text"
            maxLength={200}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
            className={inputClass}
            disabled={pending}
          />
        </div>

        {splitType === 'custom_amount' && (
          <>
            <div className="space-y-2">
              <label htmlFor="custom_me" className="block text-sm font-medium text-sage-800">
                Payer&apos;s share (R)
              </label>
              <input
                id="custom_me"
                name="custom_me"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={inputClass}
                disabled={pending}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="custom_partner" className="block text-sm font-medium text-sage-800">
                Other person&apos;s share (R)
              </label>
              <input
                id="custom_partner"
                name="custom_partner"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className={inputClass}
                disabled={pending}
              />
            </div>
            <p className="text-xs text-sage-600 sm:col-span-2">
              The two shares must add up to the total amount.
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-terracotta-700" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Saving…' : 'Add expense'}
      </Button>
    </form>
  )
}

/** Read a File into a base64 string (no data: prefix) for the OCR prompt. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') {
        const comma = result.indexOf(',')
        resolve(comma >= 0 ? result.slice(comma + 1) : result)
      } else {
        reject(new Error('Could not read file'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}
