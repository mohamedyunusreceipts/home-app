import { Skeleton } from '@/components/ui/skeleton'
import { SkeletonStat } from '@/components/ui/page-skeleton'

// Mirrors the bond page: headline stat, a 2x2 stat grid, then a chart card.
export default function Loading() {
  return (
    <main className="min-h-screen p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <Skeleton className="h-9 w-2/5 bg-cream-300" />
          <Skeleton className="h-4 w-1/3" />
        </header>

        <SkeletonStat />

        <div className="grid gap-4 sm:grid-cols-2">
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
          <SkeletonStat />
        </div>

        <div className="flex flex-col gap-4 rounded-xl bg-card py-4 ring-1 ring-foreground/10">
          <div className="px-4">
            <Skeleton className="h-5 w-1/2 bg-cream-300" />
          </div>
          <div className="px-4">
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    </main>
  )
}
