'use client'

import { useState } from 'react'

/**
 * A self-contained file picker that uploads to Drive via POST /api/drive/upload
 * and reports the resulting drive_file_id back through a hidden input named
 * `drive_file_id`, so a surrounding server-action form can persist it.
 *
 * Drive may not be connected yet (the OAuth scope-upgrade flow is deferred): the
 * route returns 409 DRIVE_NOT_CONNECTED in that case. We surface a friendly
 * "Drive not connected" notice and let the user save the metadata row anyway —
 * the binary can be attached later once Drive is wired up.
 */
export function UploadField({
  module = 'Documents',
  subcategory,
  disabled,
}: {
  module?: string
  subcategory?: string
  disabled?: boolean
}) {
  const [driveFileId, setDriveFileId] = useState('')
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'done' | 'not_connected' | 'error'
  >('idle')
  const [fileName, setFileName] = useState('')

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setStatus('uploading')
    setDriveFileId('')

    const body = new FormData()
    body.set('file', file)
    body.set('module', module)
    if (subcategory) body.set('subcategory', subcategory)

    try {
      const res = await fetch('/api/drive/upload', { method: 'POST', body })
      if (res.status === 409) {
        setStatus('not_connected')
        return
      }
      if (!res.ok) {
        setStatus('error')
        return
      }
      const json = (await res.json()) as { driveFileId?: string }
      if (json.driveFileId) {
        setDriveFileId(json.driveFileId)
        setStatus('done')
      } else {
        setStatus('error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-sage-800">
        Attach file <span className="text-sage-500">(optional)</span>
      </label>
      <input
        type="file"
        onChange={handleChange}
        disabled={disabled || status === 'uploading'}
        className="block w-full text-sm text-sage-700 file:mr-3 file:rounded-md file:border-0 file:bg-sage-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sage-800 hover:file:bg-sage-200 disabled:opacity-50"
      />
      {/* Carries the resolved Drive id into the surrounding server-action form. */}
      <input type="hidden" name="drive_file_id" value={driveFileId} />

      {status === 'uploading' && (
        <p className="text-xs text-sage-600">Uploading {fileName}…</p>
      )}
      {status === 'done' && (
        <p className="text-xs text-sage-600">Attached {fileName}.</p>
      )}
      {status === 'not_connected' && (
        <p className="text-xs text-terracotta-700">
          Drive is not connected yet, so the file was not uploaded. You can still
          save this entry and attach the file later once Drive is set up.
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-terracotta-700">
          That upload did not work. You can still save the entry without a file.
        </p>
      )}
    </div>
  )
}
