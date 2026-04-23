import { Container, Heading, Stack } from '@platform/design-system'
import { HeroSection } from '@/components/HeroSection'
import { BlogGrid } from '@/components/BlogGrid'
import { getPublishedBlogPosts } from '@/lib/content'

export default async function HomePage() {
  const posts = (await getPublishedBlogPosts()).slice(0, 3)

  return (
    <main>
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
    </main>
  )
}
