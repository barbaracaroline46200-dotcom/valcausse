/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
  images: {
    // Permet de charger le logo depuis /public
    unoptimized: false,
    formats: ['image/webp'],
  },
}

module.exports = nextConfig
