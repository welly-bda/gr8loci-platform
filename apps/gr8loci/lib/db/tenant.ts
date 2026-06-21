import { basePrisma } from './base'

const TENANT_MODELS = new Set(['BlogPost', 'Page', 'BrandTheme'])

/**
 * Returns a Prisma client scoped to a single blog. For tenant-owned models,
 * `where` is filtered by blogId and create/createMany auto-set blogId.
 *
 * ⚠️ SECURITY: On tenant models, callers MUST use findMany/findFirst/
 * updateMany/deleteMany/create/createMany ONLY.
 * Do NOT call findUnique, update, or delete (singular) on a tenant model
 * through this scoped client. Those operations accept a unique `where` (e.g.
 * `{ id: "..." }`) that the extension CANNOT augment with blogId — the query
 * will bypass tenant isolation entirely and silently read from or write to
 * ANOTHER tenant's row, causing a cross-tenant data leak or corruption.
 */
export function forBlog(blogId: string) {
  return basePrisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args)
          const a = (args ?? {}) as Record<string, unknown>

          if (operation === 'create') {
            a.data = { ...(a.data as object), blogId }
          } else if (operation === 'createMany') {
            const data = a.data as unknown
            a.data = Array.isArray(data)
              ? data.map((d) => ({ ...(d as object), blogId }))
              : { ...(data as object), blogId }
          } else {
            // reads + updateMany/deleteMany/aggregate/count/groupBy
            a.where = { ...((a.where as object) ?? {}), blogId }
          }
          return query(a)
        },
      },
    },
  })
}

export type ScopedPrisma = ReturnType<typeof forBlog>
