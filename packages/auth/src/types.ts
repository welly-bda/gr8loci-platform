export type Session = {
  userId: string
  email: string
}

export interface AuthProvider {
  /** Returns current session, or null if not authenticated. */
  getSession(): Promise<Session | null>
  /** Clears the current session cookie. */
  signOut(): Promise<void>
}
