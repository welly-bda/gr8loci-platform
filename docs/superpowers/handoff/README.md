# Handoff — where we are now / what's next

Living document. Update at the end of every working session so the next session (human or Claude) can pick up cold.

## As of 2026-04-23

### Shipped

**F1 — monorepo foundation + first brand (gr8loci.online)** is complete and deployed. Tag: `f1-complete`.

Working surface:
- Turborepo + pnpm workspace with shared TS/ESLint/Prettier configs
- `@platform/design-system` — tokens (TS → generated CSS custom properties), 6 primitives (Button, Card, Typography, Layout, Input, Icon), RichContent JSON renderer
- `@platform/auth` — AuthProvider interface + JWT stub (swap target: Clerk, F4)
- `apps/gr8loci` — 4 public pages (`/`, `/blog`, `/blog/[slug]`, `/about`), admin login + middleware-guarded `/admin/*`
- Prisma schema (Post, Page, User), seeded demo content
- Vitest (unit) + Playwright (e2e smoke) suites
- GitHub Actions CI (lint → typecheck → build → test)
- Vercel prod + preview deploys wired; DO Postgres provisioned

### Recent adjustments (post-F1)

- Dev port moved 3000 → 3005 (BakersPinch collision)
- Playwright now runs its own server on 3007
- `typedRoutes` moved out of `experimental` (Next 15 stable)
- eslint-config + Vitest e2e exclusion cleanups

### What's next — F2

**Theme engine — runtime-editable tokens from admin UI.**

Current state: F1 ships CSS custom properties generated at build time from `packages/design-system/src/tokens/index.ts`. F2 swaps that build step for a runtime generator reading from a `BrandTheme` Prisma model. No component changes required — only the source of the CSS variables changes.

**Not yet scoped.** When ready, run `/brainstorm` in a fresh session. The F1 spec §Theme engine interoperability (lines ~170–200 of the spec doc) has the high-level architecture note. Design spec and implementation plan for F2 will live alongside F1's at `docs/superpowers/{specs,plans}/2026-MM-DD-f2-theme-engine*.md`.

### Open items / known debts

- **Auth stub is not production-grade.** Single hardcoded admin, plaintext-vs-env-var password check, no rate limiting. Acceptable while `/admin` has nothing valuable. Replace with Clerk in F4 (or a dedicated auth spec sooner if needed).
- **`heroImageUrl` is a plain string** on `Post`. F4 introduces a proper `Media` table.
- **No integration tests** against Prisma yet — deferred to F4 when CRUD lands.
- **No visual regression testing** — optional in F3.
- **Production data migration from legacy gr8loci-online site** — separate spec after F4.

### Archived references

- Predecessor repo: `~/Developer/ClaudeDev-local/gr8loci-online/` — legacy Node/Express site. F1 spec/plan originated there and were copied here on 2026-04-23; originals remain in place as archive.

## As of 2026-06-21

### Shipped

**F2 — runtime theme engine** is complete and merged into `main` (branch `f2-theme-engine`). `BrandTheme` Prisma model; `ThemeStyle` RSC injects CSS custom properties at runtime; build-time token generation removed.

**P1 — multi-tenant foundation** delivered on branch `p1-tenancy-foundation`:

- **Data model:** `Blog`, `Membership`, `Domain` models added; `blogId` FK on `BlogPost`, `Page`, `BrandTheme` (nullable → backfill → non-null migration). Per-tenant unique constraints. `layoutKey` field on `Blog` for layout-selection seam (one `default` layout in P1).
- **Hostname → tenant resolution** in `middleware.ts` (Node.js runtime, `experimental.nodeMiddleware`): exact `Domain` DB match first; then `*.gr8loci.online` subdomain → blog slug; unknown host → 404. Apex `gr8loci.online` + `www` resolve to tenant-0 (the migrated gr8loci blog). Dev: `*.localhost:3005` (e.g. `gr8loci.localhost:3005`, `demo.localhost:3005`).
- **`forBlog` / `forPlatform` data-access layer:** `getTenantDb()` / `getCurrentBlog()` for public routes; `getAdminDb()` for admin routes. `forPlatform()` is the cross-tenant escape hatch. ESLint guard + leak-guard test enforce no unscoped Prisma in app code.
- **Admin shell:** `(admin)` route group with Tailwind CSS + shadcn/ui (scoped to admin only; public site stays on CSS Modules until P2). Blog management, domain management, and tenant-switcher pages.
- **Tenant-0 migration:** existing gr8loci content backfilled to the `gr8loci` blog record.
- **Layout-selection seam:** `Blog.layoutKey` + a single `default` layout; the layout library lands in P2.
- **CI:** now requires a Postgres service + `prisma migrate deploy` before build (pages prerender against the DB).

### What's next

- **P1.5 — Clerk:** replace the auth stub with Clerk; per-tenant `Membership` role enforcement.
- **P2 — content & block/page builder + public layout library:** full CMS primitives, block editor, and the layout-selection UI backed by `Blog.layoutKey`.

### Open items / known debts (P1)

- Auth stub still in use — single super-admin across all tenants, no rate limiting. **Do not expose to public production without Clerk (P1.5).**
- `heroImageUrl` remains a plain string; a `Media` table is a future milestone.
- Visual regression testing not yet in place.

---

## Template for future entries

```
## As of YYYY-MM-DD

### Shipped
...

### What's next
...

### Open items
...
```
