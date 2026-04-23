import { describe, expect, it, beforeEach } from 'vitest'
import { createStubAuthProvider, signStubToken } from './stub'

const SECRET = 'test-secret-for-unit-tests-only-min-32b'

describe('StubAuthProvider', () => {
  let cookieStore: Map<string, string>

  beforeEach(() => {
    cookieStore = new Map()
  })

  const mockCookies = () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => void cookieStore.set(name, value),
    delete: (name: string) => void cookieStore.delete(name),
  })

  it('returns null when no cookie is present', async () => {
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    expect(await provider.getSession()).toBeNull()
  })

  it('returns a session when a valid token is in the cookie', async () => {
    const token = await signStubToken({ userId: 'u1', email: 'a@b.com' }, SECRET)
    cookieStore.set('admin_session', token)
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    const session = await provider.getSession()
    expect(session).toEqual({ userId: 'u1', email: 'a@b.com' })
  })

  it('returns null when the token is invalid', async () => {
    cookieStore.set('admin_session', 'garbage-token')
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    expect(await provider.getSession()).toBeNull()
  })

  it('returns null when the token is signed with wrong secret', async () => {
    const token = await signStubToken({ userId: 'u1', email: 'a@b.com' }, 'different-secret-also-min-32-bytes')
    cookieStore.set('admin_session', token)
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    expect(await provider.getSession()).toBeNull()
  })

  it('returns null when the token has an empty-string email', async () => {
    // Sign a token bypassing the helper to simulate a malformed/attacker token
    const { SignJWT } = await import('jose')
    const key = new TextEncoder().encode(SECRET)
    const token = await new SignJWT({ email: '' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u1')
      .setExpirationTime('7d')
      .sign(key)
    cookieStore.set('admin_session', token)
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    expect(await provider.getSession()).toBeNull()
  })

  it('signIn stores a valid signed token in the cookie', async () => {
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    await provider.signIn({ userId: 'u1', email: 'a@b.com' })
    expect(cookieStore.has('admin_session')).toBe(true)
    const session = await provider.getSession()
    expect(session).toEqual({ userId: 'u1', email: 'a@b.com' })
  })

  it('signOut clears the cookie', async () => {
    cookieStore.set('admin_session', 'anything')
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    await provider.signOut()
    expect(cookieStore.has('admin_session')).toBe(false)
  })
})
