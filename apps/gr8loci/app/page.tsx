import { Container, Heading, Stack } from '@platform/design-system'
import { HeroSection } from '@/components/HeroSection'
import { BlogGrid } from '@/components/BlogGrid'
import { getPublishedBlogPosts } from '@/lib/content'
import { getCurrentBlog, getTenantDb } from '@/lib/tenant-context'
import { LayoutRenderer } from '@/app/_layouts/LayoutRenderer'
import { resolveLayoutKey } from '@/app/_layouts/registry'

export default async function HomePage() {
  const [db, blog] = await Promise.all([getTenantDb(), getCurrentBlog()])
  const posts = (await getPublishedBlogPosts(db)).slice(0, 3)
  const layoutKey = resolveLayoutKey(blog.defaultLayout)

  return (
    <LayoutRenderer layoutKey={layoutKey}>
      <HeroSection
        title="Clear answers on health and wellness."
        tagline="Evidence-based habits, honest reviews, practical guides."
        imageUrl="/hero-home.svg"
        imageAlt="Abstract hero banner"
      />

      <Container>
        <Stack gap={12} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={2}>Latest posts</Heading>
          <BlogGrid posts={posts} />
        </Stack>
      </Container>
    </LayoutRenderer>
  )
}
