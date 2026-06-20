import type { Metadata } from 'next'
import { ThemeStyle } from '@platform/design-system/runtime'
import { prisma } from '@/lib/db'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GR8LOCI', template: '%s · GR8LOCI' },
  description: 'Health & wellness content and community.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const slug = process.env.BRAND_SLUG ?? 'gr8loci'
  return (
    <html lang="en">
      <head>
        <ThemeStyle prisma={prisma} slug={slug} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
