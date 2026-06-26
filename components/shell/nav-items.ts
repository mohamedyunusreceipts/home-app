// Shared nav destination list — spec §6. Icons are inline SVG path data (no icon dep).
export type NavItem = {
  href: string
  label: string
  // SVG path `d` attribute, drawn in a 24x24 viewBox with currentColor stroke.
  icon: string
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: 'M3 11.5 12 4l9 7.5M5 10v10h14V10' },
  { href: '/money', label: 'Money', icon: 'M12 3v18M8 7h6a3 3 0 0 1 0 6H8m0 4h8' },
  { href: '/food', label: 'Food', icon: 'M5 3v8a3 3 0 0 0 6 0V3M8 3v18M16 3c-1.5 0-3 1.5-3 5s1.5 5 3 5v8' },
  { href: '/home', label: 'House', icon: 'M3 11.5 12 4l9 7.5M5 10v10h14V10M9 20v-6h6v6' },
  { href: '/calendar', label: 'Calendar', icon: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4' },
  { href: '/travel', label: 'Travel', icon: 'M2 16l9-3V5a1.5 1.5 0 0 1 3 0v6l7 2.5v2l-7-1.5v4l2 1.5v1l-4-1-4 1v-1l2-1.5v-4z' },
  { href: '/wardrobe', label: 'Wardrobe', icon: 'M10 4a2 2 0 1 0 4 0M12 6l-7 13h14zM12 6v3' },
  { href: '/vault', label: 'Vault', icon: 'M5 4h14v16H5zM9 4v16M13 11h3' },
]
