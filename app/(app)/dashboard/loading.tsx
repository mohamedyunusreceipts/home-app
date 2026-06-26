import { PageSkeleton } from '@/components/ui/page-skeleton'

// Mirrors the dashboard: "Today" heading + 2-column grid of summary cards.
export default function Loading() {
  return (
    <PageSkeleton
      title="30%"
      subtitle={false}
      cards={6}
      columns={2}
      maxWidth="max-w-4xl"
      padding="px-4 py-6 md:px-8"
    />
  )
}
