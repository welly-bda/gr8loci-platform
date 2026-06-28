import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  typedRoutes: true,
  transpilePackages: ['@platform/design-system', '@platform/auth'],
  // Node.js middleware runtime is enabled via `export const runtime = 'nodejs'`
  // in middleware.ts. The experimental.nodeMiddleware flag was removed in
  // Next.js 15.5 (it now warns as an unrecognized config key).
}

export default nextConfig
