import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { loadTheme, serializeTokens } from '@platform/design-system/runtime'
import { defaultTokens } from '@platform/design-system'

// Skip entirely in CI (no DATABASE_URL). Run locally with `pnpm --filter gr8loci test`.
const dbAvailable = Boolean(process.env.DATABASE_URL)

describe.skipIf(!dbAvailable)('theme integration (requires DATABASE_URL)', () => {
  const prisma = new PrismaClient()
  const TEST_SLUG = 'f2-integration-test'

  beforeAll(async () => {
    await prisma.brandTheme.deleteMany({ where: { slug: TEST_SLUG } })
  })

  afterAll(async () => {
    await prisma.brandTheme.deleteMany({ where: { slug: TEST_SLUG } })
    await prisma.$disconnect()
  })

  it('loads defaults when the row is missing', async () => {
    const tokens = await loadTheme(prisma, TEST_SLUG)
    expect(tokens).toEqual(defaultTokens)
  })

  it('loads the DB row and serializes modified values into the CSS output', async () => {
    const blog = await prisma.blog.findFirstOrThrow({ where: { slug: 'gr8loci' } })
    const modified = structuredClone(defaultTokens) as typeof defaultTokens
    ;(modified.color.brand as { primary: string }).primary = '#ff0000'
    await prisma.brandTheme.create({ data: { blogId: blog.id, slug: TEST_SLUG, tokens: modified } })

    const tokens = await loadTheme(prisma, TEST_SLUG)
    expect(tokens.color.brand.primary).toBe('#ff0000')

    const css = serializeTokens(tokens)
    expect(css).toContain('--color-brand-primary: #ff0000;')
  })

  it('falls back to defaults when the stored JSON is malformed', async () => {
    // Corrupt the row via raw SQL (bypass Prisma's type-safety)
    await prisma.$executeRawUnsafe(
      `UPDATE brand_themes SET tokens = '{"wrong": true}'::jsonb WHERE slug = $1`,
      TEST_SLUG,
    )

    const tokens = await loadTheme(prisma, TEST_SLUG)
    expect(tokens).toEqual(defaultTokens)
  })
})
