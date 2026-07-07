'use client'

import { useRouter } from 'next/navigation'
import { Sheet } from './sheet'
import { useShell } from './shell-context'

type MoreItem = {
  label: string
  href: string
  icon: string
  chipBg: string
  chipColor: string
}

// 6 overflow-module tiles. Bond = terracotta chip; rest sage. Tap navigates +
// closes the sheet. README "More sheet".
const MORE_ITEMS: MoreItem[] = [
  {
    label: 'Calendar',
    href: '/calendar',
    icon: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'Travel',
    href: '/travel',
    icon: 'M2 16l9-3V5a1.5 1.5 0 0 1 3 0v6l7 2.5v2l-7-1.5v4l2 1.5v1l-4-1-4 1v-1l2-1.5v-4z',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'Wardrobe',
    href: '/wardrobe',
    icon: 'M10 4a2 2 0 1 0 4 0M12 6l-7 13h14zM12 6v3',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'Vault',
    href: '/vault',
    icon: 'M5 4h14v16H5zM9 4v16M13 11h3',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'Bond',
    href: '/mortgage',
    icon: 'M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6',
    chipBg: '#FBF2EE',
    chipColor: '#C77B5C',
  },
  {
    label: 'Salaah',
    href: '/salaah',
    // Crescent moon + a small clock hand — a simple prayer-times glyph.
    icon: 'M20 14.5A7.5 7.5 0 1 1 9.5 4a6 6 0 1 0 10.5 10.5zM12 12.5l1.5 1',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: "Qur'an",
    href: '/quran',
    // An open book with a small crescent above it — a Qur'an learning glyph.
    icon: 'M12 7c-2-1.3-4.5-1.3-7 0v11c2.5-1.3 5-1.3 7 0m0-11c2-1.3 4.5-1.3 7 0v11c-2.5-1.3-5-1.3-7 0m0-11V18M9 4.2A2.6 2.6 0 1 0 12 5',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 12h2m14 0h2M12 3v2m0 14v2',
    chipBg: '#F1F5F1',
    chipColor: '#5F8160',
  },
]

export function MoreSheet() {
  const router = useRouter()
  const { closeSheet } = useShell()

  function handleTile(item: MoreItem) {
    closeSheet()
    router.push(item.href)
  }

  return (
    <Sheet title="More" subtitle="Everything else, one tap away" onClose={closeSheet}>
      <div className="grid grid-cols-2 gap-[11px]">
        {MORE_ITEMS.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => handleTile(item)}
            className="flex items-center gap-3 rounded-2xl border border-cream-300 bg-cream-50 p-[15px] text-left"
          >
            <span
              className="flex size-[40px] shrink-0 items-center justify-center rounded-xl"
              style={{ background: item.chipBg }}
            >
              <svg
                width="21"
                height="21"
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
    </Sheet>
  )
}
