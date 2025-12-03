/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable image optimization for better performance
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },
  // Enable React strict mode for better development warnings
  reactStrictMode: true,
  // Temporarily ignore ESLint during builds (fix these issues gradually)
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
