import type { ComponentType, ReactNode } from 'react'
import { DefaultLayout } from './DefaultLayout'

export const LAYOUTS: Record<string, ComponentType<{ children: ReactNode }>> = {
  default: DefaultLayout,
}

export function resolveLayoutKey(blogDefault: string, pageKey?: string | null): string {
  const key = pageKey ?? blogDefault ?? 'default'
  return key in LAYOUTS ? key : 'default'
}
