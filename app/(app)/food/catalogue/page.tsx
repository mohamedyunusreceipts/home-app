import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { CatalogueSection, type CatalogueItem } from './catalogue-client'

type CatalogueRow = { id: string; kind: 'food' | 'dessert'; name: string }

export default async function CataloguePage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('catalogue_items')
    .select('id, kind, name')
    .eq('household_id', householdId)
    .order('name', { ascending: true })
    .returns<CatalogueRow[]>()

  const meals: CatalogueItem[] = []
  const desserts: CatalogueItem[] = []
  for (const row of rows ?? []) {
    if (row.kind === 'food') meals.push({ id: row.id, name: row.name })
    else desserts.push({ id: row.id, name: row.name })
  }

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="space-y-1">
          <h1 className="font-serif text-3xl text-terracotta-700">Meals &amp; desserts catalogue</h1>
          <p className="text-sage-600">The dishes and treats you love — add what you like, remove what you don&apos;t.</p>
        </header>

        <Link href="/food" className="inline-block text-sm text-sage-600 hover:text-terracotta-600">
          &larr; Back to Food
        </Link>

        <Card>
          <CardContent className="grid gap-8 py-6 md:grid-cols-2">
            <CatalogueSection
              kind="food"
              title="Meals"
              placeholder="Add a meal"
              items={meals}
            />
            <CatalogueSection
              kind="dessert"
              title="Desserts"
              placeholder="Add a dessert"
              items={desserts}
            />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
