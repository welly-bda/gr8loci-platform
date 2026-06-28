import type { Config } from 'tailwindcss'

export default {
  content: ['./app/(admin)/**/*.{ts,tsx}', './components/ui/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
