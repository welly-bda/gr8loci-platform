import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container, RichContent, Stack } from '@platform/design-system'
import { getPageBySlug } from '@/lib/content'
import { getCurrentBlog, getTenantDb } from '@/lib/tenant-context'
import { LayoutRenderer } from '@/app/_layouts/LayoutRenderer'
import { resolveLayoutKey } from '@/app/_layouts/registry'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug(await getTenantDb(), 'about')
  if (!page) return {}
  return { title: page.title }
}

export default async function AboutPage() {
  const [db, blog] = await Promise.all([getTenantDb(), getCurrentBlog()])
  const page = await getPageBySlug(db, 'about')
  if (!page) notFound()
  const layoutKey = resolveLayoutKey(blog.defaultLayout, page.layoutKey)

  return (
    <LayoutRenderer layoutKey={layoutKey}>
      <Container maxWidth="md">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <RichContent doc={page.content} />
        </Stack>
      </Container>
    </LayoutRenderer>
  )
}
