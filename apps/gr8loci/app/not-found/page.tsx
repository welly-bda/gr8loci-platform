import { notFound } from 'next/navigation'

/**
 * This page exists solely so that a middleware rewrite to /not-found
 * triggers Next.js's notFound() mechanism, which renders app/not-found.tsx
 * with a genuine HTTP 404 status rather than a 200.
 */
export default function NotFoundPage() {
  notFound()
}
