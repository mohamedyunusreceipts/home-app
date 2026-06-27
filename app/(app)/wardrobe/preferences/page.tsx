import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { WardrobeTabs } from '@/components/wardrobe/tabs'
import { PreferencesForm } from '@/components/wardrobe/preferences-form'
import type { WardrobePreferencesRow } from '@/components/wardrobe/types'

export default async function PreferencesPage() {
  const { user } = await requireHousehold()
  const supabase = await createClient()

  // Per-user row — RLS gates it to the caller (user_id = auth.uid()).
  const { data: prefs } = await supabase
    .from('wardrobe_preferences')
    .select('user_id, sizes, style_notes_md')
    .eq('user_id', user.id)
    .maybeSingle<WardrobePreferencesRow>()

  const sizesObj = (prefs?.sizes ?? {}) as Record<string, unknown>
  const initialSizes = Object.entries(sizesObj).map(([key, value]) => ({
    key,
    value: value == null ? '' : String(value),
  }))

  return (
    <main className="min-h-screen p-8 pb-28">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Sizes &amp; preferences</h1>
        <WardrobeTabs active="/wardrobe/preferences" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Your sizes &amp; style
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-sage-600">
              These are private to you and also appear in the Vault&rsquo;s
              &ldquo;Sizes &amp; preferences&rdquo; tab. Use any keys you like —
              clothing sizes, ring size, watch band, and so on.
            </p>
            <PreferencesForm initialSizes={initialSizes} initialNotes={prefs?.style_notes_md ?? ''} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
