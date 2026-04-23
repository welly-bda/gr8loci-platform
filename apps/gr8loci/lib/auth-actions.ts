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

  if (password !== process.env.ADMIN_STUB_PASSWORD) {
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
