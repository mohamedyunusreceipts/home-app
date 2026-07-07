import { createClient } from '@/lib/supabase/server'

/**
 * Return the set of completed lesson ids for a user, read from
 * quran_progress.completed_lessons. Safe when the row is absent.
 */
export async function getCompletedLessons(userId: string): Promise<Set<string>> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('quran_progress')
    .select('completed_lessons')
    .eq('user_id', userId)
    .maybeSingle<{ completed_lessons: string[] | null }>()
  return new Set(data?.completed_lessons ?? [])
}
