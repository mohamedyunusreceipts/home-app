import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { redirect } from 'next/navigation'
import { requireUser } from '@/lib/auth/redirects'
import { getCurrentHouseholdId } from '@/lib/auth/current-household'
import { CreateHouseholdForm } from './create-form'

export default async function CreateHouseholdPage() {
  await requireUser()
  const householdId = await getCurrentHouseholdId()
  if (householdId) redirect('/dashboard')

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="font-serif text-terracotta-700 text-2xl">
            Create your household
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sage-700">
            You can rename it later from settings.
          </p>
          <CreateHouseholdForm />
        </CardContent>
      </Card>
    </main>
  )
}
