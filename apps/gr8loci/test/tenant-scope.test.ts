import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { basePrisma } from '../lib/db/base'
import { forBlog } from '../lib/db/tenant'

const dbAvailable = Boolean(process.env.DATABASE_URL)

describe.skipIf(!dbAvailable)('forBlog tenant isolation', () => {
  let aId: string
  let bId: string

  beforeAll(async () => {
    // Pre-clean any leftover test rows from a previously failed run.
    const existing = await basePrisma.blog.findMany({ where: { slug: { in: ['iso-a', 'iso-b'] } } })
    if (existing.length > 0) {
      const ids = existing.map((b) => b.id)
      await basePrisma.page.deleteMany({ where: { blogId: { in: ids } } })
      await basePrisma.blog.deleteMany({ where: { id: { in: ids } } })
    }
    const a = await basePrisma.blog.create({ data: { slug: 'iso-a', name: 'A' } })
    const b = await basePrisma.blog.create({ data: { slug: 'iso-b', name: 'B' } })
    aId = a.id; bId = b.id
    // Same slug 'hello' in both tenants — proves per-tenant uniqueness + scoping.
    await basePrisma.page.create({ data: { blogId: aId, slug: 'hello', title: 'A hello', content: {} } })
    await basePrisma.page.create({ data: { blogId: bId, slug: 'hello', title: 'B hello', content: {} } })
  })

  afterAll(async () => {
    if (aId && bId) {
      await basePrisma.page.deleteMany({ where: { blogId: { in: [aId, bId] } } })
      await basePrisma.blog.deleteMany({ where: { id: { in: [aId, bId] } } })
    }
    await basePrisma.$disconnect()
  })

  it('findMany returns only the scoped tenant rows', async () => {
    const pages = await forBlog(aId).page.findMany()
    expect(pages.every((p) => p.blogId === aId)).toBe(true)
    expect(pages.some((p) => p.title === 'B hello')).toBe(false)
  })

  it('findFirst by shared slug never crosses tenants', async () => {
    const page = await forBlog(aId).page.findFirst({ where: { slug: 'hello' } })
    expect(page?.title).toBe('A hello')
  })

  it('create auto-assigns the scoped blogId', async () => {
    const created = await forBlog(aId).page.create({ data: { slug: 'made', title: 'made', content: {} } as never })
    expect(created.blogId).toBe(aId)
  })

  it('updateMany cannot touch another tenant rows', async () => {
    const res = await forBlog(aId).page.updateMany({ where: { slug: 'hello' }, data: { title: 'changed' } })
    expect(res.count).toBe(1)
    const bPage = await basePrisma.page.findFirst({ where: { blogId: bId, slug: 'hello' } })
    expect(bPage?.title).toBe('B hello')
  })

  it('deleteMany cannot touch another tenant rows', async () => {
    await forBlog(aId).page.deleteMany({ where: { slug: 'made' } })
    const stillThereForB = await basePrisma.page.count({ where: { blogId: bId } })
    expect(stillThereForB).toBeGreaterThan(0)
  })
})
