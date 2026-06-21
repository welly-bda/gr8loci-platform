import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { forPlatform } from './db/platform'
import { forBlog, type ScopedPrisma } from './db/tenant'

export async function getActiveBlog() {
  const id = (await cookies()).get('active_blog')?.value
  const db = forPlatform()
  const blog =
    (id && (await db.blog.findUnique({ where: { id }, select: { id: true, slug: true, name: true } }))) ||
    (await db.blog.findUnique({ where: { slug: 'gr8loci' }, select: { id: true, slug: true, name: true } }))
  if (!blog) throw new Error('No blogs exist — seed tenant-0 first')
  return blog
}

export async function getAdminDb(): Promise<ScopedPrisma> {
  return forBlog((await getActiveBlog()).id)
}

export async function setActiveBlogAction(formData: FormData) {
  'use server'
  const id = String(formData.get('blogId') ?? '')
  ;(await cookies()).set('active_blog', id, { httpOnly: true, sameSite: 'lax', path: '/' })
  redirect('/admin')
}
