import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SLUG = 'gr8loci'

test.describe('F2 theme engine — runtime edits reflect on reload', () => {
  test.beforeAll(async () => {
    // Ensure the gr8loci row exists with defaults before we mutate.
    const existing = await prisma.brandTheme.findFirst({ where: { slug: SLUG } })
    if (!existing) {
      throw new Error(
        `No BrandTheme row for slug=${SLUG}. Run prisma:seed before test:e2e.`,
      )
    }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('changing color.brand.primary in DB updates --color-brand-primary after reload', async ({ page }) => {
    // Snapshot original tokens so we can restore at end.
    const blog = await prisma.blog.findFirstOrThrow({ where: { slug: SLUG } })
    const original = await prisma.brandTheme.findUniqueOrThrow({
      where: { blogId_slug: { blogId: blog.id, slug: SLUG } },
    })

    try {
      await page.goto('/')
      const before = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-brand-primary').trim(),
      )
      expect(before).toBe('#163759')

      // Mutate the DB row's brand primary.
      const tokens = structuredClone(original.tokens) as { color: { brand: { primary: string } } }
      tokens.color.brand.primary = '#ff0000'
      await prisma.brandTheme.update({
        where: { blogId_slug: { blogId: blog.id, slug: SLUG } },
        data: { tokens: tokens as unknown as object },
      })

      await page.reload()
      const after = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-brand-primary').trim(),
      )
      expect(after).toBe('#ff0000')
    } finally {
      // Always restore, even on assertion failure.
      await prisma.brandTheme.update({
        where: { blogId_slug: { blogId: blog.id, slug: SLUG } },
        data: { tokens: original.tokens as object },
      })
    }
  })
})
