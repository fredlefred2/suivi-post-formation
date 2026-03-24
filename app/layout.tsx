import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ToastProvider } from '@/app/components/Toast'

import BugReportButton from '@/app/components/BugReportButton'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'YAPLUKA',
  description: 'Transformez vos formations en actions concrètes',
  manifest: '/api/manifest',
  icons: [
    { rel: 'icon', url: '/icon-192.png', sizes: '192x192' },
    { rel: 'apple-touch-icon', url: '/icon-192.png' },
  ],
}

export const viewport: Viewport = {
  themeColor: '#4338ca',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={inter.variable}>
      <body className={inter.className}>
        <ToastProvider>
          {children}
          <BugReportButton />
        </ToastProvider>
      </body>
    </html>
  )
}
