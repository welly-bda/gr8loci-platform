'use server'
import { revalidatePath } from 'next/cache'
import { forPlatform } from '@/lib/db/platform'
import { auth, initAuthForRequest } from '@platform/auth'

export async function createBlogAction(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '').trim().toLowerCase()
  const name = String(formData.get('name') ?? '').trim()
  if (!/^[a-z0-9-]+$/.test(slug) || !name) throw new Error('Invalid slug or name')

  await initAuthForRequest()
  const session = await auth.getSession()
  const db = forPlatform()
  const blog = await db.blog.create({ data: { slug, name } })
  if (session?.userId) {
    await db.membership.create({ data: { userId: session.userId, blogId: blog.id, role: 'super_admin' } })
  }
  revalidatePath('/admin/blogs')
}
