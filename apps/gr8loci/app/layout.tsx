import type { Metadata } from 'next'
import { ThemeStyle } from '@platform/design-system/runtime'
import { forPlatform } from '@/lib/db/platform'
import { getCurrentBlog } from '@/lib/tenant-context'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GR8LOCI', template: '%s · GR8LOCI' },
  description: 'Health & wellness content and community.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Admin routes don't carry x-blog-id — fall back to the env default so the
  // layout still renders; public routes always have the header (set by middleware).
  let slug: string
  try {
    const blog = await getCurrentBlog()
    slug = blog.slug
  } catch {
    slug = process.env.BRAND_SLUG ?? 'gr8loci'
  }
  return (
    <html lang="en">
      <head>
        <ThemeStyle prisma={forPlatform()} slug={slug} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
