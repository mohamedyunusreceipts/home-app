import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter, Amiri } from 'next/font/google'
import './globals.css'
import { SwRegister } from '@/components/shell/sw-register'
import { InstallPrompt } from '@/components/shell/install-prompt'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// Amiri — a classical Naskh typeface for rendering Qur'anic Arabic (ayah text).
const amiri = Amiri({
  subsets: ['arabic'],
  weight: ['400', '700'],
  variable: '--font-amiri',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Home',
  description: 'Shared home management for couples',
}

export const viewport: Viewport = {
  themeColor: '#C77B5C',
  // Required for env(safe-area-inset-*) to resolve on iOS (notch / home indicator),
  // which the floating pill nav, toast, and sheets rely on.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable} ${amiri.variable}`}>
      <body className="font-sans antialiased">
        <SwRegister />
        {children}
        <InstallPrompt />
      </body>
    </html>
  )
}
