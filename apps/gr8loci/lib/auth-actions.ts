'use server'

import { redirect } from 'next/navigation'
import { auth, initAuthForRequest } from '@platform/auth'
import { prisma } from './db'

export async function loginAction(_prev: { error?: string }, formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  const adminPassword = process.env.ADMIN_STUB_PASSWORD
  if (!adminPassword) {
    console.error('[auth] ADMIN_STUB_PASSWORD env var is not set — login disabled')
    return { error: 'Authentication is not configured.' }
  }
  if (password !== adminPassword) {
    return { error: 'Invalid credentials.' }
  }

  const user = await prisma.adminUser.findUnique({ where: { email } })
  if (!user) {
    return { error: 'Invalid credentials.' }
  }

  await initAuthForRequest()
  await auth.signIn({ userId: user.id, email: user.email })

  redirect('/admin')
}

export async function logoutAction() {
  await initAuthForRequest()
  await auth.signOut()
  redirect('/admin/login')
}
