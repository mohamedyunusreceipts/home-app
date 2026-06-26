import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SectionNav } from '@/components/home/section-nav'
import { SimpleCreateForm, homeInputClass } from '@/components/home/simple-create-form'
import { SharedListCard } from '@/components/home/shared-list-card'
import type { SharedListRow } from '@/components/home/map'
import { addSharedListAction, toggleSharedListItemAction } from '../actions'

export default async function SharedListsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('shared_lists')
    .select('id, household_id, name, items')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<SharedListRow[]>()

  const lists = rows ?? []

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Shared lists</h1>
        <SectionNav active="/home/lists" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">
              Create a list
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleCreateForm action={addSharedListAction} submitLabel="Create list">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-sage-800">
                  List name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  placeholder="e.g. Braai weekend"
                  className={homeInputClass}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="items" className="block text-sm font-medium text-sage-800">
                  Items <span className="text-sage-500">(one per line, optional)</span>
                </label>
                <textarea
                  id="items"
                  name="items"
                  rows={4}
                  placeholder={'Charcoal\nFirelighters\nSalads'}
                  className={homeInputClass}
                />
              </div>
            </SimpleCreateForm>
          </CardContent>
        </Card>

        {lists.length === 0 ? (
          <Card>
            <CardContent>
              <p className="py-2 text-sage-600">
                No lists yet. Create your first one above.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {lists.map((list) => (
              <SharedListCard
                key={list.id}
                id={list.id}
                name={list.name}
                items={list.items ?? []}
                toggleAction={toggleSharedListItemAction}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
