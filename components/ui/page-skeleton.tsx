import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shared loading-state scaffolds built from the `Skeleton` primitive. These
 * mirror the real module pages — a serif title, an optional sub-line, then a
 * grid of cards — so navigation shows the page's shape rather than a blank
 * flash. Used by the route-level `loading.tsx` files across the (app) group.
 */

/** A single placeholder card matching the rounded, ring-bordered `Card`. */
function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl bg-card py-4 ring-1 ring-foreground/10">
      <div className="px-4">
        <Skeleton className="h-5 w-2/5 bg-cream-300" />
      </div>
      <div className="space-y-2 px-4">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={i === lines - 1 ? 'h-4 w-3/5' : 'h-4 w-full'} />
        ))}
      </div>
    </div>
  )
}

/** A compact stat-style placeholder (big number over a small label). */
function SkeletonStat() {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-card py-4 ring-1 ring-foreground/10">
      <div className="space-y-2 px-4">
        <Skeleton className="h-3 w-1/3 bg-cream-300" />
        <Skeleton className="h-7 w-2/3" />
      </div>
    </div>
  )
}

/**
 * Page-level skeleton: title + optional subtitle, then a responsive grid of
 * card placeholders. `padding` matches the two layouts in use across modules.
 */
function PageSkeleton({
  title = '40%',
  subtitle = true,
  cards = 4,
  columns = 2,
  variant = 'card',
  maxWidth = 'max-w-3xl',
  padding = 'p-8',
}: {
  title?: string
  subtitle?: boolean
  cards?: number
  columns?: 1 | 2 | 3
  variant?: 'card' | 'stat'
  maxWidth?: string
  padding?: string
}) {
  const gridCols =
    columns === 1 ? 'grid-cols-1' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <main className={`min-h-screen ${padding}`}>
      <div className={`mx-auto ${maxWidth} space-y-6`}>
        <header className="space-y-2">
          <Skeleton className="h-9 bg-cream-300" style={{ width: title }} />
          {subtitle ? <Skeleton className="h-4 w-1/4" /> : null}
        </header>

        <div className={`grid gap-4 ${gridCols}`}>
          {Array.from({ length: cards }).map((_, i) =>
            variant === 'stat' ? <SkeletonStat key={i} /> : <SkeletonCard key={i} />,
          )}
        </div>
      </div>
    </main>
  )
}

export { PageSkeleton, SkeletonCard, SkeletonStat }
