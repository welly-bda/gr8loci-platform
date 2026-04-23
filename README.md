# gr8loci-platform

Multi-brand content platform. Monorepo serving a portfolio of sites:

- [`gr8loci.online`](https://gr8loci.online) — health & wellness content (F1; shipping)
- `m-sew.com` — (future, O2)
- `breadmons.com` — (future, O2)
- `prostateawarenessbermuda.com` — (future, O2)

## Stack

Turborepo + pnpm • Next.js 15 (App Router) • React 19 • TypeScript strict • Prisma • PostgreSQL • Vercel • DigitalOcean managed Postgres • jose (auth stub) → Clerk (future) • CSS Modules + CSS custom properties • Vitest + Playwright.

## Structure

```
apps/
  gr8loci/            Next.js 15 app — first brand live in F1
packages/
  design-system/      Tokens + UI primitives (Button, Card, Typography, Layout, Input, Icon, RichContent renderer)
  auth/               AuthProvider interface + F1 JWT stub. Swap target: Clerk.
  config-typescript/  Shared TypeScript configs (base, nextjs, package).
  config-eslint/      Shared ESLint flat config.
  config-prettier/    Shared Prettier config.
```

## Prerequisites (local dev)

- macOS on Apple Silicon or Intel (or Linux)
- Node 20 LTS (via nvm / fnm / Homebrew)
- pnpm 9 (`npm install -g pnpm@9` or via Corepack)
- PostgreSQL 16 (`brew install postgresql@16 && brew services start postgresql@16`)

Verify:
```bash
node --version    # v20.x
pnpm --version    # 9.x
psql --version    # 16.x
```

## Local setup

```bash
git clone git@github.com:welly-bda/gr8loci-platform.git
cd gr8loci-platform
pnpm install

# Create local dev database
createdb gr8loci_dev

# Configure env
cp apps/gr8loci/.env.example apps/gr8loci/.env.local
# Edit apps/gr8loci/.env.local — set:
#   DATABASE_URL, DIRECT_URL (usually postgresql://YOURUSER@localhost:5432/gr8loci_dev)
#   NEXT_PUBLIC_SITE_NAME="GR8LOCI"
#   NEXT_PUBLIC_SITE_URL="http://localhost:3000"
#   AUTH_STUB_SECRET (generate: openssl rand -hex 32)
#   ADMIN_STUB_EMAIL=<your admin email>
#   ADMIN_STUB_PASSWORD=<strong random password>

# Migrate schema + seed demo content
pnpm --filter gr8loci prisma:migrate
pnpm --filter gr8loci prisma:seed

# Start dev server
pnpm --filter gr8loci dev
# open http://localhost:3000
```

Sign in to `/admin`:
1. Visit `http://localhost:3000/admin` — you'll be redirected to `/admin/login`
2. Enter the email you set as `ADMIN_STUB_EMAIL` and the password `ADMIN_STUB_PASSWORD`
3. You'll be redirected to `/admin` with a placeholder page

## Scripts

```bash
pnpm dev                             # run all app dev servers (F1: just gr8loci)
pnpm build                           # build all apps + packages (turbo-cached)
pnpm lint                            # lint everything
pnpm typecheck                       # typecheck everything
pnpm test                            # run all unit tests
pnpm --filter gr8loci dev            # run the gr8loci Next.js app only
pnpm --filter gr8loci test:e2e       # run Playwright e2e suite
pnpm --filter gr8loci prisma:studio  # open Prisma Studio against local DB
pnpm --filter gr8loci prisma:migrate # create and apply a new migration locally
pnpm --filter gr8loci prisma:seed    # re-seed local DB with demo content
```

## Architecture at a glance

### Design system
- Tokens live in `packages/design-system/src/tokens/index.ts` as the TypeScript source of truth
- `scripts/generate-tokens.ts` produces `packages/design-system/tokens.css` from the TS source; run via `pnpm --filter @platform/design-system generate:tokens`
- Six UI primitives: Button, Card, Typography (Heading/Text/Link), Layout (Stack/Row/Container), Input, Icon
- Rich content is stored as structured JSON (Tiptap-compatible); `<RichContent>` component renders it via design-system primitives
- All primitives meet WCAG AA baseline: `:focus-visible` two-ring pattern, sufficient contrast, keyboard nav

### Auth (F1 stub)
- `@platform/auth` exports an `auth` factory wired to a JWT-based `StubAuthProvider`
- Single admin user from the DB matches an env var password; login sets an HttpOnly signed cookie
- Next.js middleware at `apps/gr8loci/middleware.ts` verifies the JWT for `/admin/*` routes
- **The stub is not production-grade.** No rate limiting, no MFA, no password reset. Replace with Clerk (planned) via a single-file swap in `packages/auth/src/index.ts`.

### Data layer
- PostgreSQL via Prisma 6
- Policy: **no naked SQL in application code**. Prisma for all CRUD; Kysely reserved as escape hatch for complex reads if needed later.
- Local dev uses a local Postgres DB (`gr8loci_dev`); production uses DigitalOcean managed Postgres.

### CI
- GitHub Actions on every push/PR to `main`: lint → typecheck → build → test
- 15-minute job timeout
- Config at `.github/workflows/ci.yml`

## Production deploy

**Note:** details verified end-to-end during Task 38 of the F1 implementation plan.

Frontend: Vercel (one project per app). Database: DigitalOcean managed Postgres cluster with one database per brand. File storage: DigitalOcean Spaces (not used in F1).

### One-time setup (per brand)

**1. Database (DigitalOcean)**
- In the DO control panel, on your managed Postgres cluster, create two databases:
  - `gr8loci_prod`
  - `gr8loci_preview`
- Note the pooled (port 25061) and direct (port 25060) connection strings

**2. Vercel project**
- Import `welly-bda/gr8loci-platform` from GitHub
- Set root directory: `apps/gr8loci`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `cd ../.. && pnpm --filter gr8loci build`

**3. Env vars in Vercel**

For Production:
```
DATABASE_URL=<gr8loci_prod pooled URL, port 25061>
DIRECT_URL=<gr8loci_prod direct URL, port 25060>
NEXT_PUBLIC_SITE_NAME=GR8LOCI
NEXT_PUBLIC_SITE_URL=<the *.vercel.app URL Vercel assigns>
AUTH_STUB_SECRET=<generate fresh: openssl rand -hex 32>
ADMIN_STUB_EMAIL=<your admin email>
ADMIN_STUB_PASSWORD=<strong random password>
```

For Preview: same set, but point `DATABASE_URL` / `DIRECT_URL` to `gr8loci_preview`.

**4. Initial migration on production DB**

From your local machine, one-time:
```bash
cd apps/gr8loci
DATABASE_URL='<gr8loci_prod direct URL>' \
DIRECT_URL='<gr8loci_prod direct URL>' \
pnpm prisma migrate deploy

# seed admin user (optional; you can also create in production via a future admin UI)
DATABASE_URL='<gr8loci_prod direct URL>' \
DIRECT_URL='<gr8loci_prod direct URL>' \
ADMIN_STUB_EMAIL='<admin email>' \
pnpm prisma:seed
```

Subsequent migrations run automatically via the Vercel build hook (`prisma migrate deploy` is part of the `build` script).

### Deploys

- Merging to `main` → Vercel auto-deploys to production
- PR / non-main branch → Vercel creates a preview deployment automatically
- CI (GitHub Actions) must be green for the deploy to count as official

## Security notes

- The current auth is a **stub** (plaintext env-var password, single hardcoded admin). It is **only for dev/preview**. Do not rely on it as the long-term production auth.
- `.env.local` is gitignored; never commit it.
- Cookies are `HttpOnly`, `sameSite=lax`, `secure` in production.
- Next.js Server Actions have built-in CSRF protection via origin checks.
- No raw `<img>` tags for user-submitted content — F1 uses static SVGs only.

## Project documentation

The design spec and implementation plan for the F1 monorepo foundation (this repo's initial scope) live in the source repo of the prior GR8LOCI site at:
- `docs/superpowers/specs/2026-04-22-f1-monorepo-foundation-design.md`
- `docs/superpowers/plans/2026-04-22-f1-monorepo-foundation.md`

## License

Private. All rights reserved.
