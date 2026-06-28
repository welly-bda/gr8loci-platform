import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * Raw, UNSCOPED Prisma client. Do NOT import this in application code.
 * App code must use `forBlog(blogId)` (lib/db/tenant.ts). Cross-tenant
 * platform operations use `forPlatform()` (lib/db/platform.ts).
 */
export const basePrisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma
