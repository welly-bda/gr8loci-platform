import type { Metadata } from 'next'
import { Container, Heading, Stack, Text } from '@platform/design-system'
import { BlogGrid } from '@/components/BlogGrid'
import { getPublishedBlogPosts } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'All published articles on GR8LOCI.',
}

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts()
  return (
    <main>
      <Container>
        <Stack gap={8} style={{ paddingBlock: 'var(--space-16)' }}>
          <Stack gap={3}>
            <Heading level={1}>Blog</Heading>
            <Text size="lg">All articles, most recent first.</Text>
          </Stack>
          <BlogGrid posts={posts} />
        </Stack>
      </Container>
    </main>
  )
}
