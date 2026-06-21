# P1 — Tenancy Foundation — Design Spec

**Date:** 2026-06-21
**Status:** Design (approved in brainstorm) — ready for implementation plan
**Parent vision:** [`2026-06-06-multi-tenant-platform-vision-design.md`](./2026-06-06-multi-tenant-platform-vision-design.md) §6 (P1 row)
**Predecessor:** F2 (runtime theme engine) — merged to `main` (PR #1, merge commit `4eaa14a`)

> This is the detailed design for **P1**, the first increment of the multi-tenant
> platform program. It refines the vision-doc P1 scope with concrete decisions made
> during brainstorming. The increment delivers a working multi-tenant public blog on
> subdomains, on the **existing stub auth**, with the live `gr8loci.online` site
> preserved. Clerk is deliberately deferred to a tight follow-on (P1.5).

---

## 1. Scope & sequencing

### 1.1 Decisions taken in brainstorming

These choices refine the vision doc and govern the rest of this spec:

1. **Tenancy first, Clerk as P1.5.** P1 builds the full multi-tenant foundation on the
   **existing stub auth**, scoped per tenant. The Clerk swap becomes a separate, tight
   follow-on increment (P1.5). This shrinks P1 and keeps external-service integration
   risk out of the foundational increment. *(Reverses the vision doc's "Clerk in P1"
   only in timing — Clerk is still the next thing after tenancy.)*
2. **Single super-admin across all tenants.** The one stub admin becomes a global
   `super_admin` with access to every tenant; the admin shell has a tenant switcher.
   The `Membership`/role model is **defined** and **used for data scoping**, but
   multi-user role *enforcement* waits for Clerk (P1.5).
3. **Apex `gr8loci.online` = tenant-0.** The migrated gr8loci blog is served at the
   apex (and `www`) via a `Domain`-table mapping; new blogs get `slug.gr8loci.online`.
   No platform landing page in P1 — unknown hosts → 404. Preserves the live site's
   URLs and SEO exactly.
4. **Tenant-scoped data access via a Prisma Client Extension factory** (`forBlog`).
   App code only ever receives a scoped client; the raw client is not importable by
   app code; a named escape hatch covers platform operations.
5. **Tailwind/shadcn scoped to the admin shell** in P1; the public site stays on the
   existing CSS-Modules primitives. P1 introduces a **layout-selection seam** on the
   public side (one default layout); the actual shadcn layout library + presets land
   in **P2**.

### 1.2 P1 delivers

- `Blog`, `Membership`, `Domain` Prisma models; `blogId` added to `BlogPost`, `Page`,
  `BrandTheme`.
- Hostname→tenant resolution in `middleware.ts` (subdomains + apex/custom-host via
  `Domain` table).
- A mandatory **tenant-scoped data-access layer** (`forBlog(blogId)` extension factory)
  plus a named platform/super-admin escape hatch.
- A shadcn/Tailwind **admin shell** (scoped to the `(admin)` route group) with: blog
  list + create, domain assignment, tenant switcher, and the existing post/page admin
  re-scoped to the active tenant.
- Existing gr8loci content migrated into **tenant-0**; live `gr8loci.online` preserved.
- A **layout-selection seam** (`LayoutRenderer` + layout key) on the public side, with
  one default layout (the current gr8loci arrangement, unchanged visually).

### 1.3 P1 explicitly defers

| Deferred | To |
| --- | --- |
| Clerk (real multi-user auth, hosted UI/SSO) | **P1.5** |
| Operator/editor role *enforcement* (model is defined now) | **P1.5** (with Clerk) |
| Public-side shadcn/Tailwind migration + layout library/presets | **P2** |
| Block/page builder, contact form + Turnstile | **P2** |
| Media (DO Spaces) | **P3** |
| Custom-domain provisioning/verification (model stub exists) | **P4** |
| Notification banners | **P5** |
| Email capture + newsletters | **P6** |
| Platform landing page | later (not scheduled) |
| Operator self-signup / billing | never (invited operators only) |

---

## 2. Data model

Additive over the current schema (`BlogPost`, `Page`, `AdminUser`, `BrandTheme`).

### 2.1 New models

**`Blog`** — the tenant.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `slug` | `String @unique` | subdomain label (`slug.gr8loci.online`) |
| `name` | `String` | display name |
| `status` | `BlogStatus @default(active)` | enum `active` / `disabled` |
| `defaultLayout` | `String @default("default")` | layout key (see §7) |
| `createdAt` / `updatedAt` | timestamps | |

Theme linkage: a `Blog` resolves its theme by `slug` against `BrandTheme.slug` (F2
already keys themes by slug; tenant-0's slug is `gr8loci`). No separate FK needed in P1
— documented so P2/later can formalize if useful.

**`Membership`** — links a user to a blog with a role.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `userId` | `String` | references the stub `AdminUser.id` now; becomes the Clerk user id in P1.5 |
| `blogId` | `String` | FK → `Blog` |
| `role` | `Role @default(editor)` | enum `super_admin` / `operator_admin` / `editor` |
| `createdAt` | timestamp | |
| | `@@unique([userId, blogId])` | one membership per user per blog |

**`Domain`** — hostname → blog mapping (also covers the apex).

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `String @id @default(cuid())` | |
| `hostname` | `String @unique` | exact host, lowercased (e.g. `gr8loci.online`, `www.gr8loci.online`) |
| `blogId` | `String` | FK → `Blog` |
| `isPrimary` | `Boolean @default(false)` | the canonical host for the blog |
| `verifiedAt` | `DateTime?` | null until P4 provisioning; seeded rows are pre-verified |
| `createdAt` | timestamp | |

### 2.2 Enums

```prisma
enum BlogStatus { active disabled }
enum Role       { super_admin operator_admin editor }
```

### 2.3 Changed models

`BlogPost`, `Page`, `BrandTheme` each gain:

- `blogId String` + `blog Blog @relation(...)`
- Slug uniqueness becomes **per-tenant**: drop global `@@unique`/`slug @unique`, add
  `@@unique([blogId, slug])`.
- Composite index `@@index([blogId, ...])` where the current single-column indexes
  exist (e.g. `BlogPost` `@@index([blogId, status, publishedAt])`).

`Page` also gains `layoutKey String?` (falls back to `Blog.defaultLayout`).

`AdminUser` is retained unchanged as the stub user table; `Membership.userId`
references it in P1.

---

## 3. Request flow & middleware

```
visitor → Vercel edge → middleware.ts (hostname resolution)
   ├─ exact Domain hostname match    → Domain → blogId (covers apex + www gr8loci.online → tenant-0, and custom domains)
   ├─ else host matches *.gr8loci.online → subdomain label = blog slug → Blog by slug
   └─ no match                       → 404  (platform landing deferred)
        ↓ resolved blogId attached to request via header
   RSC / route handler → getTenantContext() → forBlog(blogId) → Postgres
```

### 3.1 Resolution rules (`middleware.ts`)

Order matters — **exact `Domain` match is checked first** so that hosts which also
*look* like subdomains (notably `www.gr8loci.online`) resolve via their `Domain` row
rather than being parsed as a `www` slug.

- Parse and lowercase the request host (strip port).
- **First:** look up `Domain` by exact `hostname`. This resolves the apex
  `gr8loci.online`, `www.gr8loci.online`, the dev hosts, and (P4) custom domains →
  tenant-0 (or the owning blog).
- **Else, if** host is `<label>.gr8loci.online`: resolve `Blog` by `slug = <label>`.
  *(Subdomains resolve by slug and need no `Domain` row.)*
- Unknown / unmatched host → **404** (Next `NextResponse.rewrite` to a not-found, or
  pass-through to a 404 route).
- `disabled` blogs → 404 (treated as not-found publicly).
- On success, set a request header (e.g. `x-blog-id`) carried to RSCs/route handlers.
  *(Middleware cannot share JS objects with the React tree; a request header is the
  App-Router-friendly channel. The header is internal — stripped/ignored from inbound
  client requests so it can't be spoofed.)*

### 3.2 Tenant context helper

`getTenantContext()` (server-only) reads `x-blog-id` from headers and returns
`{ blogId }`. Public RSCs call it, then use `forBlog(blogId)` for all data. A missing
context in a public data path is a programming error (throws in dev).

### 3.3 Admin routes

`/admin/*` are **not** hostname-scoped. The super-admin's **active tenant** (cookie,
§5) determines `blogId`. The existing `/admin` auth guard in `middleware.ts` is
retained and runs alongside hostname resolution.

### 3.4 Local development

- Subdomains use **`*.localhost`**: `gr8loci.localhost:3005`, `acme.localhost:3005`,
  etc. — resolves to `127.0.0.1` natively in modern browsers, no hosts-file edits.
- Apex local: `localhost:3005` → tenant-0 via a seeded `Domain` row (`localhost`).
- `lvh.me` documented as a fallback for tooling that doesn't honor `*.localhost`.

---

## 4. Tenant-scoped data-access layer

The enforced realization of "**no unscoped Prisma in application code**."

### 4.1 `forBlog(blogId)` factory

- Returns a Prisma Client created with `$extends`, wrapping the tenant-owned models
  (`BlogPost`, `Page`, `BrandTheme`):
  - **reads** (`findMany`, `findFirst`, `findUnique*`, `count`, `aggregate`): inject
    `blogId` into `where`.
  - **writes** (`create`, `createMany`): set `blogId` on the data.
  - **updates/deletes** (`update*`, `delete*`, `upsert`): inject `blogId` into `where`.
- App code (public RSCs, admin actions) receives **only** a `forBlog(...)` client.

### 4.2 Raw client containment

- The base `PrismaClient` instance lives in a module not imported by app code
  (e.g. `@/lib/db/base` or a `packages/db` internal path).
- An ESLint `no-restricted-imports` rule forbids importing the raw client path outside
  the data-access module and the platform/escape-hatch module.

### 4.3 Platform / super-admin escape hatch

- A separate, explicitly named export — **`forPlatform()`** — returns the unscoped
  client for genuine cross-tenant operations: create/list blogs, resolve hostnames,
  super-admin tooling. Symmetric with `forBlog()` so call sites read clearly.
- Usage is deliberately conspicuous for review; the lint allowlist permits the raw
  client only inside `forBlog`/`forPlatform` and the platform/admin module.

### 4.4 Isolation leak-guard test (central contract)

A dedicated test:
1. Creates blogs A and B, each with `BlogPost`/`Page`/`BrandTheme` rows (including a
   **shared slug** across tenants to prove per-tenant uniqueness + scoping).
2. Asserts a `forBlog(A)` client **cannot** read, update, or delete B's rows via
   `findMany`, `findUnique`-by-shared-slug, `updateMany`, `delete`, `count`.
3. Asserts creates via `forBlog(A)` always land with `blogId = A`.

This test is the isolation guarantee and must pass for P1 to ship.

---

## 5. Auth in P1 (stub retained)

- **Single super-admin** = the existing stub admin, treated as `role: super_admin`
  with implicit access to all tenants. Login flow (`@platform/auth` stub) unchanged.
- **Active-tenant selection:** the admin shell shows a **tenant switcher** (all blogs).
  The selected `blogId` is stored in a cookie (e.g. `active_blog`); admin data
  operations use `forBlog(activeBlogId)`. Default on first login: tenant-0.
- **`Membership` is written and used for scoping** — the seed creates a `super_admin`
  membership for the stub admin. Multi-user **role enforcement**
  (operator_admin/editor boundaries) is deferred to P1.5.
- `@platform/auth` remains the single auth seam; Clerk swaps behind it in P1.5 without
  touching consumers.

---

## 6. Admin shell (shadcn/Tailwind, scoped)

- **Tailwind + shadcn initialized but scoped to the `(admin)` route group:** Tailwind
  `content` globs cover admin files only; the Tailwind base (preflight) is imported by
  the **admin layout**, not the root/public layout, so the live public CSS-Modules site
  is untouched.
- **Super-admin pages in P1 (minimal shell, not the full CMS):**
  - Blog list + **create blog** (slug, name).
  - **Domain** assignment per blog (seed/add a hostname row).
  - **Tenant switcher** (active-tenant cookie).
  - Existing **post/page admin**, re-scoped to the active tenant via `forBlog`.
- shadcn CSS variables wired to F2 tokens where practical so the admin reads on-brand.
- Full CMS/authoring (block builder, drafts) is **P2**.

---

## 7. Layout-selection seam

- **`LayoutRenderer`** (public side): public pages render *through* it. It resolves the
  layout key as `Page.layoutKey ?? Blog.defaultLayout` and dispatches to a layout
  component from a small **registry** (key → component).
- **P1 registry has exactly one layout** — the current gr8loci arrangement, refactored
  behind the seam, on the existing CSS-Modules primitives. **No visual change** to the
  live site.
- This establishes the data-driven extension point so **P2** can fill the registry with
  shadcn-based layouts + presets (themed per tenant via F2) without re-plumbing the
  public render path.

---

## 8. Tenant-0 migration

Sequenced to be safe on the live database:

1. **Migration A (additive, nullable):** add `Blog`/`Membership`/`Domain` models and
   enums; add `blogId` as **nullable** on `BlogPost`/`Page`/`BrandTheme`; add
   `Page.layoutKey`.
2. **Data migration:** create the `gr8loci` `Blog` (slug `gr8loci`, name, default
   layout `default`); seed `Domain` rows — `gr8loci.online` (primary), `www.gr8loci.online`,
   and dev hosts (`localhost`, `gr8loci.localhost`) — all `verifiedAt` set; backfill
   `blogId = <gr8loci blog id>` on all existing `BlogPost`/`Page`/`BrandTheme` rows;
   create a `super_admin` `Membership` for the stub admin user.
3. **Migration B (tighten):** make `blogId` **non-null**; drop the old global slug
   uniqueness; add `@@unique([blogId, slug])` and the composite indexes.

Verification: re-run the existing unit/integration/e2e suites against the migrated
schema — the live site must render identically (same URLs, same content, same theme).

---

## 9. Testing strategy

- **Isolation leak-guard** (§4.4) — the central new contract; cross-tenant access is
  impossible through `forBlog`.
- **Middleware resolution** unit tests — subdomain, apex/custom-host via `Domain`,
  unknown-host → 404, `disabled` blog → 404, `*.localhost` dev, internal header not
  spoofable from inbound requests.
- **Data-access extension** tests — `blogId` injection on create/read/update/delete;
  the escape hatch is the only unscoped path.
- **Migration/integration** — tenant-0 backfill correctness (no orphan rows; all
  content carries tenant-0's `blogId`); existing suites green post-migration.
- **TDD** for the data-access layer and the middleware resolver, per repo discipline.
- CI already runs a Postgres service + migrations (added during F2 merge), so these
  integration tests run in CI.

---

## 10. Non-goals (P1)

Clerk and role enforcement (P1.5) · public shadcn/Tailwind migration + layout
library/presets (P2) · block/page builder, contact form + Turnstile (P2) · media /
DO Spaces (P3) · custom-domain provisioning + verification (P4; model stub only) ·
notification banners (P5) · email capture + newsletters (P6) · platform landing page ·
operator self-signup / billing (never).

---

## 11. Cross-cutting notes

- **Tenant isolation discipline** is the defining constraint of this increment: no
  unscoped Prisma in app code; the leak-guard test enforces it.
- **`CLAUDE.md` + handoff updates** (from vision-doc §10) ride along with P1: note
  row-level multi-tenancy, the `forBlog` data-access rule, Tailwind/shadcn adoption
  (admin-scoped in P1), and that **CI now requires a Postgres service**.
- **Accessibility/SEO** carry forward from F1; per-tenant sitemap/robots is a P2 concern
  (single-tenant sitemap still valid for tenant-0 in P1).
