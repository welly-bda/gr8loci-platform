import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ['@platform/design-system', '@platform/auth'],
  experimental: {
    // @ts-expect-error — nodeMiddleware is supported in Next.js 15.5 but not yet typed in ExperimentalConfig
    nodeMiddleware: true,
  },
}

export default nextConfig
