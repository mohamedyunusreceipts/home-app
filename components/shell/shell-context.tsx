'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ShellChrome } from './shell-chrome'

/** Which bottom sheet (if any) is currently open. */
export type ShellSheet = null | 'quick' | 'more'

/**
 * The shared shell contract every Today / module screen relies on.
 *
 *  - showToast(message)  — show ONE toast at a time (replaces any current one),
 *                          auto-dismisses after 1900ms. README toast spec.
 *  - openQuickAdd()      — open the quick-add bottom sheet.
 *  - openMore()          — open the More (overflow modules) bottom sheet.
 *  - closeSheet()        — dismiss whichever sheet is open.
 */
export type ShellContextValue = {
  sheet: ShellSheet
  toast: string | null
  showToast: (message: string) => void
  openQuickAdd: () => void
  openMore: () => void
  closeSheet: () => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

const TOAST_DURATION_MS = 1900

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [sheet, setSheet] = useState<ShellSheet>(null)
  const [toast, setToast] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(message)
    timerRef.current = setTimeout(() => {
      setToast(null)
      timerRef.current = null
    }, TOAST_DURATION_MS)
  }, [])

  const openQuickAdd = useCallback(() => setSheet('quick'), [])
  const openMore = useCallback(() => setSheet('more'), [])
  const closeSheet = useCallback(() => setSheet(null), [])

  // Clear the pending toast timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const value: ShellContextValue = {
    sheet,
    toast,
    showToast,
    openQuickAdd,
    openMore,
    closeSheet,
  }

  return (
    <ShellContext.Provider value={value}>
      {children}
      <ShellChrome />
    </ShellContext.Provider>
  )
}

/** Access the shell controls (toast + sheets). Must be used inside ShellProvider. */
export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) {
    throw new Error('useShell must be used within a ShellProvider')
  }
  return ctx
}
