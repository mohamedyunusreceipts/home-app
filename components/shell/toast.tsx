'use client'

/**
 * Shell toast — fixed, centered, bottom:96px, z-70. Sage-700 pill with a
 * leading sage check icon. README toast spec. Rendered by ShellChrome from
 * shell context state; one at a time, auto-dismiss handled by the provider.
 */
export function Toast({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-1/2 z-[70] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-[9px] whitespace-nowrap rounded-3xl bg-sage-700 px-[18px] py-[11px] text-sage-50 shadow-[0_12px_30px_rgba(0,0,0,.25)]"
      style={{ bottom: 'calc(96px + env(safe-area-inset-bottom))', animation: 'toastIn .25s ease' }}
    >
      <svg
        width="17"
        height="17"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#A7D2A8"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
      <span className="text-[13.5px] font-semibold">{message}</span>
    </div>
  )
}
