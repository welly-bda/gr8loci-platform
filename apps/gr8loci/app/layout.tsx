import type { Metadata } from 'next'
import { ThemeStyle } from '@platform/design-system/runtime'
import { forPlatform } from '@/lib/db/platform'
import { getCurrentBlog, MissingTenantError } from '@/lib/tenant-context'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GR8LOCI', template: '%s · GR8LOCI' },
  description: 'Health & wellness content and community.',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Admin routes don't carry x-blog-id; catch only that case and render without
  // tenant theme. Re-throw any other error so real failures surface loudly.
  let themeSlug: string | null = null
  try {
    themeSlug = (await getCurrentBlog()).slug
  } catch (e) {
    if (!(e instanceof MissingTenantError)) throw e
    // admin / no-tenant context: render without tenant theme
  }
  return (
    <html lang="en">
      <head>
        {themeSlug && <ThemeStyle prisma={forPlatform()} slug={themeSlug} />}
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
