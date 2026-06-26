import { headers } from 'next/headers'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { ScreenHeader } from '@/components/shell/screen-header'
import { PushToggle } from '@/components/shell/push-toggle'
import { HouseholdCard } from './household-card'
import { DriveCard } from './drive-card'
import { signOutAction } from './actions'

type MemberRow = {
  user_id: string
  role: string
  profiles: { display_name: string | null; email: string } | null
}

export default async function SettingsPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const [{ data: household }, { data: members }, { data: existingInvite }] = await Promise.all([
    supabase.from('households').select('name, drive_root_folder_id').eq('id', householdId).single(),
    supabase
      .from('household_members')
      .select('user_id, role, profiles ( display_name, email )')
      .eq('household_id', householdId)
      .returns<MemberRow[]>(),
    supabase
      .from('invites')
      .select('token')
      .eq('household_id', householdId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
  ])

  // Order with the signed-in user first so their avatar reads as the leading
  // (terracotta) circle, then derive a display name per member.
  const memberRows = [...(members ?? [])].sort((a, b) => {
    if (a.user_id === user.id) return -1
    if (b.user_id === user.id) return 1
    return 0
  })
  const memberNames = memberRows.map(
    (m) => m.profiles?.display_name || m.profiles?.email?.split('@')[0] || 'Partner',
  )

  const isOwner = memberRows.some((m) => m.user_id === user.id && m.role === 'owner')
  const hasPartner = memberRows.length >= 2
  const driveConnected = Boolean(household?.drive_root_folder_id)

  // Build the app origin from the incoming request headers (avoids hardcoding).
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  const appOrigin = `${proto}://${host}`

  return (
    <main className="mx-auto max-w-xl px-[22px] pb-[120px] pt-2">
      <ScreenHeader title="Settings" />

      <div className="space-y-4">
        <HouseholdCard
          householdName={household?.name ?? 'Your household'}
          memberNames={memberNames}
          appOrigin={appOrigin}
          initialToken={existingInvite?.token ?? null}
          canInvite={!hasPartner}
        />

        {/* Settings group: white card, rows divided by #F2EBDF. */}
        <section className="overflow-hidden rounded-[20px] border border-[#E8DFCE] bg-[#FFFDF9]">
          <div className="flex items-center justify-between px-[18px] py-4">
            <span className="text-sm font-semibold text-[#3F2118]">Push notifications</span>
            <PushToggle />
          </div>
          <SettingRow label="Reminders & nudges" />
          <SettingRow label="Help & feedback" />
        </section>

        <DriveCard connected={driveConnected} isOwner={isOwner} />

        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-[16px] border border-[#F4DDD2] bg-[#FBF2EE] px-4 py-3.5 text-sm font-semibold text-[#974F38] transition-opacity hover:opacity-90"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  )
}

/**
 * A divided placeholder row in the Settings group: label + chevron. The top
 * border (#F2EBDF) supplies the divider between rows.
 */
function SettingRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between border-t border-[#F2EBDF] px-[18px] py-4 text-left transition-colors hover:bg-[#FAF6EF]"
    >
      <span className="text-sm font-semibold text-[#3F2118]">{label}</span>
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#C8B79C"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
}
