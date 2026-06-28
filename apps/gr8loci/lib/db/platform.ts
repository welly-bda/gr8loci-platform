import { basePrisma } from './base'

/**
 * UNSCOPED, cross-tenant Prisma access. Use only for genuine platform
 * operations: creating/listing blogs, resolving hostnames, super-admin tooling.
 * Never use this to read/write a single tenant's content — use forBlog(blogId).
 */
export function forPlatform() {
  return basePrisma
}
