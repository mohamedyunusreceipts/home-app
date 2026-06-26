import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/shell/top-bar'
import { PrimaryNav } from '@/components/shell/primary-nav'
import { Fab } from '@/components/shell/fab'

/**
 * Authenticated app shell — top bar, primary nav (bottom tabs on mobile / left
 * sidebar on desktop), context FAB. Auth-gates the whole group via
 * requireHousehold(). Spec §6.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()
  const { data: household } = await supabase
    .from('households')
    .select('name')
    .eq('id', householdId)
    .single()

  return (
    <div className="min-h-screen bg-background">
      <TopBar householdName={household?.name ?? 'Home'} />
      <PrimaryNav />

      {/* Content area — offset for the fixed top bar (all sizes) and the fixed
          sidebar (desktop). Bottom padding clears the mobile tab bar. Pages
          render their own <main>, so this is a plain wrapper. */}
      <div className="pt-14 pb-24 md:pb-8 md:pl-56">{children}</div>

      <Fab />
    </div>
  )
}
