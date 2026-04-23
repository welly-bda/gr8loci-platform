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
]
