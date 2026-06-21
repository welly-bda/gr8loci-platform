# CLAUDE.md

Project context for Claude Code sessions. Keep this short and load-bearing.

## What this is

Multi-tenant content platform. ONE Next.js app (`apps/gr8loci/`) serves all tenants via row-level tenancy — every tenant-owned row carries a `blogId` FK. Turborepo monorepo; shared packages in `packages/*`.

**Predecessor repo:** `~/Developer/ClaudeDev-local/gr8loci-online/` — the legacy monolithic Node/Express GR8LOCI site. This repo replaces it. F1 design/plan originated there and was copied into this repo's `docs/superpowers/`.

## Current status

- **F1 (monorepo foundation + gr8loci.online shipping)** — complete. Tagged `f1-complete`.
- **F2 (theme engine — runtime-editable tokens)** — complete. Merged into `main` (branch `f2-theme-engine`). `BrandTheme` model; `ThemeStyle` RSC; runtime CSS vars.
- **P1 (multi-tenant foundation)** — **in progress** (branch `p1-tenancy-foundation`). See `docs/superpowers/handoff/README.md`.
- **P1.5** — Clerk auth (replaces stub for real per-tenant roles).
- **P2** — content & block/page builder + public layout library.
- **P3–P6** — see `docs/superpowers/specs/2026-06-06-multi-tenant-platform-vision-design.md`.

## Stack

Next.js 15 (App Router) • React 19 • TypeScript strict • Prisma 6 + PostgreSQL 16 • jose (stub auth) → Clerk (P1.5) • CSS Modules + CSS custom properties (public) • Tailwind CSS + shadcn/ui (admin, P1+) • Vitest + Playwright • Turborepo + pnpm 9 • Vercel + DigitalOcean managed Postgres.

## Repo layout

```
apps/gr8loci/          Next.js 15 app — first brand
packages/
  design-system/       Tokens + 6 UI primitives + RichContent renderer
  auth/                AuthProvider interface + stub impl (swap target: Clerk)
  config-typescript/   Shared TS configs
  config-eslint/       Shared ESLint flat config
  config-prettier/     Shared Prettier config
docs/
  superpowers/specs/   Design docs (authoritative for scope)
  superpowers/plans/   Implementation plans (step-by-step)
  superpowers/handoff/ Current-state handoff notes
  architecture/        System design (WIP)
  decisions/           ADRs (WIP)
  runbooks/            Ops procedures (WIP)
```

Obsidian vault mirror: `~/Documents/vault-dw2-notes-remote/04-Projects/gr8loci_newBuild/`.

## Ports

- **3005** — `pnpm --filter gr8loci dev` (changed from 3000 to avoid BakersPinch collision). Dev subdomains use `*.localhost:3005` (e.g. `gr8loci.localhost:3005`, `demo.localhost:3005`).
- **3007** — Playwright dev server during `test:e2e`
- **3000** — reserved by BakersPinch; do not use

## Rules / discipline

- **TDD** for new design-system primitives and shared components (per the F1 plan; continue the pattern).
- **No unscoped Prisma in app code.** All data access must go through `forBlog(blogId)` (obtained via `getTenantDb()` / `getCurrentBlog()` in public code, `getAdminDb()` in admin routes). `forPlatform()` is the cross-tenant escape hatch for platform/admin-only code. An ESLint guard and a leak-guard test enforce this. No Kysely in active use; reserved as escape hatch for complex reads.
- **CSS Modules + design tokens for the public site.** Tokens flow from `packages/design-system/src/tokens/index.ts` → runtime CSS custom properties (F2). **Admin (`(admin)` route group) uses Tailwind CSS + shadcn/ui** (adopted in P1; do not use Tailwind outside that route group until P2+).
- **No raw `<img>` for user content** (static SVGs only). Media handling is a future milestone.
- **Auth is a stub.** Single super-admin across all tenants, plaintext-vs-env-var password, no rate limiting, no MFA. Fine for dev/preview. **Never rely on it for public production.** Clerk replaces this in P1.5. The stub is isolated behind `@platform/auth` — never import directly.
- **CI requires a live Postgres service.** The build prerenders pages that query Postgres; run migrations (`prisma migrate deploy`) before `pnpm build` in CI.
- **Commit style:** conventional — `feat(scope):`, `fix(scope):`, `chore(scope):`, `docs:`, `test(scope):`, `refactor(scope):`. Scope is usually the app or package name (`gr8loci`, `design-system`, `auth`).

## Common commands

```bash
pnpm --filter gr8loci dev            # dev server on :3005
pnpm --filter gr8loci build          # build (runs prisma generate)
pnpm --filter gr8loci test           # Vitest
pnpm --filter gr8loci test:e2e       # Playwright on :3007
pnpm --filter gr8loci lint
pnpm --filter gr8loci typecheck
pnpm --filter gr8loci prisma:migrate # prisma migrate dev
pnpm --filter gr8loci prisma:seed
pnpm --filter gr8loci prisma:studio
pnpm build                           # turbo build everything
pnpm test                            # turbo test everything
```

## Deploy

Auto-deploys to Vercel on push to `main`. Preview deploys per PR. Prod DB: DigitalOcean managed Postgres (`gr8loci_prod`). Preview DB: `gr8loci_preview` on the same cluster. Migrations run via `prisma migrate deploy` in the Vercel build step. See `README.md` §Production deploy for one-time setup.

## When in doubt

- Start in the spec/plan/handoff files under `docs/superpowers/`.
- F1 non-goals are explicit in the spec §11. For P1+ scope, see `docs/superpowers/specs/2026-06-06-multi-tenant-platform-vision-design.md`.
- Ask the user before doing anything cross-tenant, cross-repo, or destructive.
