'use client'

import { useState } from 'react'

/**
 * Photo picker for a wardrobe item. Uploads to Drive via POST /api/drive/upload
 * with module 'Wardrobe' and subcategory = the owner's user id (matches the
 * spec §5.4 folder layout `/HomeApp/Wardrobe/<UserId>/`). Reports the resulting
 * drive_file_id back through a hidden input so the surrounding server-action
 * form can persist it.
 *
 * Drive may not be connected yet (OAuth scope upgrade deferred): the route
 * returns 409 DRIVE_NOT_CONNECTED — we surface a friendly notice and let the
 * user save the item anyway; the photo can be attached later.
 */
export function PhotoField({
  ownerUserId,
  initialDriveFileId = '',
  disabled,
}: {
  ownerUserId: string
  initialDriveFileId?: string
  disabled?: boolean
}) {
  const [driveFileId, setDriveFileId] = useState(initialDriveFileId)
  const [status, setStatus] = useState<
    'idle' | 'uploading' | 'done' | 'not_connected' | 'error'
  >('idle')
  const [fileName, setFileName] = useState('')

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setStatus('uploading')

    const body = new FormData()
    body.set('file', file)
    body.set('module', 'Wardrobe')
    body.set('subcategory', ownerUserId)

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
        Photo <span className="text-sage-500">(optional)</span>
      </label>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        disabled={disabled || status === 'uploading'}
        className="block w-full text-sm text-sage-700 file:mr-3 file:rounded-md file:border-0 file:bg-sage-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sage-800 hover:file:bg-sage-200 disabled:opacity-50"
      />
      <input type="hidden" name="photo_drive_file_id" value={driveFileId} />

      {status === 'uploading' && (
        <p className="text-xs text-sage-600">Uploading {fileName}…</p>
      )}
      {status === 'done' && (
        <p className="text-xs text-sage-600">Photo attached.</p>
      )}
      {status === 'not_connected' && (
        <p className="text-xs text-terracotta-700">
          Drive is not connected yet, so the photo was not uploaded. You can still
          save this item and add a photo later once Drive is set up.
        </p>
      )}
      {status === 'error' && (
        <p className="text-xs text-terracotta-700">
          That upload did not work. You can still save the item without a photo.
        </p>
      )}
    </div>
  )
}
