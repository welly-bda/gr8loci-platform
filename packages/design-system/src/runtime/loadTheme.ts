import { cache } from 'react'
import { defaultTokens } from '../tokens'
import { TokensSchema } from '../tokens/schema'
import type { Tokens } from '../tokens'

/**
 * Structural interface describing the single Prisma query we need.
 * Keeps @platform/design-system free of a Prisma import; consumers pass their own client.
 */
export interface BrandThemePrismaClient {
  brandTheme: {
    findFirst(args: { where: { slug: string }; orderBy?: { createdAt: 'asc' | 'desc' } }): Promise<{ tokens: unknown } | null>
  }
}

/**
 * Load the theme for `slug`, falling back to compile-time defaults on any failure.
 *
 * Failure modes (never throw):
 *  - row missing          → defaultTokens (silent; expected during bootstrap)
 *  - Zod validation fails → defaultTokens (logged to stderr)
 *  - Prisma query throws  → defaultTokens (logged to stderr)
 *
 * Wrapped in React.cache() so one render pass = one DB hit, even with multiple callers.
 * Pass the same Prisma instance on every call for cache hits — different instances
 * are distinct cache keys and disable deduplication.
 */
export const loadTheme = cache(
  async (prisma: BrandThemePrismaClient, slug: string): Promise<Tokens> => {
    let row: { tokens: unknown } | null
    try {
      // P1 resolves the theme by slug (spec §2.1). BrandTheme.slug is NOT DB-unique (only blogId_slug is),
      // so once P2 adds per-tenant themes this must resolve by blogId to avoid cross-tenant theme bleed.
      // orderBy keeps the P1 lookup deterministic until then. See handoff "Open items".
      row = await prisma.brandTheme.findFirst({ where: { slug }, orderBy: { createdAt: 'asc' } })
    } catch (err) {
      console.error(`[theme] DB unreachable for slug=${slug}; falling back to defaults`, err)
      return defaultTokens
    }

    if (!row) return defaultTokens

    const parsed = TokensSchema.safeParse(row.tokens)
    if (!parsed.success) {
      console.error(`[theme] invalid tokens for slug=${slug}; falling back to defaults`, parsed.error.issues)
      return defaultTokens
    }
    return parsed.data as Tokens
  },
)
