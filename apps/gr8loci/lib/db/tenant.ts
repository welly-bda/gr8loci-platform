import { basePrisma } from './base'

const TENANT_MODELS = new Set(['BlogPost', 'Page', 'BrandTheme'])

/**
 * Operations whose `where` clause is a unique selector (e.g. `{ id: "..." }`)
 * cannot be augmented with `blogId` — Prisma rejects compound unique+non-unique
 * where clauses. Calling these through a scoped client would silently bypass
 * tenant isolation. They now THROW instead.
 *
 * Use findFirst/updateMany/deleteMany/create instead, or forPlatform() for a
 * deliberate cross-tenant operation.
 */
const UNSAFE_TENANT_OPS = new Set(['findUnique', 'findUniqueOrThrow', 'update', 'delete', 'upsert'])

/**
 * Returns a Prisma client scoped to a single blog. For tenant-owned models,
 * `where` is filtered by blogId and create/createMany auto-set blogId.
 *
 * ⚠️ SECURITY: On tenant models, callers MUST use findMany/findFirst/
 * updateMany/deleteMany/create/createMany ONLY.
 * findUnique, findUniqueOrThrow, update, delete, and upsert THROW on tenant
 * models — their unique `where` cannot carry blogId, so tenant isolation
 * cannot be guaranteed. Use findFirst/updateMany/deleteMany/create instead,
 * or forPlatform() for a deliberate cross-tenant op.
 */
export function forBlog(blogId: string) {
  return basePrisma.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args)

          if (UNSAFE_TENANT_OPS.has(operation)) {
            throw new Error(
              `forBlog: '${operation}' is not tenant-scoped for model '${model}' (its unique where cannot carry blogId). ` +
                `Use findFirst/updateMany/deleteMany/create instead, or forPlatform() for a deliberate cross-tenant op.`,
            )
          }

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
