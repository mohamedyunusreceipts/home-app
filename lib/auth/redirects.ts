import { redirect } from 'next/navigation'
import { getCurrentUser } from './current-user'
import { getCurrentHouseholdId } from './current-household'

/**
 * Returns the signed-in user, or redirects to `/sign-in` if anonymous.
 * For use at the top of any server component that requires auth.
 */
export async function requireUser() {
  const user = await getCurrentUser()
  if (!user) redirect('/sign-in')
  return user
}

/**
 * Returns the user + their household_id, or:
 * - redirects to `/sign-in` if anonymous
 * - redirects to `/setup` if signed in but no household
 */
export async function requireHousehold() {
  const user = await requireUser()
  const householdId = await getCurrentHouseholdId()
  if (!householdId) redirect('/setup')
  return { user, householdId }
}
