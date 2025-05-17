/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disables ESLint during production builds
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Disables TypeScript during production builds
    ignoreBuildErrors: true,
  },
  output: 'standalone',
}

module.exports = nextConfig 