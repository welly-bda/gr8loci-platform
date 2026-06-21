# P1 — Tenancy Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-tenant gr8loci app into a row-level multi-tenant platform — hostname→tenant routing, a mandatory tenant-scoped data-access layer, an admin shell, and the existing site migrated into "tenant-0" — on the existing stub auth.

**Architecture:** One Postgres DB, one schema; every tenant-owned row carries `blogId`. A `forBlog(blogId)` Prisma Client Extension is the only way app code touches tenant data; a named `forPlatform()` escape hatch covers cross-tenant ops. Middleware resolves the request hostname to a `blogId` (exact `Domain` match first, then `*.gr8loci.online` subdomain) and passes it downstream via an internal header. Public pages render through a `LayoutRenderer` seam (one default layout in P1). The admin shell adopts Tailwind/shadcn scoped to the `(admin)` route group only.

**Tech Stack:** Next.js 15 (App Router) · React 19 · TypeScript strict · Prisma 6 + PostgreSQL 16 · Vitest + Playwright · pnpm 9 · Tailwind + shadcn/ui (admin-only).

## Global Constraints

- **No unscoped Prisma in application code.** App code uses `forBlog(blogId)` only. The raw client and `forPlatform()` are reachable only from the data-access module and platform/admin code; an ESLint `no-restricted-imports` rule enforces this.
- **No naked SQL** except the existing test escape hatch; Prisma for all CRUD.
- **Tenant-model singular ops:** on tenant models (`BlogPost`, `Page`, `BrandTheme`) app code uses `findFirst` / `updateMany` / `deleteMany` (never `findUnique`/singular `update`/`delete`), so the scoped `blogId` filter is always valid.
- **CSS Modules only on the public side.** Tailwind/shadcn is scoped to the `(admin)` route group; preflight must not reach public pages.
- **Live site preserved:** `gr8loci.online` + `www` resolve to tenant-0; existing URLs/content/theme render identically post-migration.
- **Ports:** dev `3005`, Playwright `3007`. Dev subdomains use `*.localhost` (e.g. `gr8loci.localhost:3005`).
- **Commit style:** conventional — `feat(scope):`, `fix(scope):`, `test(scope):`, `chore(scope):`, `docs:`. Scope is usually `gr8loci`.
- **Run commands from repo root** unless noted: `pnpm --filter gr8loci <script>`.
- **CI already provides Postgres + migrations** (added during F2 merge); integration tests run in CI.

**Branching:** all work lands on a `p1-tenancy-foundation` branch (create it before Task 1; move the two spec commits onto it if still on `main`).

---

## File Structure

```
apps/gr8loci/
  prisma/
    schema.prisma                         MODIFY  new models/enums, blogId FKs, per-tenant unique
    migrations/<ts>_add_tenancy_nullable/  CREATE  Migration A (additive, nullable)
    migrations/<ts>_backfill_tenant_zero/  CREATE  data backfill SQL
    migrations/<ts>_tenancy_tighten/       CREATE  Migration B (non-null + unique)
    seed.ts                                MODIFY  seed Blog/Domain/Membership; scope upserts by blogId
  lib/
    db/
      base.ts                              CREATE  raw PrismaClient (containment)
      tenant.ts                            CREATE  forBlog() extension factory
      platform.ts                          CREATE  forPlatform() escape hatch
      base.test.ts                         CREATE  (n/a — covered via tenant.test.ts)
    db.ts                                  DELETE  (replaced by lib/db/*) — update importers
    tenant-context.ts                      CREATE  getTenantContext() server helper
    hostname.ts                            CREATE  pure resolveHostname() + tests
    hostname.test.ts                       CREATE
    content.ts                             MODIFY  functions take blogId; findUnique→findFirst
    active-blog.ts                         CREATE  admin active-tenant cookie helpers
  middleware.ts                            MODIFY  hostname resolution + header; keep /admin guard
  app/
    layout.tsx                             MODIFY  theme by resolved tenant slug, not BRAND_SLUG
    page.tsx / blog/page.tsx / blog/[slug]/page.tsx / about/page.tsx  MODIFY  use tenant context
    not-found.tsx                          CREATE  unknown-host / disabled-blog 404
    _layouts/
      LayoutRenderer.tsx                   CREATE  layout seam (registry dispatch)
      registry.ts                          CREATE  layoutKey → component
      DefaultLayout.tsx                    CREATE  current arrangement behind the seam
    (admin)/
      layout.tsx                           CREATE  admin layout; imports Tailwind base
      admin/page.tsx                       MODIFY  tenant switcher + active tenant
      admin/blogs/page.tsx                 CREATE  list + create blog
      admin/domains/page.tsx               CREATE  assign domain
    admin.css                              CREATE  Tailwind entry (admin-only)
  tailwind.config.ts                       CREATE  content globs = admin only
  postcss.config.mjs                       CREATE
  components/ui/                           CREATE  shadcn components (button, etc.)
  test/                                    CREATE  integration + leak-guard tests
```

---

## Task 1: Tenancy schema models (additive, nullable)

**Files:**
- Modify: `apps/gr8loci/prisma/schema.prisma`
- Create: `apps/gr8loci/prisma/migrations/<timestamp>_add_tenancy_nullable/migration.sql` (generated)

**Interfaces:**
- Produces: Prisma models `Blog`, `Membership`, `Domain`; enums `BlogStatus`, `Role`; nullable `blogId` on `BlogPost`/`Page`/`BrandTheme`; `Page.layoutKey`. Generated client exports these types.

- [ ] **Step 1: Add models/enums and nullable FKs to the schema**

Append to `apps/gr8loci/prisma/schema.prisma` and edit the three existing models:

```prisma
enum BlogStatus {
  active
  disabled
}

enum Role {
  super_admin
  operator_admin
  editor
}

model Blog {
  id            String     @id @default(cuid())
  slug          String     @unique
  name          String
  status        BlogStatus @default(active)
  defaultLayout String     @default("default")
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  posts       BlogPost[]
  pages       Page[]
  themes      BrandTheme[]
  memberships Membership[]
  domains     Domain[]

  @@map("blogs")
}

model Membership {
  id        String   @id @default(cuid())
  userId    String
  blogId    String
  role      Role     @default(editor)
  createdAt DateTime @default(now())

  blog Blog @relation(fields: [blogId], references: [id], onDelete: Cascade)

  @@unique([userId, blogId])
  @@index([blogId])
  @@map("memberships")
}

model Domain {
  id         String    @id @default(cuid())
  hostname   String    @unique
  blogId     String
  isPrimary  Boolean   @default(false)
  verifiedAt DateTime?
  createdAt  DateTime  @default(now())

  blog Blog @relation(fields: [blogId], references: [id], onDelete: Cascade)

  @@index([blogId])
  @@map("domains")
}
```

