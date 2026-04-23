import { createStubAuthProvider } from './providers/stub'
import { getNextCookieStore } from './next-runtime'
import type { AuthProvider, Session } from './types'

export type { Session, AuthProvider } from './types'
export { signStubToken } from './providers/stub'

const secret = process.env.AUTH_STUB_SECRET
if (!secret) {
  throw new Error('AUTH_STUB_SECRET env var is required')
}

let cachedStore: Awaited<ReturnType<typeof getNextCookieStore>> | null = null

/**
 * F1 auth export. Swapped for Clerk in a future spec.
 *
 * IMPORTANT usage pattern:
 *   await initAuthForRequest()  // call first in every request entry point
 *   const session = await auth.getSession()
 *
 * The lazy init is required because Next.js 15's `cookies()` is async
 * and must be awaited inside a request scope.
 */
export const auth: AuthProvider & {
  signIn(session: Session): Promise<void>
} = createStubAuthProvider({
  secret,
  getCookies: () => {
    if (!cachedStore) {
      throw new Error(
        'auth method called before initAuthForRequest(). Call `await initAuthForRequest()` at the start of your server action / route handler / server component.',
      )
    }
    return cachedStore
  },
})

/** Call at the start of any server-side request scope before using `auth`. */
export async function initAuthForRequest(): Promise<void> {
  cachedStore = await getNextCookieStore()
}
