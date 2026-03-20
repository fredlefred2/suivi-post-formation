/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'suivi-post-formation.vercel.app', 'suivi-post-formation-rfz3rx1sc-frederics-projects-c474b1b8.vercel.app'],
    },
  },
  async headers() {
    return [
      {
        // Pages HTML et API : pas de cache (données personnalisées)
        source: '/((?!_next/static|_next/image|icon-|manifest|yapluka).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, must-revalidate' },
        ],
      },
      {
        // Service Worker : jamais caché (doit toujours se mettre à jour)
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
