import { headers } from 'next/headers'
import { cache } from 'react'
import { forBlog, type ScopedPrisma } from './db/tenant'
import { forPlatform } from './db/platform'

export async function getBlogId(): Promise<string> {
  const blogId = (await headers()).get('x-blog-id')
  if (!blogId) throw new Error('getBlogId(): x-blog-id header missing — middleware did not resolve a tenant')
  return blogId
}

export async function getTenantDb(): Promise<ScopedPrisma> {
  return forBlog(await getBlogId())
}

/** Resolved blog's own registry row. Cached per request. */
export const getCurrentBlog = cache(async () => {
  const id = await getBlogId()
  const blog = await forPlatform().blog.findUnique({
    where: { id },
    select: { id: true, slug: true, name: true, defaultLayout: true },
  })
  if (!blog) throw new Error(`getCurrentBlog(): no blog for id ${id}`)
  return blog
})
