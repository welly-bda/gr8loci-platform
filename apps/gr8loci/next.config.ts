import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ['@platform/design-system', '@platform/auth'],
}

export default nextConfig
