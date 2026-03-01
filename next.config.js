/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'suivi-post-formation-rfz3rx1sc-frederics-projects-c474b1b8.vercel.app'],
    },
  },
}

module.exports = nextConfig
