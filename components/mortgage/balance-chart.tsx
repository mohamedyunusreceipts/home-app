import { formatMonth, formatZarRounded } from './format'

export type BalancePoint = {
  /** ISO statement month. */
  month: string
  /** Actual closing balance from the statement. */
  actual: number
  /** Shadow / projected balance per the original schedule. */
  shadow: number
}

type BalanceChartProps = {
  points: BalancePoint[]
}

/**
 * A dependency-free inline SVG line chart comparing actual balance against the
 * projected shadow schedule. Falls back to a textual note when there's too
 * little data to plot meaningfully.
 */
export function BalanceChart({ points }: BalanceChartProps) {
  if (points.length < 2) {
    return (
      <p className="text-sm text-sage-600">
        Add a couple more statements to see your balance plotted against the
        original schedule.
      </p>
    )
  }

  const width = 640
  const height = 200
  const padX = 8
  const padY = 12

  const values = points.flatMap((p) => [p.actual, p.shadow])
  const max = Math.max(...values)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const x = (i: number) =>
    padX + (i / (points.length - 1)) * (width - padX * 2)
  const y = (v: number) =>
    padY + (1 - (v - min) / range) * (height - padY * 2)

  const toPath = (key: 'actual' | 'shadow') =>
    points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`)
      .join(' ')

  const first = points[0]!
  const last = points[points.length - 1]!

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Actual balance versus projected schedule over time"
        preserveAspectRatio="none"
      >
        {/* Shadow / projected schedule */}
        <path
          d={toPath('shadow')}
          fill="none"
          stroke="var(--color-sage-300)"
          strokeWidth={2}
          strokeDasharray="5 4"
        />
        {/* Actual balance */}
        <path
          d={toPath('actual')}
          fill="none"
          stroke="var(--color-terracotta-500)"
          strokeWidth={2.5}
        />
      </svg>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-sage-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-terracotta-500" aria-hidden />
          Actual balance
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 border-t-2 border-dashed border-sage-300"
            aria-hidden
          />
          Original schedule
        </span>
      </div>

      <div className="flex justify-between gap-3 text-xs text-sage-600">
        <span className="min-w-0 break-words tabular-nums">
          {formatMonth(first.month)} · {formatZarRounded(first.actual)}
        </span>
        <span className="min-w-0 break-words text-right tabular-nums">
          {formatMonth(last.month)} · {formatZarRounded(last.actual)}
        </span>
      </div>
    </div>
  )
}
