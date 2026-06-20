import { loadTheme, type BrandThemePrismaClient } from './loadTheme'
import { serializeTokens } from './serializeTokens'

interface ThemeStyleProps {
  prisma: BrandThemePrismaClient
  slug: string
}

/**
 * Server Component. Loads the theme for `slug`, serializes to CSS variables,
 * and emits them inline as a <style> block in the rendered HTML.
 *
 * Place this inside <head> in the root layout so the CSS variables are
 * available to every style rule on the page (including design-system primitives
 * which consume them via CSS Modules).
 *
 * The inline-style is safe because `serializeTokens` only emits strings/numbers
 * that have already been Zod-validated against TokensSchema by `loadTheme`.
 */
export async function ThemeStyle({ prisma, slug }: ThemeStyleProps) {
  const tokens = await loadTheme(prisma, slug)
  const css = serializeTokens(tokens)
  // Safe: css comes from serializeTokens over Zod-validated values, no user input.
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
