import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    exclude: ['node_modules/**', 'tests/e2e/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  esbuild: {
    jsx: 'automatic',
  },
})
