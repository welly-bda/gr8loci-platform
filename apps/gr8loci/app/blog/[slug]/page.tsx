import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container, Heading, RichContent, Stack, Text } from '@platform/design-system'
import { getBlogPostBySlug } from '@/lib/content'
import { getCurrentBlog, getTenantDb } from '@/lib/tenant-context'
import { LayoutRenderer } from '@/app/_layouts/LayoutRenderer'
import { resolveLayoutKey } from '@/app/_layouts/registry'

interface Params {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const db = await getTenantDb()
  const post = await getBlogPostBySlug(db, slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  }
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params
  const [db, blog] = await Promise.all([getTenantDb(), getCurrentBlog()])
  const post = await getBlogPostBySlug(db, slug)
  if (!post) notFound()
  const layoutKey = resolveLayoutKey(blog.defaultLayout)

  return (
    <LayoutRenderer layoutKey={layoutKey}>
      <Container maxWidth="md">
        <Stack gap={8} style={{ paddingBlock: 'var(--space-16)' }}>
          <Stack gap={3}>
            <Heading level={1}>{post.title}</Heading>
            {post.excerpt && <Text size="lg">{post.excerpt}</Text>}
            {post.publishedAt && (
              <Text size="sm" style={{ color: 'var(--color-text-muted)' }}>
                Published {post.publishedAt.toLocaleDateString()}
              </Text>
            )}
          </Stack>
          {post.heroImageUrl && (
            <img src={post.heroImageUrl} alt={post.heroImageAlt ?? ''} style={{ borderRadius: 'var(--radius-lg)' }} />
          )}
          <RichContent doc={post.content} />
        </Stack>
      </Container>
    </LayoutRenderer>
  )
}
