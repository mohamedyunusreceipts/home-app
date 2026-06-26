import { formatZar, formatDate } from './format'
import type { TransactionRow } from './map'

export type TransactionListItem = TransactionRow & {
  /** Resolved display name of the contributor, or null for a joint contribution. */
  contributorName: string | null
}

/**
 * History of access-facility transactions. Deposits read as sage/positive,
 * withdrawals as terracotta — mirroring the warm theme used elsewhere.
 */
export function TransactionsList({ items }: { items: TransactionListItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sage-600">
        Nothing logged yet. Add your first deposit or withdrawal above to start tracking
        what you each put in.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-sage-200 text-sage-600">
            <th className="py-2 pr-4 font-medium">Date</th>
            <th className="py-2 pr-4 font-medium">Type</th>
            <th className="py-2 pr-4 font-medium">Amount</th>
            <th className="py-2 pr-4 font-medium">Contributor</th>
            <th className="py-2 pr-4 font-medium">Note</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const isDeposit = t.kind === 'extra_deposit'
            return (
              <tr
                key={t.id}
                className="border-b border-sage-100 text-sage-800 last:border-0"
              >
                <td className="py-2 pr-4">{formatDate(t.occurred_on)}</td>
                <td className="py-2 pr-4">
                  <span
                    className={
                      isDeposit
                        ? 'inline-flex rounded-full bg-sage-100 px-2 py-0.5 text-xs font-medium text-sage-700'
                        : 'inline-flex rounded-full bg-terracotta-100 px-2 py-0.5 text-xs font-medium text-terracotta-700'
                    }
                  >
                    {isDeposit ? 'Deposit' : 'Withdrawal'}
                  </span>
                </td>
                <td
                  className={
                    isDeposit
                      ? 'py-2 pr-4 font-medium text-sage-700'
                      : 'py-2 pr-4 font-medium text-terracotta-700'
                  }
                >
                  {isDeposit ? '+' : '−'}
                  {formatZar(t.amount)}
                </td>
                <td className="py-2 pr-4">{t.contributorName ?? 'Joint'}</td>
                <td className="py-2 pr-4 text-sage-600">{t.note ?? '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
