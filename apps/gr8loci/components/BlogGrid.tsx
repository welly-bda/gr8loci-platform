import Link from 'next/link'
import { Card, Heading, Stack, Text } from '@platform/design-system'
import styles from './BlogGrid.module.css'
import type { BlogPostSummary } from '@/lib/content'

export interface BlogGridProps {
  posts: BlogPostSummary[]
}

export function BlogGrid({ posts }: BlogGridProps) {
  if (posts.length === 0) {
    return <Text>No posts yet.</Text>
  }
  return (
    <div className={styles.grid}>
      {posts.map((post) => (
        <Card key={post.id} as="article" variant="elevated" className={styles.card}>
          {post.heroImageUrl && (
            <img src={post.heroImageUrl} alt={post.heroImageAlt ?? ''} className={styles.cardImage} />
          )}
          <Stack gap={3} className={styles.cardBody}>
            <Heading level={3}>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </Heading>
            {post.excerpt && <Text>{post.excerpt}</Text>}
          </Stack>
        </Card>
      ))}
    </div>
  )
}