Edit `BlogPost`: add `blogId String?` and `blog Blog? @relation(fields: [blogId], references: [id])`; keep `slug @unique` for now (tightened in Task 2). Add `@@index([blogId])`.
Edit `Page`: add `blogId String?`, the relation, and `layoutKey String?`. Add `@@index([blogId])`.
Edit `BrandTheme`: add `blogId String?` and the relation. Add `@@index([blogId])`.

- [ ] **Step 2: Create the migration without applying destructive changes**

Run: `pnpm --filter gr8loci exec prisma migrate dev --name add_tenancy_nullable --create-only`
Expected: a new folder `prisma/migrations/<ts>_add_tenancy_nullable/migration.sql` containing `CREATE TABLE blogs/memberships/domains`, `CREATE TYPE` for the enums, and `ALTER TABLE ... ADD COLUMN "blogId"` (nullable) on the three tables. No `NOT NULL` on `blogId` yet.

- [ ] **Step 3: Apply the migration**

Run: `pnpm --filter gr8loci exec prisma migrate dev`
Expected: "Your database is now in sync with your schema." Client regenerated.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter gr8loci typecheck`
Expected: PASS (new types compile; nothing references them yet).

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci/prisma/schema.prisma apps/gr8loci/prisma/migrations
git commit -m "feat(gr8loci): add Blog/Membership/Domain models (nullable blogId)"
```

---

## Task 2: Tenant-0 backfill + tighten schema

**Files:**
- Create: `apps/gr8loci/prisma/migrations/<ts>_backfill_tenant_zero/migration.sql`
- Create: `apps/gr8loci/prisma/migrations/<ts>_tenancy_tighten/migration.sql`
- Modify: `apps/gr8loci/prisma/schema.prisma`, `apps/gr8loci/prisma/seed.ts`

**Interfaces:**
- Consumes: models from Task 1.
- Produces: a guaranteed `blogs` row with slug `gr8loci`; `domains` rows for apex/www/dev; a `super_admin` membership; non-null `blogId` everywhere; `@@unique([blogId, slug])` on `BlogPost`/`Page`/`BrandTheme`.

- [ ] **Step 1: Hand-write the backfill migration**

