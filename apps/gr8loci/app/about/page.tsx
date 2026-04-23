import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container, RichContent, Stack } from '@platform/design-system'
import { getPageBySlug } from '@/lib/content'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug('about')
  if (!page) return {}
  return { title: page.title }
}

export default async function AboutPage() {
  const page = await getPageBySlug('about')
  if (!page) notFound()

  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <RichContent doc={page.content} />
        </Stack>
      </Container>
    </main>
  )
}
