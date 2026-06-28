import { headers } from 'next/headers'
import { cache } from 'react'
import { forBlog, type ScopedPrisma } from './db/tenant'
import { forPlatform } from './db/platform'

export class MissingTenantError extends Error {
  constructor() { super('x-blog-id header missing — no tenant resolved for this request') }
}

export async function getBlogId(): Promise<string> {
  const blogId = (await headers()).get('x-blog-id')
  if (!blogId) throw new MissingTenantError()
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
