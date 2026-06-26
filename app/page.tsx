import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'
import { getCurrentHouseholdId } from '@/lib/auth/current-household'

export default async function HomePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')

  const householdId = await getCurrentHouseholdId()
  if (!householdId) redirect('/setup')

  redirect('/dashboard')
}
