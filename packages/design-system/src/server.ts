// Server-only entry for utilities that need server runtime.
// Re-exports runtime theme helpers so consumers can import from either
// `@platform/design-system/server` or `@platform/design-system/runtime`.
export { loadTheme, serializeTokens, ThemeStyle } from './runtime'
export type { BrandThemePrismaClient } from './runtime'
