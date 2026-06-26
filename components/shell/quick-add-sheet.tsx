'use client'

import { useRouter } from 'next/navigation'
import { Sheet } from './sheet'
import { useShell } from './shell-context'

type QuickItem = {
  label: string
  href: string
  msg: string
  icon: string
  chipBg: string
  chipColor: string
}

// 6 quick-add tiles. First (Log expense) = terracotta chip; rest sage. Each tap
// closes the sheet, toasts the confirm message, and navigates. README quick-add.
const QUICK_ITEMS: QuickItem[] = [
  {
    label: 'Log expense',
    href: '/money/expenses',
    msg: 'Expense logged',
    icon: 'M12 3v18M8 7h6a3 3 0 0 1 0 6H8m0 4h8',
    chipBg: '#FBF2EE',
    chipColor: '#C77B5C',
  },
  {
    label: 'Add to meals',
    href: '/food',
    msg: 'Added to meal plan',
    icon: 'M5 3v8a3 3 0 0 0 6 0V3M8 3v18M16 3c-1.5 0-3 1.5-3 5s1.5 5 3 5v8',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'New event',
    href: '/calendar',
    msg: 'Event added',
    icon: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'New chore',
    href: '/home',
    msg: 'Chore created',
    icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'Grocery item',
    href: '/food/grocery',
    msg: 'Added to grocery list',
    icon: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'Vault doc',
    href: '/vault',
    msg: 'Saved to vault',
    icon: 'M5 4h14v16H5zM9 4v16M13 11h3',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
]

export function QuickAddSheet() {
  const router = useRouter()
  const { closeSheet, showToast } = useShell()

  function handleTile(item: QuickItem) {
    closeSheet()
    showToast(item.msg)
    router.push(item.href)
  }

  return (
    <Sheet title="Quick add" onClose={closeSheet}>
      <div className="grid grid-cols-2 gap-[11px]">
        {QUICK_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleTile(item)}
            className="flex flex-col gap-3 rounded-[18px] border border-cream-300 bg-cream-50 p-4 text-left"
          >
            <span
              className="flex size-[44px] items-center justify-center rounded-[13px]"
              style={{ background: item.chipBg }}
            >
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke={item.chipColor}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d={item.icon} />
              </svg>
            </span>
            <span className="text-[14px] font-semibold text-terracotta-900">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Voice entry — visual only. */}
      <div className="mt-4 flex w-full items-center gap-[11px] rounded-2xl bg-sage-700 px-4 py-[14px]">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#DCE7DC"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        <span className="text-[13.5px] font-medium text-sage-50">
          &ldquo;Add R450 groceries, split evenly&rdquo;
        </span>
      </div>
    </Sheet>
  )
}
