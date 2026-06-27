'use client'

import { useEffect } from 'react'

/**
 * Bottom-sheet chrome shared by quick-add + More. Scrim (tap to close) +
 * slide-up panel with a drag-handle pill. README "Bottom sheets".
 */
export function Sheet({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  // Close on Escape.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col justify-end"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 border-none"
        style={{ background: 'rgba(36,31,27,.45)', animation: 'fadeIn .2s ease' }}
      />
      <div
        className="relative flex max-h-[90dvh] flex-col overflow-y-auto rounded-t-[30px] bg-cream-100 px-[22px] pt-5 shadow-[0_-10px_40px_rgba(0,0,0,.2)]"
        style={{
          paddingBottom: 'calc(32px + env(safe-area-inset-bottom))',
          animation: 'sheetIn .28s cubic-bezier(.2,.8,.2,1)',
        }}
      >
        <div className="mx-auto mb-[18px] h-[5px] w-[42px] shrink-0 rounded-full bg-cream-400" />
        <div className="font-serif text-[22px] text-terracotta-900">{title}</div>
        {subtitle ? (
          <div className="mt-1 mb-4 text-[13px] font-medium text-[#8a7163]">{subtitle}</div>
        ) : (
          <div className="mb-4" />
        )}
        {children}
      </div>
    </div>
  )
}
