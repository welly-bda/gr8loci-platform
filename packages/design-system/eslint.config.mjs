import sharedConfig from '@platform/config-eslint'

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'tokens.css', 'scripts/**'],
  },
  ...sharedConfig,
]
