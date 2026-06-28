import type { ReactNode } from 'react'
import { LAYOUTS } from './registry'
import { DefaultLayout } from './DefaultLayout'

export function LayoutRenderer({ layoutKey, children }: { layoutKey: string; children: ReactNode }) {
  const Layout = LAYOUTS[layoutKey] ?? DefaultLayout
  return <Layout>{children}</Layout>
}
