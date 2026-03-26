import { NextResponse } from 'next/server'

export async function GET() {
  const isProduction = process.env.VERCEL_ENV === 'production'

  const manifest = {
    name: isProduction ? 'YAPLUKA' : 'YAPLUKA TEST',
    short_name: isProduction ? 'YAPLUKA' : 'YPK TEST',
    description: 'Transformez vos formations en actions concrètes',
    start_url: '/',
    display: 'standalone',
    background_color: isProduction ? '#1e1b4b' : '#2e1065',
    theme_color: isProduction ? '#4338ca' : '#7c3aed',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=60, s-maxage=3600',
    },
  })
}
