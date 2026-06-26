import { redirect } from 'next/navigation'
import { getCurrentUser } from './current-user'
import { getCurrentHouseholdId } from './current-household'

/**
 * Returns `path` only if it's a safe same-origin relative path, else `fallback`.
 * Rejects absolute URLs and protocol-relative URLs (`//evil.com`) to prevent
 * open-redirect attacks via a user-supplied `next` query param.
 */
export function safeRelativePath(
  path: string | undefined | null,
  fallback = '/',
): string {
  return path && path.startsWith('/') && !path.startsWith('//') ? path : fallback
}

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
