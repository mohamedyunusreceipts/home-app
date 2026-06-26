import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter } from 'next/font/google'
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

export const metadata: Metadata = {
  title: 'Home',
  description: 'Shared home management for couples',
}

export const viewport: Viewport = {
  themeColor: '#C77B5C',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">
        <SwRegister />
        {children}
        <InstallPrompt />
      </body>
    </html>
  )
}
