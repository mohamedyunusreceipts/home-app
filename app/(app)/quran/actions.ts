'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { getSurah, type HifzStatus } from '@/lib/quran/surahs'

export type ActionResult = { error: string } | { success: true }

/**
 * Set (upsert) the ḥifẓ status of a surah for the calling user. user_id is taken
 * from the session — never trusted from the client. Validates the surah exists
 * in the dataset and that the status is one of the allowed values.
 */
export async function setHifzStatus(
  surahNumber: number,
  status: HifzStatus,
): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  if (!getSurah(surahNumber)) {
    return { error: 'Unknown sūrah.' }
  }
  if (status !== 'learning' && status !== 'memorised') {
    return { error: 'Unknown status.' }
  }

  const { error } = await supabase.from('quran_hifz').upsert(
    {
      user_id: user.id,
      surah_number: surahNumber,
      status,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,surah_number' },
  )

  if (error) {
    return { error: `Could not update status: ${error.message}` }
  }

  revalidatePath('/quran/hifz')
  revalidatePath(`/quran/read/${surahNumber}`)
  revalidatePath('/quran/read')
  revalidatePath('/quran')
  return { success: true }
}

/**
 * Record that the user revised a surah today. Upserts the ḥifẓ row, setting
 * last_revised_on to today's date (UTC date component).
 */
export async function markRevisedToday(surahNumber: number): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  if (!getSurah(surahNumber)) {
    return { error: 'Unknown sūrah.' }
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  const { error } = await supabase.from('quran_hifz').upsert(
    {
      user_id: user.id,
      surah_number: surahNumber,
      last_revised_on: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,surah_number' },
  )

  if (error) {
    return { error: `Could not record revision: ${error.message}` }
  }

  revalidatePath('/quran/hifz')
  return { success: true }
}

/**
 * Mark a lesson complete for the calling user (used by later ladder levels).
 * Appends the lesson id to completed_lessons if not already present.
 */
export async function completeLesson(lessonId: string): Promise<ActionResult> {
  const user = await requireUser()
  const supabase = await createClient()

  const trimmed = lessonId.trim()
  if (!trimmed) {
    return { error: 'Missing lesson id.' }
  }

  // Read the existing row so we can merge the lesson id idempotently.
  const { data: existing } = await supabase
    .from('quran_progress')
    .select('completed_lessons')
    .eq('user_id', user.id)
    .maybeSingle<{ completed_lessons: string[] }>()

  const current = existing?.completed_lessons ?? []
  const completed = current.includes(trimmed) ? current : [...current, trimmed]

  const { error } = await supabase.from('quran_progress').upsert(
    {
      user_id: user.id,
      completed_lessons: completed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    return { error: `Could not save progress: ${error.message}` }
  }

  revalidatePath('/quran')
  return { success: true }
}
