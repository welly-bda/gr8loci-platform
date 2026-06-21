import type { RichContentSchema as RichContent } from '@platform/design-system'
import type { ScopedPrisma } from './db/tenant'

export type BlogPostSummary = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  heroImageUrl: string | null
  heroImageAlt: string | null
  publishedAt: Date | null
}

export type BlogPost = BlogPostSummary & {
  content: RichContent
}

export type PageEntity = {
  id: string
  slug: string
  title: string
  content: RichContent
}

export async function getPublishedBlogPosts(db: ScopedPrisma): Promise<BlogPostSummary[]> {
  return db.blogPost.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      slug: true,
      title: true,
      excerpt: true,
      heroImageUrl: true,
      heroImageAlt: true,
      publishedAt: true,
    },
  })
}

export async function getBlogPostBySlug(db: ScopedPrisma, slug: string): Promise<BlogPost | null> {
  const row = await db.blogPost.findFirst({ where: { slug, status: 'published' } })
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    heroImageUrl: row.heroImageUrl,
    heroImageAlt: row.heroImageAlt,
    publishedAt: row.publishedAt,
    content: row.content as unknown as RichContent,
  }
}

export async function getPageBySlug(db: ScopedPrisma, slug: string): Promise<PageEntity | null> {
  const row = await db.page.findFirst({ where: { slug } })
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: row.content as unknown as RichContent,
  }
}
