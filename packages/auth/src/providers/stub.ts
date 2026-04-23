import { SignJWT, jwtVerify } from 'jose'
import type { AuthProvider, Session } from '../types'

const COOKIE_NAME = 'admin_session'

type CookieStore = {
  get(name: string): { value: string } | undefined
  set(name: string, value: string): void
  delete(name: string): void
}

type GetCookies = () => CookieStore

export interface StubAuthOptions {
  /** 32+ byte secret for HS256 signing. */
  secret: string
  /** Abstracted cookie access so this works in both Next.js runtime and tests. */
  getCookies: GetCookies
}

/** Sign a session payload into a JWT. Exposed for testing. */
export async function signStubToken(session: Session, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret)
  return await new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setExpirationTime('7d')
    .sign(key)
}

/**
 * Creates a StubAuthProvider. F1-only — F4+ replaces with Clerk.
 * Do NOT use in production as-is; the consuming app uses a plaintext
 * env-var password compare for login. This module only handles JWT
 * issuance and cookie-based session retrieval — no rate limiting, no MFA,
 * no revocation, no password reset.
 */
export function createStubAuthProvider({
  secret,
  getCookies,
}: StubAuthOptions): AuthProvider & {
  signIn(session: Session): Promise<void>
} {
  const key = new TextEncoder().encode(secret)

  return {
    async getSession() {
      const token = getCookies().get(COOKIE_NAME)?.value
      if (!token) return null
      try {
        const { payload } = await jwtVerify(token, key)
        if (!payload.sub || typeof payload.email !== 'string' || payload.email.length === 0) return null
        return { userId: payload.sub, email: payload.email }
      } catch {
        return null
      }
    },

    async signIn(session) {
      const token = await signStubToken(session, secret)
      getCookies().set(COOKIE_NAME, token)
    },

    async signOut() {
      getCookies().delete(COOKIE_NAME)
    },
  }
}
