import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Skeleton — a warm, pulsing placeholder block for loading states.
 *
 * Uses Tailwind's `animate-pulse` over a muted sage/cream wash so the loading
 * shimmer stays on-theme rather than the usual cold grey. Pass `className` to
 * size it (height, width, rounding) to match the real content it stands in for.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-lg bg-sage-100/70', className)}
      {...props}
    />
  )
}

export { Skeleton }
