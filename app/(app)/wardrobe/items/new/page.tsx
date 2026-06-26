import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { requireHousehold } from '@/lib/auth/redirects'
import { ItemForm, type ItemDefaults } from '@/components/wardrobe/item-form'

const emptyDefaults: ItemDefaults = {
  id: '',
  category: 'top',
  color: '',
  brand: '',
  size: '',
  notes: '',
  season: '',
  occasion: '',
  photoDriveFileId: '',
  visibleToPartner: true,
}

export default async function NewItemPage() {
  const { user } = await requireHousehold()

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-3xl text-terracotta-700">Add an item</h1>
          <Link href="/wardrobe">
            <Button variant="outline">Back</Button>
          </Link>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Item details</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemForm defaults={emptyDefaults} ownerUserId={user.id} />
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
