import sharedConfig from '@platform/config-eslint'

export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'public/**',
      'prisma/migrations/**',
      'next-env.d.ts',
    ],
  },
  ...sharedConfig,
  {
    files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
    ignores: [
      'lib/db/**',
      'lib/tenant-context.ts',
      'lib/active-blog.ts',
      'lib/auth-actions.ts',
      'app/(admin)/**',
      'app/layout.tsx',
    ],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/lib/db/base', '@/lib/db/base', '**/lib/db/platform', '@/lib/db/platform'],
          message: 'No unscoped Prisma in app code. Use forBlog(blogId)/getTenantDb() for tenant data, or getCurrentBlog() for the resolved blog. forPlatform() is for platform/admin code only.',
        }],
      }],
    },
  },
]
