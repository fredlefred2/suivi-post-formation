import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Suivi post-formation',
  description: 'Suivez votre progression après votre formation en management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
