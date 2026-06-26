import { requireHousehold } from '@/lib/auth/redirects'
import { ShellProvider } from '@/components/shell/shell-context'

/**
 * Authenticated app shell — Focus Timeline redesign.
 *
 * Auth-gates the whole group via requireHousehold(), then wraps the page tree
 * in ShellProvider. The provider renders the shell chrome (desktop sidebar +
 * mobile floating pill nav, quick-add / More bottom sheets, and the toast) and
 * exposes useShell() (showToast / openQuickAdd / openMore / closeSheet) to any
 * client component beneath it.
 *
 * The fixed mobile top bar is gone — per-screen headers (Today's avatars + ⋮,
 * other screens' back-chevron + title) are built per page. Pages render their
 * own <main> with bottom padding (~120px) so content clears the pill nav.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireHousehold()

  return (
    <div className="min-h-screen bg-background">
      <ShellProvider>
        {/* Desktop offset for the fixed sidebar; mobile bottom space clears the
            floating pill nav. Pages render their own <main>. */}
        <div className="pb-28 md:pb-8 md:pl-56">{children}</div>
      </ShellProvider>
    </div>
  )
}
