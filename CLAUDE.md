# CLAUDE.md

Project context for Claude Code sessions. Keep this short and load-bearing.

## What this is

Multi-brand content platform. Turborepo monorepo. First brand (`gr8loci.online`) ships from `apps/gr8loci/`. Future brands (m-sew, breadmons, prostateawarenessbermuda) land in the O2 milestone as additional `apps/*` entries sharing `packages/*`.

**Predecessor repo:** `~/Developer/ClaudeDev-local/gr8loci-online/` — the legacy monolithic Node/Express GR8LOCI site. This repo replaces it. F1 design/plan originated there and was copied into this repo's `docs/superpowers/`.

## Current status

- **F1 (monorepo foundation + gr8loci.online shipping)** — complete. Tagged `f1-complete`. See `docs/superpowers/handoff/README.md` for the current state-of-the-world.
- **F2 (theme engine — runtime-editable tokens from admin UI)** — next increment. Not yet scoped. Start with `/brainstorm` when ready.
- **F3** — template preset system. **F4** — CMS + admin primitives + real auth (Clerk).

## Stack

Next.js 15 (App Router) • React 19 • TypeScript strict • Prisma 6 + PostgreSQL 16 • jose (stub auth) → Clerk (F4) • CSS Modules + CSS custom properties • Vitest + Playwright • Turborepo + pnpm 9 • Vercel + DigitalOcean managed Postgres.

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

- **3005** — `pnpm --filter gr8loci dev` (changed from 3000 to avoid BakersPinch collision)
- **3007** — Playwright dev server during `test:e2e`
- **3000** — reserved by BakersPinch; do not use

## Rules / discipline

- **TDD** for new design-system primitives and shared components (per the F1 plan; continue the pattern).
- **No naked SQL in application code.** Prisma for all CRUD. Kysely is reserved as an escape hatch for complex reads — not in use in F1.
- **CSS Modules only.** No Tailwind, no styled-components, no CSS-in-JS. Tokens flow from `packages/design-system/src/tokens/index.ts` → generated `tokens.css` (CSS custom properties).
- **No raw `<img>` for user content** in F1 (static SVGs only). Media handling lands with F4.
- **Auth is a stub.** Plaintext password compared to env var, single hardcoded admin, no rate limiting, no MFA. Fine for dev/preview. **Never rely on it for public production without Clerk (F4) swapped in.** The stub is isolated behind `@platform/auth` — consumers must go through that abstraction, never directly.
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
- F1 non-goals are explicit in the spec §11 — don't drift into F2/F3/F4 territory by accident.
- Ask the user before doing anything cross-brand, cross-repo, or destructive.
