import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SectionNav } from '@/components/home/section-nav'
import { SimpleCreateForm, homeInputClass } from '@/components/home/simple-create-form'
import type { ShoppingLinkRow } from '@/components/home/map'
import { addShoppingLinkAction } from '../actions'

export default async function ShoppingLinksPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('shopping_links')
    .select('id, household_id, label, url, category, notes')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('category', { ascending: true, nullsFirst: false })
    .returns<ShoppingLinkRow[]>()

  const links = rows ?? []

  // Group by category for display.
  const grouped = new Map<string, ShoppingLinkRow[]>()
  for (const link of links) {
    const key = link.category?.trim() || 'Uncategorised'
    const bucket = grouped.get(key)
    if (bucket) bucket.push(link)
    else grouped.set(key, [link])
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Shopping links</h1>
        <SectionNav active="/home/shopping" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Add a link</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleCreateForm action={addShoppingLinkAction} submitLabel="Add link">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="label"
                    className="block text-sm font-medium text-sage-800"
                  >
                    Label
                  </label>
                  <input
                    id="label"
                    name="label"
                    type="text"
                    required
                    maxLength={120}
                    placeholder="e.g. Robot vacuum"
                    className={homeInputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="category"
                    className="block text-sm font-medium text-sage-800"
                  >
                    Category <span className="text-sage-500">(optional)</span>
                  </label>
                  <input
                    id="category"
                    name="category"
                    type="text"
                    maxLength={60}
                    placeholder="e.g. Appliances"
                    className={homeInputClass}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="url" className="block text-sm font-medium text-sage-800">
                  URL
                </label>
                <input
                  id="url"
                  name="url"
                  type="url"
                  required
                  placeholder="https://…"
                  className={homeInputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="notes" className="block text-sm font-medium text-sage-800">
                  Notes <span className="text-sage-500">(optional)</span>
                </label>
                <input
                  id="notes"
                  name="notes"
                  type="text"
                  maxLength={200}
                  placeholder="Why this one, price, etc."
                  className={homeInputClass}
                />
              </div>
            </SimpleCreateForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Saved links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {links.length === 0 ? (
              <p className="text-sage-600">No links yet. Add your first one above.</p>
            ) : (
              [...grouped.entries()].map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <h2 className="text-sm font-semibold text-sage-700">{category}</h2>
                  <ul className="space-y-2">
                    {items.map((link) => (
                      <li
                        key={link.id}
                        className="rounded-md border border-sage-200 bg-cream-50 px-4 py-3"
                      >
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-terracotta-700 hover:underline"
                        >
                          {link.label}
                        </a>
                        {link.notes && (
                          <p className="text-sm text-sage-600">{link.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