Create `apps/gr8loci/prisma/migrations/<ts>_backfill_tenant_zero/migration.sql` (use a timestamp later than Task 1's). It must be idempotent-safe for a fresh DB (CI) and the live DB:

```sql
-- Create tenant-0 (gr8loci) if no blog exists yet.
INSERT INTO "blogs" ("id", "slug", "name", "status", "defaultLayout", "createdAt", "updatedAt")
SELECT 'blog_gr8loci_tenant0', 'gr8loci', 'GR8LOCI', 'active', 'default', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "blogs" WHERE "slug" = 'gr8loci');

-- Seed domains for tenant-0 (apex, www, and dev hosts), pre-verified.
INSERT INTO "domains" ("id", "hostname", "blogId", "isPrimary", "verifiedAt", "createdAt")
SELECT gen_random_uuid()::text, h.hostname, b.id, h.is_primary, NOW(), NOW()
FROM "blogs" b
CROSS JOIN (VALUES
  ('gr8loci.online', true),
  ('www.gr8loci.online', false),
  ('localhost', false),
  ('gr8loci.localhost', false)
) AS h(hostname, is_primary)
WHERE b."slug" = 'gr8loci'
  AND NOT EXISTS (SELECT 1 FROM "domains" d WHERE d."hostname" = h.hostname);

-- Backfill blogId on existing content to tenant-0.
UPDATE "blog_posts"  SET "blogId" = (SELECT id FROM "blogs" WHERE slug = 'gr8loci') WHERE "blogId" IS NULL;
UPDATE "pages"       SET "blogId" = (SELECT id FROM "blogs" WHERE slug = 'gr8loci') WHERE "blogId" IS NULL;
UPDATE "brand_themes" SET "blogId" = (SELECT id FROM "blogs" WHERE slug = 'gr8loci') WHERE "blogId" IS NULL;

-- Seed a super_admin membership for every existing admin user.
INSERT INTO "memberships" ("id", "userId", "blogId", "role", "createdAt")
SELECT gen_random_uuid()::text, u."id", b."id", 'super_admin', NOW()
FROM "admin_users" u
CROSS JOIN "blogs" b
WHERE b."slug" = 'gr8loci'
  AND NOT EXISTS (
    SELECT 1 FROM "memberships" m WHERE m."userId" = u."id" AND m."blogId" = b."id"
  );
```

- [ ] **Step 2: Apply the backfill migration**

Run: `pnpm --filter gr8loci exec prisma migrate dev`
Expected: migration applies; "in sync". (On a fresh CI DB there are no content rows yet — the UPDATEs affect 0 rows, which is fine.)

- [ ] **Step 3: Tighten the schema**

In `schema.prisma`: change `blogId String?` → `blogId String` and the relation to non-optional on `BlogPost`/`Page`/`BrandTheme`. Replace `slug String @unique` with `slug String` and add `@@unique([blogId, slug])` to each of the three. On `BlogPost` replace `@@index([status, publishedAt])` with `@@index([blogId, status, publishedAt])`.

- [ ] **Step 4: Generate the tighten migration**

Run: `pnpm --filter gr8loci exec prisma migrate dev --name tenancy_tighten`
Expected: SQL with `ALTER COLUMN "blogId" SET NOT NULL`, `DROP INDEX` for old unique slug, `CREATE UNIQUE INDEX` on `(blogId, slug)`. Applies cleanly because Step 1 backfilled all rows.

- [ ] **Step 5: Update the seed to be tenant-aware**

Rewrite `apps/gr8loci/prisma/seed.ts` so all content upserts are scoped to tenant-0. Key changes: resolve the blog first; use `blogId_slug` compound unique in `where`; ensure the membership exists.

```ts
import { PrismaClient, PostStatus, Role } from '@prisma/client'
import { defaultTokens } from '@platform/design-system/tokens'

const prisma = new PrismaClient()
// ...paragraph()/heading() helpers unchanged...

async function main() {
  const adminEmail = process.env.ADMIN_STUB_EMAIL
  if (!adminEmail) throw new Error('ADMIN_STUB_EMAIL required for seeding')

  const blog = await prisma.blog.upsert({
    where: { slug: 'gr8loci' },
    update: {},
    create: { slug: 'gr8loci', name: 'GR8LOCI', defaultLayout: 'default' },
  })

  for (const hostname of ['gr8loci.online', 'www.gr8loci.online', 'localhost', 'gr8loci.localhost']) {
    await prisma.domain.upsert({
      where: { hostname },
      update: {},
      create: { hostname, blogId: blog.id, isPrimary: hostname === 'gr8loci.online', verifiedAt: new Date() },
    })
  }

  const admin = await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail },
    update: {},
  })
  await prisma.membership.upsert({
    where: { userId_blogId: { userId: admin.id, blogId: blog.id } },
    update: {},
    create: { userId: admin.id, blogId: blog.id, role: Role.super_admin },
  })

  await prisma.brandTheme.upsert({
    where: { blogId_slug: { blogId: blog.id, slug: 'gr8loci' } },
    update: {},
    create: { blogId: blog.id, slug: 'gr8loci', tokens: defaultTokens },
  })

  // posts: replace `where: { slug }` with the compound unique and add blogId on create
  for (const p of posts) {
    await prisma.blogPost.upsert({
      where: { blogId_slug: { blogId: blog.id, slug: p.slug } },
      update: {},
      create: { blogId: blog.id, /* ...existing fields..., */ status: PostStatus.published, publishedAt: new Date(), content: /* ...unchanged... */ },
    })
  }

  // about page: same compound-unique pattern with blogId
}
```

- [ ] **Step 6: Run the seed and verify**

Run: `pnpm --filter gr8loci prisma:seed`
Then: `pnpm --filter gr8loci exec prisma studio` (optional) — confirm one `blogs` row, four `domains`, one `memberships`, and all posts/pages/theme carry `blogId`.

- [ ] **Step 7: Typecheck + commit**

Run: `pnpm --filter gr8loci typecheck` → PASS

```bash
git add apps/gr8loci/prisma
git commit -m "feat(gr8loci): backfill tenant-0 and tighten tenancy constraints"
```

---

## Task 3: Raw-client containment + lint guard

**Files:**
- Create: `apps/gr8loci/lib/db/base.ts`
- Delete: `apps/gr8loci/lib/db.ts` (update importers in this task)
- Modify: `apps/gr8loci/eslint.config.*` (add `no-restricted-imports`)
- Modify: `apps/gr8loci/lib/auth-actions.ts`, `apps/gr8loci/app/layout.tsx` (importers of old `./db`)

**Interfaces:**
- Produces: `basePrisma` (raw `PrismaClient`) exported only from `lib/db/base.ts`. A lint rule forbids importing it outside `lib/db/**` and `lib/active-blog.ts`/admin platform code.

- [ ] **Step 1: Create the base client module**

`apps/gr8loci/lib/db/base.ts`:

```ts
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
```

- [ ] **Step 2: Point existing importers at the new module (temporary, tightened later)**

`lib/auth-actions.ts`: change `import { prisma } from './db'` → `import { basePrisma as prisma } from './db/base'` (auth-actions is platform/admin code — allowed).
`app/layout.tsx`: it currently passes `prisma` to `ThemeStyle`; this is replaced entirely in Task 8. For now change `import { prisma } from '@/lib/db'` → `import { basePrisma as prisma } from '@/lib/db/base'` to keep it compiling.
`lib/content.ts`: leave for Task 8 — temporarily change its import to `import { basePrisma as prisma } from './db/base'`.

- [ ] **Step 3: Delete the old module**

Run: `git rm apps/gr8loci/lib/db.ts`

- [ ] **Step 4: Add the lint guard**

In `apps/gr8loci/eslint.config.mjs` add a rule (adjust to the existing flat-config shape) restricting **both** the raw client and the unscoped escape hatch. Sanctioned holders of unscoped access — the data-access modules, the tenant-context/active-blog/auth helpers, the admin route group, and the root layout (platform shell) — are allowlisted:

```js
{
  files: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
  ignores: [
    'lib/db/**',
    'lib/tenant-context.ts',
    'lib/active-blog.ts',
    'lib/auth-actions.ts',
    'lib/content.ts', // TEMPORARY — remove in Task 8 once content.ts imports only the ScopedPrisma type
    'app/(admin)/**',
    'app/layout.tsx',
  ],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['**/lib/db/base', '@/lib/db/base', '**/lib/db/platform', '@/lib/db/platform'],
        message: 'No unscoped Prisma in app code. Use forBlog(blogId)/getTenantDb() for tenant data, or getCurrentBlog() for the resolved blog. forPlatform() is for platform/admin code only.',
      }],
    }],
  },
}
```

Note: `middleware.ts` lives at the app root (outside the `app/`/`lib/`/`components/` globs above) so it is not covered by this rule and may import `forPlatform()` for hostname resolution.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm --filter gr8loci lint && pnpm --filter gr8loci typecheck`
Expected: PASS (the allowlisted files may import base; public files don't yet).

- [ ] **Step 6: Commit**

```bash
git add apps/gr8loci/lib apps/gr8loci/eslint.config.mjs apps/gr8loci/app/layout.tsx
git commit -m "refactor(gr8loci): contain raw Prisma client behind lib/db/base + lint guard"
```

---

## Task 4: `forBlog()` scoped data-access + leak-guard test

**Files:**
- Create: `apps/gr8loci/lib/db/tenant.ts`
- Create: `apps/gr8loci/test/tenant-scope.test.ts`

**Interfaces:**
- Consumes: `basePrisma` from `lib/db/base.ts`.
- Produces: `forBlog(blogId: string)` → an extended client. Tenant models (`blogPost`, `page`, `brandTheme`): `where` is auto-filtered by `blogId`; `create`/`createMany` auto-set `blogId`. Non-tenant models pass through unchanged.

- [ ] **Step 1: Write the failing leak-guard test**

`apps/gr8loci/test/tenant-scope.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { basePrisma } from '../lib/db/base'
import { forBlog } from '../lib/db/tenant'

const dbAvailable = Boolean(process.env.DATABASE_URL)

describe.skipIf(!dbAvailable)('forBlog tenant isolation', () => {
  let aId: string
  let bId: string

  beforeAll(async () => {
    const a = await basePrisma.blog.create({ data: { slug: 'iso-a', name: 'A' } })
    const b = await basePrisma.blog.create({ data: { slug: 'iso-b', name: 'B' } })
    aId = a.id; bId = b.id
    // Same slug 'hello' in both tenants — proves per-tenant uniqueness + scoping.
    await basePrisma.page.create({ data: { blogId: aId, slug: 'hello', title: 'A hello', content: {} } })
    await basePrisma.page.create({ data: { blogId: bId, slug: 'hello', title: 'B hello', content: {} } })
  })

  afterAll(async () => {
    await basePrisma.blog.deleteMany({ where: { id: { in: [aId, bId] } } })
    await basePrisma.$disconnect()
  })

  it('findMany returns only the scoped tenant rows', async () => {
    const pages = await forBlog(aId).page.findMany()
    expect(pages.every((p) => p.blogId === aId)).toBe(true)
    expect(pages.some((p) => p.title === 'B hello')).toBe(false)
  })

  it('findFirst by shared slug never crosses tenants', async () => {
    const page = await forBlog(aId).page.findFirst({ where: { slug: 'hello' } })
    expect(page?.title).toBe('A hello')
  })

  it('create auto-assigns the scoped blogId', async () => {
    const created = await forBlog(aId).page.create({ data: { slug: 'made', title: 'made', content: {} } as never })
    expect(created.blogId).toBe(aId)
  })

  it('updateMany cannot touch another tenant rows', async () => {
    const res = await forBlog(aId).page.updateMany({ where: { slug: 'hello' }, data: { title: 'changed' } })
    expect(res.count).toBe(1)
    const bPage = await basePrisma.page.findFirst({ where: { blogId: bId, slug: 'hello' } })
    expect(bPage?.title).toBe('B hello')
  })

  it('deleteMany cannot touch another tenant rows', async () => {
    await forBlog(aId).page.deleteMany({ where: { slug: 'made' } })
    const stillThereForB = await basePrisma.page.count({ where: { blogId: bId } })
    expect(stillThereForB).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter gr8loci test -- tenant-scope`
Expected: FAIL — `forBlog` not found (or import error).

- [ ] **Step 3: Implement `forBlog()`**

`apps/gr8loci/lib/db/tenant.ts`:

```ts
import { basePrisma } from './base'

const TENANT_MODELS = new Set(['BlogPost', 'Page', 'BrandTheme'])

/**
 * Returns a Prisma client scoped to a single blog. For tenant-owned models,
 * `where` is filtered by blogId and create/createMany auto-set blogId.
 *
 * On tenant models, callers must use findMany/findFirst/updateMany/deleteMany/
 * create/createMany — not findUnique or singular update/delete (whose unique
 * `where` cannot carry blogId).
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter gr8loci test -- tenant-scope`
Expected: PASS (all 5 tests). If `DATABASE_URL` is unset locally, the suite skips — run against your dev DB to actually exercise it.

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci/lib/db/tenant.ts apps/gr8loci/test/tenant-scope.test.ts
git commit -m "feat(gr8loci): add forBlog() tenant-scoped data-access + leak-guard test"
```

---

## Task 5: `forPlatform()` escape hatch

**Files:**
- Create: `apps/gr8loci/lib/db/platform.ts`

**Interfaces:**
- Produces: `forPlatform()` → the raw unscoped client, for cross-tenant ops (list/create blogs, resolve hostnames). Conspicuously named; lint-allowlisted to platform/admin code.

- [ ] **Step 1: Implement**

`apps/gr8loci/lib/db/platform.ts`:

```ts
import { basePrisma } from './base'

/**
 * UNSCOPED, cross-tenant Prisma access. Use only for genuine platform
 * operations: creating/listing blogs, resolving hostnames, super-admin tooling.
 * Never use this to read/write a single tenant's content — use forBlog(blogId).
 */
export function forPlatform() {
  return basePrisma
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm --filter gr8loci typecheck && pnpm --filter gr8loci lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/lib/db/platform.ts
git commit -m "feat(gr8loci): add forPlatform() cross-tenant escape hatch"
```

---

## Task 6: Pure hostname resolver

**Files:**
- Create: `apps/gr8loci/lib/hostname.ts`
- Create: `apps/gr8loci/lib/hostname.test.ts`

**Interfaces:**
- Produces:
  - `parseHost(host: string | null): { hostname: string; subdomainSlug: string | null }` — lowercases, strips port; `subdomainSlug` is the label when host is `<label>.gr8loci.online` (else null).
  - `PLATFORM_DOMAIN = 'gr8loci.online'`.

- [ ] **Step 1: Write the failing test**

`apps/gr8loci/lib/hostname.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseHost } from './hostname'

describe('parseHost', () => {
  it('lowercases and strips the port', () => {
    expect(parseHost('GR8LOCI.online:3005').hostname).toBe('gr8loci.online')
  })
  it('extracts a subdomain slug under the platform domain', () => {
    expect(parseHost('acme.gr8loci.online').subdomainSlug).toBe('acme')
  })
  it('treats apex and www as no subdomain slug', () => {
    expect(parseHost('gr8loci.online').subdomainSlug).toBeNull()
    expect(parseHost('www.gr8loci.online').subdomainSlug).toBeNull()
  })
  it('extracts slug from *.localhost dev hosts', () => {
    expect(parseHost('acme.localhost:3005').subdomainSlug).toBe('acme')
  })
  it('returns null subdomain for plain localhost and custom domains', () => {
    expect(parseHost('localhost:3005').subdomainSlug).toBeNull()
    expect(parseHost('example.com').subdomainSlug).toBeNull()
  })
  it('handles a null host', () => {
    expect(parseHost(null).hostname).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter gr8loci test -- hostname`
Expected: FAIL — `parseHost` not defined.

- [ ] **Step 3: Implement**

`apps/gr8loci/lib/hostname.ts`:

```ts
export const PLATFORM_DOMAIN = 'gr8loci.online'

const RESERVED_SUBDOMAINS = new Set(['www'])

export function parseHost(host: string | null): { hostname: string; subdomainSlug: string | null } {
  const hostname = (host ?? '').split(':')[0].toLowerCase()
  if (!hostname) return { hostname: '', subdomainSlug: null }

  const platformSuffix = `.${PLATFORM_DOMAIN}`
  if (hostname.endsWith(platformSuffix)) {
    const label = hostname.slice(0, -platformSuffix.length)
    if (label && !label.includes('.') && !RESERVED_SUBDOMAINS.has(label)) {
      return { hostname, subdomainSlug: label }
    }
    return { hostname, subdomainSlug: null }
  }

  // dev: <label>.localhost
  if (hostname.endsWith('.localhost')) {
    const label = hostname.slice(0, -'.localhost'.length)
    if (label && !label.includes('.') && !RESERVED_SUBDOMAINS.has(label)) {
      return { hostname, subdomainSlug: label }
    }
  }

  return { hostname, subdomainSlug: null }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter gr8loci test -- hostname`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci/lib/hostname.ts apps/gr8loci/lib/hostname.test.ts
git commit -m "feat(gr8loci): add pure hostname resolver with tests"
```

---

## Task 7: Resolve tenant in middleware

**Files:**
- Modify: `apps/gr8loci/middleware.ts`
- Create: `apps/gr8loci/app/not-found.tsx`

**Interfaces:**
- Consumes: `parseHost`, `PLATFORM_DOMAIN` (Task 6); `forPlatform()` (Task 5).
- Produces: every public request carries header `x-blog-id` (resolved) OR is rewritten to 404. The existing `/admin` JWT guard is preserved.
- Note: middleware runs on the Edge runtime. Prisma Client cannot run on Edge here, so set the middleware to the Node.js runtime via `export const runtime = 'nodejs'` (Next 15 supports Node middleware). Alternatively resolve via a lightweight lookup — but Node runtime + `forPlatform()` is the chosen approach.

- [ ] **Step 1: Write the resolver wiring into middleware**

Rewrite `apps/gr8loci/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { parseHost } from '@/lib/hostname'
import { forPlatform } from '@/lib/db/platform'

export const runtime = 'nodejs'

const SECRET = new TextEncoder().encode(process.env.AUTH_STUB_SECRET)

async function guardAdmin(req: NextRequest): Promise<NextResponse | undefined> {
  const path = req.nextUrl.pathname
  if (path === '/admin/login') return
  const token = req.cookies.get('admin_session')?.value
  if (!token) return NextResponse.redirect(new URL('/admin/login', req.url))
  try {
    await jwtVerify(token, SECRET)
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}

async function resolveBlogId(req: NextRequest): Promise<string | null> {
  const { hostname, subdomainSlug } = parseHost(req.headers.get('host'))
  const db = forPlatform()
  // Exact Domain match first (apex, www, custom, dev hosts).
  const domain = await db.domain.findUnique({ where: { hostname }, select: { blogId: true } })
  if (domain) return domain.blogId
  // Then subdomain slug.
  if (subdomainSlug) {
    const blog = await db.blog.findFirst({ where: { slug: subdomainSlug, status: 'active' }, select: { id: true } })
    if (blog) return blog.id
  }
  return null
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname

  if (path.startsWith('/admin')) {
    return (await guardAdmin(req)) ?? NextResponse.next()
  }

  const blogId = await resolveBlogId(req)
  if (!blogId) {
    return NextResponse.rewrite(new URL('/not-found', req.url))
  }
  const requestHeaders = new Headers(req.headers)
  requestHeaders.delete('x-blog-id') // never trust an inbound value
  requestHeaders.set('x-blog-id', blogId)
  return NextResponse.next({ request: { headers: requestHeaders } })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)'],
}
```

- [ ] **Step 2: Create the not-found route**

`apps/gr8loci/app/not-found.tsx`:

```tsx
import { Container, Heading, Stack, Text } from '@platform/design-system'

export default function NotFound() {
  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={4} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={1}>Not found</Heading>
          <Text>This address isn’t available.</Text>
        </Stack>
      </Container>
    </main>
  )
}
```

- [ ] **Step 3: Build to verify middleware compiles on Node runtime**

Run: `pnpm --filter gr8loci build`
Expected: build succeeds; middleware listed. If the build errors that Prisma can’t run in middleware, confirm `export const runtime = 'nodejs'` is present.

- [ ] **Step 4: Manual smoke (dev)**

Run: `pnpm --filter gr8loci dev` then visit `http://localhost:3005` (resolves tenant-0) and `http://nope.localhost:3005` (404). Stop the server.

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci/middleware.ts apps/gr8loci/app/not-found.tsx
git commit -m "feat(gr8loci): resolve tenant from hostname in middleware"
```

---

## Task 8: Tenant context + re-scope public data + theme

**Files:**
- Create: `apps/gr8loci/lib/tenant-context.ts`
- Modify: `apps/gr8loci/lib/content.ts`, `apps/gr8loci/app/layout.tsx`, `app/page.tsx`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/about/page.tsx`

**Interfaces:**
- Consumes: `forBlog` (Task 4); `x-blog-id` header (Task 7).
- Produces:
  - `getBlogId(): Promise<string>` — reads `x-blog-id`; throws if absent (programming error).
  - `getTenantDb(): Promise<ScopedPrisma>` — `forBlog(await getBlogId())`.
  - `getCurrentBlog(): Promise<{ id: string; slug: string; name: string; defaultLayout: string }>` — the sanctioned read of the resolved blog's own registry row (uses `forPlatform()` internally so page code never imports it).
  - content functions now take a scoped db: `getPublishedBlogPosts(db)`, `getBlogPostBySlug(db, slug)`, `getPageBySlug(db, slug)`.

- [ ] **Step 1: Write the tenant-context helper**

`apps/gr8loci/lib/tenant-context.ts`:

```ts
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
```

- [ ] **Step 2: Re-scope `lib/content.ts`**

Change each function to accept the scoped client and use `findFirst` (never `findUnique`) on tenant models:

```ts
import type { RichContentSchema as RichContent } from '@platform/design-system'
import type { ScopedPrisma } from './db/tenant'
// ...types unchanged...

export async function getPublishedBlogPosts(db: ScopedPrisma): Promise<BlogPostSummary[]> {
  return db.blogPost.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, slug: true, title: true, excerpt: true, heroImageUrl: true, heroImageAlt: true, publishedAt: true },
  })
}

export async function getBlogPostBySlug(db: ScopedPrisma, slug: string): Promise<BlogPost | null> {
  const row = await db.blogPost.findFirst({ where: { slug, status: 'published' } })
  if (!row) return null
  return { id: row.id, slug: row.slug, title: row.title, excerpt: row.excerpt, heroImageUrl: row.heroImageUrl, heroImageAlt: row.heroImageAlt, publishedAt: row.publishedAt, content: row.content as unknown as RichContent }
}

export async function getPageBySlug(db: ScopedPrisma, slug: string): Promise<PageEntity | null> {
  const row = await db.page.findFirst({ where: { slug } }) // was findUnique
  if (!row) return null
  return { id: row.id, slug: row.slug, title: row.title, content: row.content as unknown as RichContent }
}
```

- [ ] **Step 3: Update the public pages to pass the scoped db**

`app/page.tsx` and `app/blog/page.tsx`: add `const db = await getTenantDb()` and call `getPublishedBlogPosts(db)`.
`app/blog/[slug]/page.tsx`: `const db = await getTenantDb()` then `getBlogPostBySlug(db, slug)` (in both `generateMetadata` and the page).
`app/about/page.tsx`: `getPageBySlug(await getTenantDb(), 'about')`.
Import: `import { getTenantDb } from '@/lib/tenant-context'`.

- [ ] **Step 4: Theme the layout by resolved tenant slug**

`app/layout.tsx`: replace the `process.env.BRAND_SLUG` theme wiring. Use `getCurrentBlog()` for the resolved tenant's slug, and pass the platform client to `ThemeStyle` (it reads `brandTheme` by slug — a platform read; `app/layout.tsx` is allowlisted for `forPlatform`):

```tsx
import { ThemeStyle } from '@platform/design-system/runtime'
import { forPlatform } from '@/lib/db/platform'
import { getCurrentBlog } from '@/lib/tenant-context'
// ...
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const blog = await getCurrentBlog()
  return (
    <html lang="en">
      <head><ThemeStyle prisma={forPlatform()} slug={blog.slug} /></head>
      <body>{/* SiteHeader / children / SiteFooter unchanged */}</body>
    </html>
  )
}
```

(Note: `lib/content.ts` no longer imports the raw client — remove the temporary `basePrisma` import added in Task 3; it now only imports the `ScopedPrisma` type. **Also remove the temporary `'lib/content.ts'` entry from the lint `ignores` added in Task 3.** The other public pages import `getTenantDb`/`getCurrentBlog` from `@/lib/tenant-context`, never `forPlatform`/`basePrisma` directly.)

- [ ] **Step 5: Build + run the existing e2e suite**

Run: `pnpm --filter gr8loci build` → PASS
Run: `pnpm --filter gr8loci test:e2e` → the F1 smoke specs + F2 theme spec PASS against tenant-0 (home, blog, post, about render identically).

- [ ] **Step 6: Commit**

```bash
git add apps/gr8loci/lib apps/gr8loci/app
git commit -m "feat(gr8loci): scope public reads + theme to the resolved tenant"
```

---

## Task 9: Layout-selection seam

**Files:**
- Create: `apps/gr8loci/app/_layouts/registry.ts`, `DefaultLayout.tsx`, `LayoutRenderer.tsx`
- Modify: `apps/gr8loci/app/page.tsx`, `app/blog/page.tsx`, `app/blog/[slug]/page.tsx`, `app/about/page.tsx`

**Interfaces:**
- Produces:
  - `LAYOUTS: Record<string, React.ComponentType<{ children: React.ReactNode }>>` with key `'default'`.
  - `<LayoutRenderer layoutKey={...}>children</LayoutRenderer>` — picks `LAYOUTS[layoutKey] ?? LAYOUTS.default`.
  - `resolveLayoutKey(blog.defaultLayout, page?.layoutKey)` helper.

- [ ] **Step 1: Create the default layout (current arrangement)**

`apps/gr8loci/app/_layouts/DefaultLayout.tsx`:

```tsx
export function DefaultLayout({ children }: { children: React.ReactNode }) {
  return <main>{children}</main>
}
```

- [ ] **Step 2: Create the registry + resolver**

`apps/gr8loci/app/_layouts/registry.ts`:

```ts
import type { ComponentType, ReactNode } from 'react'
import { DefaultLayout } from './DefaultLayout'

export const LAYOUTS: Record<string, ComponentType<{ children: ReactNode }>> = {
  default: DefaultLayout,
}

export function resolveLayoutKey(blogDefault: string, pageKey?: string | null): string {
  const key = pageKey ?? blogDefault ?? 'default'
  return key in LAYOUTS ? key : 'default'
}
```

- [ ] **Step 3: Create the renderer**

`apps/gr8loci/app/_layouts/LayoutRenderer.tsx`:

```tsx
import type { ReactNode } from 'react'
import { LAYOUTS } from './registry'

export function LayoutRenderer({ layoutKey, children }: { layoutKey: string; children: ReactNode }) {
  const Layout = LAYOUTS[layoutKey] ?? LAYOUTS.default
  return <Layout>{children}</Layout>
}
```

- [ ] **Step 4: Render public pages through the seam**

In each public page, replace the bare `<main>...</main>` wrapper with `<LayoutRenderer layoutKey={...}>...</LayoutRenderer>`. Resolve the key from the blog’s `defaultLayout` (and `page.layoutKey` for `about`). Minimal example for `app/page.tsx`:

```tsx
import { LayoutRenderer } from '@/app/_layouts/LayoutRenderer'
import { resolveLayoutKey } from '@/app/_layouts/registry'
import { getCurrentBlog } from '@/lib/tenant-context'
// ...
const blog = await getCurrentBlog()
const layoutKey = resolveLayoutKey(blog.defaultLayout)
return (
  <LayoutRenderer layoutKey={layoutKey}>
    {/* existing HeroSection + Container content */}
  </LayoutRenderer>
)
```

For `app/about/page.tsx`, pass the page's own key: `resolveLayoutKey(blog.defaultLayout, page.layoutKey)`.

(The single `default` layout renders `<main>`, so output is identical to today.)

- [ ] **Step 5: Build + e2e**

Run: `pnpm --filter gr8loci build && pnpm --filter gr8loci test:e2e`
Expected: PASS — no visual change.

- [ ] **Step 6: Commit**

```bash
git add apps/gr8loci/app
git commit -m "feat(gr8loci): add public layout-selection seam (single default layout)"
```

---

## Task 10: Tailwind + shadcn scaffolding (admin-scoped)

**Files:**
- Create: `apps/gr8loci/tailwind.config.ts`, `postcss.config.mjs`, `app/admin.css`, `components/ui/button.tsx`, `lib/utils.ts`
- Create: `apps/gr8loci/app/(admin)/layout.tsx`
- Modify: `apps/gr8loci/package.json` (devDeps)

**Interfaces:**
- Produces: Tailwind utilities + a shadcn `Button` usable **only** under `(admin)`. Public pages never import `admin.css`, so preflight does not leak.

- [ ] **Step 1: Add dependencies**

Run:
```bash
pnpm --filter gr8loci add -D tailwindcss postcss autoprefixer
pnpm --filter gr8loci add class-variance-authority clsx tailwind-merge lucide-react
```

- [ ] **Step 2: Tailwind + PostCSS config scoped to admin**

`apps/gr8loci/tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./app/(admin)/**/*.{ts,tsx}', './components/ui/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
} satisfies Config
```

`apps/gr8loci/postcss.config.mjs`:

```js
export default { plugins: { tailwindcss: {}, autoprefixer: {} } }
```

- [ ] **Step 3: Admin CSS entry + utils + Button**

`apps/gr8loci/app/admin.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`apps/gr8loci/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }
```

`apps/gr8loci/components/ui/button.tsx`:

```tsx
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50',
  {
    variants: {
      variant: { default: 'bg-slate-900 text-white hover:bg-slate-800', outline: 'border border-slate-300 hover:bg-slate-100' },
      size: { default: 'h-9 px-4 py-2', sm: 'h-8 px-3' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
})
Button.displayName = 'Button'
```

Run: `pnpm --filter gr8loci add @radix-ui/react-slot`

- [ ] **Step 4: Admin layout imports the Tailwind base (and only here)**

`apps/gr8loci/app/(admin)/layout.tsx`:

```tsx
import '../admin.css'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50 text-slate-900">{children}</div>
}
```

- [ ] **Step 5: Build + verify public site unaffected**

Run: `pnpm --filter gr8loci build` → PASS
Run: `pnpm --filter gr8loci test:e2e` → public smoke specs PASS (no preflight regression — public pages never import `admin.css`).

- [ ] **Step 6: Commit**

```bash
git add apps/gr8loci
git commit -m "feat(gr8loci): scaffold admin-scoped Tailwind/shadcn (Button)"
```

---

## Task 11: Active-tenant cookie + tenant switcher

**Files:**
- Create: `apps/gr8loci/lib/active-blog.ts`
- Create: `apps/gr8loci/app/(admin)/admin/_components/TenantSwitcher.tsx`
- Modify: `apps/gr8loci/app/(admin)/admin/page.tsx`

**Interfaces:**
- Consumes: `forPlatform()`.
- Produces:
  - `getActiveBlog(): Promise<{ id: string; slug: string; name: string }>` — reads `active_blog` cookie; defaults to the `gr8loci` blog.
  - `setActiveBlogAction(formData)` — server action setting the cookie and redirecting to `/admin`.
  - `getAdminDb(): Promise<ScopedPrisma>` — `forBlog(activeBlog.id)`.

- [ ] **Step 1: Active-blog helpers + action**

`apps/gr8loci/lib/active-blog.ts` — **no file-level `'use server'`** (the read helpers return a non-serializable client and must stay plain server functions); the action gets an inline directive:

```ts
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { forPlatform } from './db/platform'
import { forBlog, type ScopedPrisma } from './db/tenant'

export async function getActiveBlog() {
  const id = (await cookies()).get('active_blog')?.value
  const db = forPlatform()
  const blog = (id && (await db.blog.findUnique({ where: { id }, select: { id: true, slug: true, name: true } })))
    || (await db.blog.findUnique({ where: { slug: 'gr8loci' }, select: { id: true, slug: true, name: true } }))
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
```

- [ ] **Step 2: Tenant switcher component**

`apps/gr8loci/app/(admin)/admin/_components/TenantSwitcher.tsx`:

```tsx
import { forPlatform } from '@/lib/db/platform'
import { getActiveBlog, setActiveBlogAction } from '@/lib/active-blog'
import { Button } from '@/components/ui/button'

export async function TenantSwitcher() {
  const [blogs, active] = await Promise.all([
    forPlatform().blog.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    getActiveBlog(),
  ])
  return (
    <form action={setActiveBlogAction} className="flex items-center gap-2">
      <select name="blogId" defaultValue={active.id} className="h-9 rounded-md border border-slate-300 px-2">
        {blogs.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <Button type="submit" size="sm" variant="outline">Switch</Button>
    </form>
  )
}
```

- [ ] **Step 3: Mount it on the admin home**

Modify `app/(admin)/admin/page.tsx` to render `<TenantSwitcher />` and show the active blog name (replace the F4 placeholder copy). Keep `initAuthForRequest()` + sign-out.

- [ ] **Step 4: Build + manual check**

Run: `pnpm --filter gr8loci build` → PASS. Dev: sign in at `/admin/login`, confirm the switcher lists tenant-0.

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci
git commit -m "feat(gr8loci): add admin active-tenant cookie + tenant switcher"
```

---

## Task 12: Admin — list & create blogs

**Files:**
- Create: `apps/gr8loci/app/(admin)/admin/blogs/page.tsx`
- Create: `apps/gr8loci/app/(admin)/admin/blogs/actions.ts`

**Interfaces:**
- Consumes: `forPlatform()`.
- Produces: `createBlogAction(formData)` — creates a `Blog` (slug, name) + a `super_admin` `Membership` for the current admin; revalidates `/admin/blogs`.

- [ ] **Step 1: Create-blog server action**

`apps/gr8loci/app/(admin)/admin/blogs/actions.ts`:

```ts
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
```

- [ ] **Step 2: Blogs list + create form page**

`apps/gr8loci/app/(admin)/admin/blogs/page.tsx`:

```tsx
import { forPlatform } from '@/lib/db/platform'
import { Button } from '@/components/ui/button'
import { createBlogAction } from './actions'

export default async function BlogsPage() {
  const blogs = await forPlatform().blog.findMany({ orderBy: { createdAt: 'desc' }, select: { id: true, slug: true, name: true, status: true } })
  return (
    <div className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Blogs</h1>
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
        {blogs.map((b) => (
          <li key={b.id} className="flex justify-between p-3"><span>{b.name}</span><span className="text-slate-500">{b.slug} · {b.status}</span></li>
        ))}
      </ul>
      <form action={createBlogAction} className="space-y-3 rounded-md border border-slate-200 p-4">
        <h2 className="font-medium">Create blog</h2>
        <input name="name" placeholder="Name" className="h-9 w-full rounded-md border border-slate-300 px-2" />
        <input name="slug" placeholder="slug (a-z0-9-)" className="h-9 w-full rounded-md border border-slate-300 px-2" />
        <Button type="submit">Create</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Build + manual check**

Run: `pnpm --filter gr8loci build` → PASS. Dev: create a `demo` blog; visit `http://demo.localhost:3005` → renders (empty post list, default theme).

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/app
git commit -m "feat(gr8loci): admin blog list + create"
```

---

## Task 13: Admin — assign domains

**Files:**
- Create: `apps/gr8loci/app/(admin)/admin/domains/page.tsx`
- Create: `apps/gr8loci/app/(admin)/admin/domains/actions.ts`

**Interfaces:**
- Consumes: `forPlatform()`.
- Produces: `addDomainAction(formData)` — creates a `Domain` (hostname, blogId, `verifiedAt = now()` in P1) and revalidates.

- [ ] **Step 1: Add-domain action**

`apps/gr8loci/app/(admin)/admin/domains/actions.ts`:

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { forPlatform } from '@/lib/db/platform'

export async function addDomainAction(formData: FormData): Promise<void> {
  const hostname = String(formData.get('hostname') ?? '').trim().toLowerCase()
  const blogId = String(formData.get('blogId') ?? '')
  if (!hostname || !blogId) throw new Error('hostname and blogId required')
  await forPlatform().domain.create({ data: { hostname, blogId, verifiedAt: new Date() } })
  revalidatePath('/admin/domains')
}
```

- [ ] **Step 2: Domains page (list + add form)**

`apps/gr8loci/app/(admin)/admin/domains/page.tsx`:

```tsx
import { forPlatform } from '@/lib/db/platform'
import { Button } from '@/components/ui/button'
import { addDomainAction } from './actions'

export default async function DomainsPage() {
  const db = forPlatform()
  const [domains, blogs] = await Promise.all([
    db.domain.findMany({ orderBy: { hostname: 'asc' }, select: { id: true, hostname: true, isPrimary: true, blog: { select: { name: true } } } }),
    db.blog.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ])
  return (
    <div className="mx-auto max-w-2xl p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Domains</h1>
      <ul className="divide-y divide-slate-200 rounded-md border border-slate-200">
        {domains.map((d) => (
          <li key={d.id} className="flex justify-between p-3">
            <span>{d.hostname}{d.isPrimary ? ' (primary)' : ''}</span>
            <span className="text-slate-500">{d.blog.name}</span>
          </li>
        ))}
      </ul>
      <form action={addDomainAction} className="space-y-3 rounded-md border border-slate-200 p-4">
        <h2 className="font-medium">Add domain</h2>
        <input name="hostname" placeholder="hostname (e.g. blog.example.com)" className="h-9 w-full rounded-md border border-slate-300 px-2" />
        <select name="blogId" className="h-9 w-full rounded-md border border-slate-300 px-2">
          {blogs.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <Button type="submit">Add</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Build + manual check**

Run: `pnpm --filter gr8loci build` → PASS. Dev: add `demo.example.test` → tenant; confirm a row appears. (Actual DNS/SSL provisioning is P4.)

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/app
git commit -m "feat(gr8loci): admin domain assignment"
```

---

## Task 14: Re-scope admin content views to the active tenant

**Files:**
- Modify: `apps/gr8loci/app/(admin)/admin/page.tsx` (and any admin content reads)

**Interfaces:**
- Consumes: `getAdminDb()` (Task 11).
- Produces: admin content reads/writes go through `getAdminDb()` (= `forBlog(activeBlog.id)`), proving the scoped path end-to-end in the admin.

- [ ] **Step 1: Use the scoped admin db**

On the admin home, fetch a quick count via the scoped client to demonstrate scoping:

```tsx
import { getActiveBlog, getAdminDb } from '@/lib/active-blog'
// ...
const active = await getActiveBlog()
const postCount = await (await getAdminDb()).blogPost.count()
// render: Active tenant: {active.name} — {postCount} posts
```

- [ ] **Step 2: Build + e2e (admin guard still works)**

Run: `pnpm --filter gr8loci build && pnpm --filter gr8loci test:e2e`
Expected: PASS — the admin route-guard e2e still redirects unauthenticated `/admin`.

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/app
git commit -m "feat(gr8loci): scope admin content views to the active tenant"
```

---

## Task 15: Docs — CLAUDE.md + handoff updates

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/superpowers/handoff/README.md`

**Interfaces:** none (documentation).

- [ ] **Step 1: Update `CLAUDE.md`**

Apply the vision-doc §10 changes that P1 realizes: state **row-level multi-tenancy** (one app, `blogId` on tenant rows); add the rule **"no unscoped Prisma in app code — use `forBlog(blogId)`; `forPlatform()` for cross-tenant"**; note **Tailwind/shadcn adopted, admin-scoped in P1** (public stays CSS Modules until P2); note **CI now requires a Postgres service**; note dev subdomains use `*.localhost`. Update the "Current status" block: F2 complete (merged), **P1 in progress**, Clerk is **P1.5**.

- [ ] **Step 2: Update the handoff README**

Add an `## As of 2026-06-21` entry: F2 shipped/merged; P1 (tenancy foundation) delivered — models, middleware resolution, `forBlog`/`forPlatform`, admin shell, tenant-0 migration, layout seam. "What's next": **P1.5 (Clerk)**, then **P2 (content & block/page builder + public layout library)**.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/superpowers/handoff/README.md
git commit -m "docs: reflect P1 multi-tenancy, forBlog rule, admin Tailwind, CI Postgres"
```

---

## Final verification (run before opening the PR)

- [ ] `pnpm --filter gr8loci lint` → PASS (lint guard active)
- [ ] `pnpm --filter gr8loci typecheck` → PASS
- [ ] `pnpm --filter gr8loci test` → PASS (incl. `tenant-scope` leak-guard + `hostname` resolver, run against a DB)
- [ ] `pnpm --filter gr8loci build` → PASS
- [ ] `pnpm --filter gr8loci test:e2e` → PASS (public site + admin guard unchanged for tenant-0)
- [ ] Manual: `gr8loci.localhost:3005` and `demo.localhost:3005` resolve to different tenants; unknown host → 404; `www`/apex resolve to tenant-0.

---

## Spec coverage map

| Spec § | Task(s) |
| --- | --- |
| §2 data model (Blog/Membership/Domain, blogId FKs, per-tenant unique, layoutKey) | 1, 2 |
| §3 middleware resolution (Domain-first, subdomain, 404, header, `*.localhost`) | 6, 7 |
| §4 forBlog extension + containment + escape hatch + leak-guard | 3, 4, 5 |
| §5 stub super-admin + active-tenant + Membership scoping | 11, 12, 14 |
| §6 admin shadcn shell (scoped Tailwind, blog/domain pages, switcher) | 10, 11, 12, 13 |
| §7 layout-selection seam (one default) | 9 |
| §8 tenant-0 migration (nullable→backfill→non-null) | 1, 2 |
| §9 testing (leak-guard, resolver, migration/integration, e2e) | 4, 6, 8, 14, Final |
| §11 docs (CLAUDE.md, handoff, CI-needs-DB) | 15 |
