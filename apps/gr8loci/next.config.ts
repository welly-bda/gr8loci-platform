import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ['@platform/design-system', '@platform/auth'],
}

export default nextConfig
