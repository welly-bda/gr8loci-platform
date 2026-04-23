import { cookies as nextCookies } from 'next/headers'

/**
 * Bridges Next.js's async cookies() to the synchronous CookieStore interface
 * used by the stub provider. Call at the top of any server action, route
 * handler, or server component that uses `auth`.
 */
export async function getNextCookieStore() {
  const jar = await nextCookies()
  return {
    get: (name: string) => {
      const c = jar.get(name)
      return c ? { value: c.value } : undefined
    },
    set: (name: string, value: string) =>
      jar.set(name, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      }),
    delete: (name: string) => {
      jar.delete(name)
    },
  }
}
