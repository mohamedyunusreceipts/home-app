'use client'

import { useShell } from './shell-context'
import { PillNav } from './pill-nav'
import { PrimaryNav } from './primary-nav'
import { QuickAddSheet } from './quick-add-sheet'
import { MoreSheet } from './more-sheet'
import { Toast } from './toast'

/**
 * Renders all shell chrome that depends on shell context: the desktop sidebar +
 * mobile pill nav, the active bottom sheet, and the toast. Lives inside
 * ShellProvider so it can read state via useShell().
 */
export function ShellChrome() {
  const { sheet, toast } = useShell()

  return (
    <>
      {/* Desktop sidebar (≥768px) */}
      <PrimaryNav />
      {/* Mobile floating pill nav (<768px) */}
      <PillNav />

      {sheet === 'quick' && <QuickAddSheet />}
      {sheet === 'more' && <MoreSheet />}

      {toast && <Toast message={toast} />}
    </>
  )
}
