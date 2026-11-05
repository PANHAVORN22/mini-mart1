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
  typescript: {
    ignoreBuildErrors: true,
  },
  async headers() {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: https://*.supabase.co https://*.amazonaws.com",
      "connect-src 'self' https://*.supabase.co https://*.payway.com.kh https://checkout.payway.com.kh",
      "frame-src https://*.payway.com.kh https://checkout.payway.com.kh",
      "form-action 'self' https://*.payway.com.kh https://checkout.payway.com.kh",
      "font-src 'self' data:",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
}

export default nextConfig
