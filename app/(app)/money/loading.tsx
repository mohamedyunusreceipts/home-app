import { Skeleton } from '@/components/ui/skeleton'
import { SkeletonStat, SkeletonCard } from '@/components/ui/page-skeleton'

// Mirrors the money page: title + sub-line, two stat cards, then card grid.
export default function Loading() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-9 w-2/5 bg-cream-300" />
          <Skeleton className="h-4 w-1/3" />
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonStat />
          <SkeletonStat />
        </div>

        <SkeletonCard lines={3} />

        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </main>
  )
}
