import { PageSkeleton } from '@/components/ui/page-skeleton'

export default function Loading() {
  return <PageSkeleton title="35%" cards={6} columns={3} maxWidth="max-w-4xl" />
}
