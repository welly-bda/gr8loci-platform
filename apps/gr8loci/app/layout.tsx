import type { Metadata } from 'next'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GR8LOCI', template: '%s · GR8LOCI' },
  description: 'Health & wellness content and community.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
