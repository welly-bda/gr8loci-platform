import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadTheme } from '../src/runtime/loadTheme'
import { defaultTokens } from '../src/tokens'

type BrandThemeRow = { slug: string; tokens: unknown } | null
type PrismaLike = {
  brandTheme: { findFirst: (args: { where: { slug: string } }) => Promise<BrandThemeRow> }
}

function mockPrisma(handler: (slug: string) => Promise<BrandThemeRow> | BrandThemeRow): PrismaLike {
  return {
    brandTheme: {
      findFirst: vi.fn(async ({ where: { slug } }) => handler(slug)),
    },
  }
}

// loadTheme is wrapped in React.cache(); to isolate tests we bypass the cache.
// The cache memoizes by argument identity — passing distinct prisma mocks avoids collisions,
// but we still disable the wrapper for clarity.
beforeEach(() => {
  vi.restoreAllMocks()
})

describe('loadTheme', () => {
  it('returns the DB tokens when a valid row exists', async () => {
    const custom = structuredClone(defaultTokens) as typeof defaultTokens & { color: typeof defaultTokens.color }
    ;(custom.color.brand as { primary: string }).primary = '#ff0000'
    const prisma = mockPrisma(async () => ({ slug: 'gr8loci', tokens: custom }))

    const result = await loadTheme(prisma, 'gr8loci')
    expect(result.color.brand.primary).toBe('#ff0000')
  })

  it('falls back to defaults when the row is missing', async () => {
    const prisma = mockPrisma(async () => null)
    const result = await loadTheme(prisma, 'unknown-slug')
    expect(result).toEqual(defaultTokens)
  })

  it('falls back to defaults when the row tokens fail Zod validation', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const prisma = mockPrisma(async () => ({ slug: 'gr8loci', tokens: { not: 'valid' } }))

    const result = await loadTheme(prisma, 'gr8loci')
    expect(result).toEqual(defaultTokens)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[theme] invalid tokens for slug=gr8loci'),
      expect.anything(),
    )
  })

  it('falls back to defaults when Prisma throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const prisma: PrismaLike = {
      brandTheme: { findFirst: vi.fn(async () => { throw new Error('connect ECONNREFUSED') }) },
    }

    const result = await loadTheme(prisma, 'gr8loci')
    expect(result).toEqual(defaultTokens)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[theme] DB unreachable for slug=gr8loci'),
      expect.any(Error),
    )
  })
})
