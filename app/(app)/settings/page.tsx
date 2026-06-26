import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { headers } from 'next/headers'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { InviteCard } from './invite-card'
import { PushToggle } from '@/components/shell/push-toggle'
import { signOutAction } from './actions'

export default async function SettingsPage() {
  const { user, householdId } = await requireHousehold()
  const supabase = await createClient()

  const [{ data: household }, { data: members }, { data: existingInvite }] = await Promise.all([
    supabase.from('households').select('name, drive_root_folder_id').eq('id', householdId).single(),
    supabase.from('household_members').select('user_id, role').eq('household_id', householdId),
    supabase
      .from('invites')
      .select('token')
      .eq('household_id', householdId)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(),
  ])

  const hasPartner = (members?.length ?? 0) >= 2
  const driveConnected = Boolean(household?.drive_root_folder_id)

  // Build the app origin from the incoming request headers. Avoids hardcoding the URL.
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('host') ?? 'localhost:3000'
  const appOrigin = `${proto}://${host}`

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sage-800">
            <p>{user.email}</p>
            <form action={signOutAction} className="pt-3">
              <Button type="submit" variant="outline">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Household</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sage-800">
            <p>
              <span className="font-medium">Name:</span> {household?.name ?? '—'}
            </p>
            <p>
              <span className="font-medium">Members:</span>{' '}
              {hasPartner ? '2 of 2 (full)' : '1 of 2 (waiting for partner)'}
            </p>
          </CardContent>
        </Card>

        {!hasPartner && (
          <Card>
            <CardHeader>
              <CardTitle className="font-serif text-terracotta-700">Invite your partner</CardTitle>
            </CardHeader>
            <CardContent>
              <InviteCard appOrigin={appOrigin} initialToken={existingInvite?.token ?? null} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Notifications</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sage-800">
            <p>
              Get push notifications on this device for reminders and partner
              activity, even when the app is not open.
            </p>
            <PushToggle />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Google Drive</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sage-800">
            {driveConnected ? (
              <p>Connected. Files are stored in your Drive under /HomeApp/.</p>
            ) : (
              <>
                <p>Drive is not connected yet. Document and image uploads will be enabled once you connect.</p>
                <p className="text-sm text-sage-600">
                  Drive connection is added in the next phase of the build.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
