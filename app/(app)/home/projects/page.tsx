import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireHousehold } from '@/lib/auth/redirects'
import { createClient } from '@/lib/supabase/server'
import { SectionNav } from '@/components/home/section-nav'
import { SimpleCreateForm, homeInputClass } from '@/components/home/simple-create-form'
import { formatZar, formatProjectStatus } from '@/components/home/format'
import type { HomeProjectRow } from '@/components/home/map'
import { addHomeProjectAction } from '../actions'

export default async function HomeProjectsPage() {
  const { householdId } = await requireHousehold()
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('home_projects')
    .select('id, household_id, name, status, budget, notes_md, photo_drive_file_ids')
    .eq('household_id', householdId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .returns<HomeProjectRow[]>()

  const projects = rows ?? []

  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="font-serif text-3xl text-terracotta-700">Home projects</h1>
        <SectionNav active="/home/projects" />

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Add a project</CardTitle>
          </CardHeader>
          <CardContent>
            <SimpleCreateForm action={addHomeProjectAction} submitLabel="Add project">
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-medium text-sage-800">
                  Project name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  maxLength={120}
                  placeholder="e.g. Repaint the spare room"
                  className={homeInputClass}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="status"
                    className="block text-sm font-medium text-sage-800"
                  >
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    defaultValue="idea"
                    className={homeInputClass}
                  >
                    <option value="idea">Idea</option>
                    <option value="planning">Planning</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="budget"
                    className="block text-sm font-medium text-sage-800"
                  >
                    Budget (R) <span className="text-sage-500">(optional)</span>
                  </label>
                  <input
                    id="budget"
                    name="budget"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 8000"
                    className={homeInputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="notes_md"
                  className="block text-sm font-medium text-sage-800"
                >
                  Notes <span className="text-sage-500">(optional)</span>
                </label>
                <textarea
                  id="notes_md"
                  name="notes_md"
                  rows={3}
                  placeholder="Plans, materials, who is doing what…"
                  className={homeInputClass}
                />
              </div>
            </SimpleCreateForm>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif text-terracotta-700">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sage-600">No projects yet. Add your first one above.</p>
            ) : (
              <ul className="space-y-3">
                {projects.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-md border border-sage-200 bg-cream-50 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-sage-900">{p.name}</p>
                      <span className="rounded-full bg-sage-100 px-2.5 py-0.5 text-xs font-medium text-sage-700">
                        {formatProjectStatus(p.status)}
                      </span>
                    </div>
                    <p className="text-sm text-sage-600">
                      {p.budget != null ? `Budget ${formatZar(p.budget)}` : 'No budget set'}
                      {p.photo_drive_file_ids.length > 0
                        ? ` · ${p.photo_drive_file_ids.length} photo(s)`
                        : ''}
                    </p>
                    {p.notes_md && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-sage-700">
                        {p.notes_md}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-sage-500">
              Photo uploads land once Google Drive is connected.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
