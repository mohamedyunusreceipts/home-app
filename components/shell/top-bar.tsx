import Link from 'next/link'
import { signOutAction } from '@/app/(app)/settings/actions'
import { Button } from '@/components/ui/button'
import { AvatarMenu } from './avatar-menu'

/**
 * Top bar — household name (left), notification bell (placeholder) and
 * avatar/menu (Settings, Sign out) on the right. Spec §6.
 */
export function TopBar({ householdName }: { householdName: string }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-cream-300 bg-cream-100/95 px-4 backdrop-blur md:pl-56">
      <Link href="/dashboard" className="font-serif text-lg text-terracotta-700">
        {householdName}
      </Link>

      <div className="flex items-center gap-1">
        {/* Notification bell — placeholder, non-functional (no count yet). */}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notifications"
          title="Notifications"
          className="text-sage-700"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-5"
            aria-hidden="true"
          >
            <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />
          </svg>
        </Button>

        <AvatarMenu signOutAction={signOutAction} />
      </div>
    </header>
  )
}
