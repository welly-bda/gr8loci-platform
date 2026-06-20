# F1 — Monorepo Foundation & First App Rendering

**Spec ID:** F1
**Date:** 2026-04-22
**Status:** Approved (brainstorming), pending implementation plan
**Supersedes:** none (first spec of the platform rebuild)

---

## 1. Summary

Stand up a Turborepo + pnpm monorepo containing one Next.js 15 app (`apps/gr8loci`) rendering four demo pages end-to-end, connected to a PostgreSQL database via Prisma, styled through a shared design-system primitives package (`packages/design-system`), and gated by a swappable auth abstraction (`packages/auth`) with a throwaway F1 stub implementation. Deploy to Vercel production.

F1 validates every cross-cutting architectural decision (monorepo tooling, framework, ORM, auth pattern, design system, deploy pipeline) with a single brand before committing them across three more brands.

## 2. Context

GR8LOCI.ONLINE is a vanilla-HTML/CSS/JS + Node/Prisma + legacy Python Flask blog platform, built as the user's first Claude Code project (Nov 2025 – Apr 2026). The existing codebase has:

- 7,800+ lines of CSS across 5+ files with zero design tokens
- Fragmented component implementations (3+ variants of buttons, cards, share icons)
- Legacy Python Flask remnants being phased out
- No consistent admin UX
- No multi-brand capability

The user is greenfielding the platform to host a portfolio of his own brands (gr8loci.online, m-sew.com, breadmons.com, prostateawarenessbermuda.com). Primary motivation is craft and architecture — applying what he has learned in five months of development — not commercial SaaS. BakersPinch.com is a separate commercial SaaS product and is explicitly out of scope.

## 3. Platform roadmap (where F1 fits)

### Foundation specs — what makes everything else possible
1. **F1 — Monorepo skeleton + first app rendering** ← this spec
2. F2 — Theme engine (runtime-editable tokens)
3. F3 — Template preset system (2–3 structural presets per content type)
4. F4 — CMS + admin primitives (post editor, media library, real auth, per-site dashboard)

### Promotional toolkit specs (on top of foundation)
- P1 — Email (transactional + newsletter)
- P2 — Site alerts (banners, pop-ups, targeting)
- P3 — Image galleries
- P4 — Events (calendar, RSVP, reminders)
- P5 — Social media integration
- P6 — WhatsApp integration

### Operations specs
- O1 — Custom domain wiring (per-brand domains via Vercel)
- O2 — Onboarding brands #2–#4 (`apps/msew`, `apps/breadmons`, `apps/prostate`)

Each spec is a discrete, shippable milestone with its own design → plan → implementation cycle.

## 4. Locked architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Repo model | Monorepo | Shared foundations across 4 brands; avoid dependency drift |
| Monorepo tooling | Turborepo + pnpm workspaces | Best Next.js integration; remote caching; disk-efficient |
| Framework | Next.js 15 (App Router) per app | Server Components; Vercel-native; RSC-first |
| Language | TypeScript strict mode | End-to-end type safety |
| Styling | CSS Modules + CSS custom properties | Zero runtime cost; F2-ready for runtime theming |
| ORM | Prisma; Kysely reserved as escape hatch | Type-safe; "no naked SQL in app code" policy |
| Database | PostgreSQL, one DB per brand | Isolation, per-brand business logic, no tenant_id discipline |
| Database hosting | DigitalOcean Managed Postgres (shared cluster) | Already in use; predictable pricing; multi-DB per cluster |
| Content storage | Structured JSON (Tiptap/ProseMirror-compatible schema) | WYSIWYG-friendly for non-technical admins |
| Auth (F1 stub) | JWT via `jose` + env-var password | Minimal; replaceable; proves route-guard pattern |
| Auth (F4+ target) | Clerk | Managed service; excellent DX; free at our scale |
| Auth abstraction | `packages/auth` with `AuthProvider` interface | Provider swap = one-line change, not rewrite |
| Frontend hosting | Vercel | Best Next.js DX; trivial custom domains; free SSL per domain |
| Object storage | DigitalOcean Spaces | Not used in F1; future Media spec |
| Containers | None | No orchestration needs; Vercel abstracts infra |
| SQL discipline | No naked SQL in application code | Prisma for CRUD; Kysely for complex reads; raw SQL only in migrations |

## 5. Repo structure

```
gr8loci-platform/                    (github.com/welly-bda/gr8loci-platform)
├── apps/
│   └── gr8loci/                     # Next.js 15 app, App Router
│       ├── app/
│       │   ├── layout.tsx           # imports design-system tokens
│       │   ├── page.tsx             # home
│       │   ├── blog/
│       │   │   ├── page.tsx         # blog index
│       │   │   └── [slug]/page.tsx  # single post
│       │   ├── about/page.tsx
│       │   ├── (admin)/admin/
│       │   │   ├── page.tsx         # protected placeholder
│       │   │   └── login/page.tsx   # stub login form
│       │   └── globals.css
│       ├── lib/
│       │   ├── db.ts                # Prisma client singleton
│       │   └── content.ts           # typed content fetchers (wrap Prisma)
│       ├── prisma/
│       │   ├── schema.prisma
│       │   ├── seed.ts
│       │   └── migrations/
│       ├── public/                  # static assets, demo hero images
│       ├── middleware.ts            # route guard via auth abstraction
│       ├── next.config.ts
│       ├── tsconfig.json
│       └── package.json
├── packages/
│   ├── design-system/
│   │   ├── src/
│   │   │   ├── tokens/              # color, type, spacing, shadow, radius
│   │   │   ├── components/          # Button, Card, Typography, Layout, Input, Icon
│   │   │   ├── content/
│   │   │   │   ├── schema.ts        # rich-content JSON schema
│   │   │   │   └── RichContent.tsx  # renderer
│   │   │   └── index.ts
│   │   ├── scripts/generate-tokens.ts  # builds tokens.css
│   │   ├── tokens.css               # generated, committed
│   │   └── package.json
│   ├── auth/
│   │   ├── src/
│   │   │   ├── types.ts             # AuthProvider, Session
│   │   │   ├── providers/stub.ts    # F1 implementation
│   │   │   └── index.ts             # factory export
│   │   └── package.json
│   ├── config-eslint/
│   ├── config-prettier/
│   └── config-typescript/
├── .github/workflows/ci.yml
├── package.json                     # workspace root
├── pnpm-workspace.yaml
├── turbo.json
├── .gitignore
├── .nvmrc                           # Node version pin
└── README.md
```

### Why only one app and three small packages in F1

Creating `apps/msew/`, `apps/breadmons/`, `apps/prostate/`, `packages/cms-core/`, `packages/theme-engine/`, etc. as empty folders now is YAGNI cargo. They are added in their respective specs when they carry real code.

## 6. Design system (`packages/design-system`)

### 6.1 Token vocabulary

```ts
// packages/design-system/src/tokens/index.ts
export const tokens = {
  color: {
    brand: { primary, primaryMuted, accent },
    neutral: { 50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 },
    semantic: { success, warning, danger, info },
    surface: { page, card, overlay },
    text: { primary, secondary, muted, inverse, link },
  },
  typography: {
    fontFamily: { sans, serif, mono },
    fontSize: { xs, sm, base, lg, xl, '2xl', '3xl', '4xl', '5xl' },
    fontWeight: { regular, medium, semibold, bold },
    lineHeight: { tight, snug, normal, relaxed, loose },
  },
  spacing: { 0, 1, 2, 3, 4, 6, 8, 12, 16, 20, 24, 32 },
  radius: { none, sm, md, lg, xl, full },
  shadow: { sm, md, lg, xl },
  breakpoint: { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 },
}
```

This is the **public API** of the design system. Deliberately small and opinionated — no arbitrary scales, no escape hatches. Apps consume tokens; they do not invent new ones.

### 6.2 Token generation

- Tokens are defined in TypeScript (source of truth)
- Build step `tsx scripts/generate-tokens.ts` emits `tokens.css` with CSS custom properties:
  ```css
  :root {
    --color-brand-primary: #163759;
    --color-text-primary: #1a1a1a;
    --space-4: 1rem;
    /* ... */
  }
  ```
- Apps import `@platform/design-system/tokens.css` once in `layout.tsx`
- Components consume tokens via CSS variables: `color: var(--color-text-primary)`
- Tokens also exported as TypeScript constants for JS access

**F2 replaces the build step with a runtime generator** reading from the `BrandTheme` model. No component changes required at that time — only the source of the CSS variables changes.

### 6.3 Primitives shipped in F1 (six)

1. **Button** — variants: `primary`, `secondary`, `ghost`, `danger`; sizes: `sm`, `md`, `lg`
2. **Card** — variants: `elevated`, `outlined`, `flat`
3. **Typography** — `Heading` (levels 1–6), `Text` (sizes matching token scale), `Link`
4. **Layout** — `Stack` (vertical gap), `Row` (horizontal gap), `Container` (max-width)
5. **Input** — `text`, `textarea`, `select`; with label + error slot
6. **Icon** — wrapper over Lucide React with token-scaled sizing

**Not shipped in F1:** navigational components (headers/footers), interactive primitives (Modal, Dropdown, Tabs, Popover), domain-specific components (BlogCard, ProductTile). These are added when real apps demand them.

### 6.4 Styling approach

CSS Modules + CSS custom properties. Each component ships a `.module.css` alongside the `.tsx` file and reads tokens via `var(--...)`. No Tailwind, no CSS-in-JS, no styled-components.

Rationale:
- Zero runtime cost
- First-class CSS variable support (the mechanism for F2's runtime theming)
- Works with React Server Components without fuss
- Easy to inspect and debug in DevTools

### 6.5 Rich content renderer

Because content is stored as structured JSON (see §7), F1 ships a renderer that maps content nodes to design-system primitives:

- `packages/design-system/src/content/schema.ts` — documents the node types (paragraph, heading, list, list-item, link, bold, italic, blockquote, image, hr). Tiptap/ProseMirror-compatible.
- `packages/design-system/src/content/RichContent.tsx` — accepts a content JSON object and renders nodes through `Typography`, `Link`, etc.

F1 does NOT ship the editor UI. That lands in F4. In F1, content is seeded as hand-written JSON documents.

### 6.6 Accessibility baseline (non-negotiable)

Every interactive primitive must:
- Implement `:focus-visible` styles (never bare `outline: none`)
- Meet WCAG AA contrast ratios (4.5:1 text, 3:1 UI elements)
- Be fully keyboard-navigable without a mouse
- Include appropriate ARIA roles/labels where semantic HTML is insufficient

Primitives that fail these checks do not ship.

## 7. Data model (`apps/gr8loci/prisma/schema.prisma`)

Three models. Everything else (categories, tags, comments, views, media library, lead magnets, announcements) is deferred to F4 or respective P-specs.

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum PostStatus {
  draft
  published
  archived
}

model BlogPost {
  id              String      @id @default(cuid())
  slug            String      @unique
  title           String
  excerpt         String?
  content         Json        // structured rich-text (Tiptap JSON)
  contentVersion  Int         @default(1)
  heroImageUrl    String?
  heroImageAlt    String?
  status          PostStatus  @default(draft)
  publishedAt     DateTime?
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([status, publishedAt])
  @@map("blog_posts")
}

model Page {
  id              String   @id @default(cuid())
  slug            String   @unique
  title           String
  content         Json
  contentVersion  Int      @default(1)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("pages")
}

model AdminUser {
  // F1 stub only. F4/auth-spec replaces with Clerk-synced mirror table
  // (adds role, siteId, lastLoginAt, externalId columns).
  id         String   @id @default(cuid())
  email      String   @unique
  createdAt  DateTime @default(now())

  @@map("admin_users")
}
```

### Key schema decisions

- **`cuid()` for IDs** — non-sequential, URL-safe, safe to merge across environments
- **`content` as `Json`** — structured rich-text, editor-agnostic storage
- **`contentVersion`** — forward-compatibility hook for future schema migrations of the content JSON shape
- **`heroImageUrl` is a plain string** — F4 introduces a proper `Media` table; in F1 we store URLs directly
- **Database tables use `snake_case` via `@@map`** — Prisma models stay PascalCase in code; SQL-side inspection stays readable
- **No soft-delete, no versioning history** — F4 decides whether those are needed

### Seed data

`prisma/seed.ts` creates:
- 1 admin user (email from `ADMIN_STUB_EMAIL` env var)
- 3 published blog posts with realistic titles/excerpts and hand-written content JSON
- 1 page (`/about`)

Run via `pnpm --filter gr8loci prisma db seed`.

### Initial migration

One migration: `prisma migrate dev --name foundation_initial_schema` produces the first migration file. Subsequent specs add additive migrations.

## 8. Application structure (`apps/gr8loci`)

### 8.1 Demo pages (F1 deliverables)

Four pages, each a proof that design-system primitives compose cleanly into real layouts:

1. **`/`** — home; hero + 3 blog cards + email-capture stub (non-functional in F1)
2. **`/blog`** — blog index, card grid of published posts
3. **`/blog/[slug]`** — single post rendering rich content through `<RichContent>`
4. **`/about`** — static page rendering rich content

All four read data from Prisma — no hardcoded placeholder arrays. This validates the full render pipeline from DB → Server Component → design-system primitives.

### 8.2 Data-fetching pattern

Server Components call typed Prisma wrappers in `lib/content.ts`. Those wrappers issue Prisma queries against Postgres. **No raw SQL anywhere in application code.** No API routes for content fetching. No client-side fetching in F1.

```ts
// apps/gr8loci/lib/content.ts
import { prisma } from './db'

export async function getPublishedBlogPosts() {
  return prisma.blogPost.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
  })
}

export async function getBlogPostBySlug(slug: string) {
  return prisma.blogPost.findUnique({
    where: { slug, status: 'published' },
  })
}

export async function getPageBySlug(slug: string) {
  return prisma.page.findUnique({ where: { slug } })
}
```

```tsx
// apps/gr8loci/app/blog/page.tsx
import { getPublishedBlogPosts } from '@/lib/content'
import { BlogGrid } from '@/components/BlogGrid'

export default async function BlogIndex() {
  const posts = await getPublishedBlogPosts()
  return <BlogGrid posts={posts} />
}
```

API routes exist only for things that genuinely need them (form submissions, webhooks, admin mutations). None of these exist in F1.

### 8.3 Token consumption

`app/layout.tsx` imports `@platform/design-system/tokens.css` and `app/globals.css` once. Every component consumes tokens via CSS variables. No per-page token imports.

## 9. Auth (F1 stub behind swappable abstraction)

### 9.1 Interface (the port)

```ts
// packages/auth/src/types.ts
export type Session = {
  userId: string
  email: string
}

export interface AuthProvider {
  getSession(): Promise<Session | null>
  signOut(): Promise<void>
}
```

Intentionally minimal. Role, permissions, and per-site scoping land in F4 when the real admin surface needs them.

### 9.2 `StubAuthProvider` (F1 implementation)

- JWT-signed cookie via `jose` library, HS256
- Plaintext password comparison against `ADMIN_STUB_PASSWORD` env var
- Single admin user seeded in the DB, identified by email
- Sessions are NOT stored in the DB; state lives in the signed cookie
- Cookie attributes: `httpOnly`, `secure`, `sameSite=lax`, 7-day expiry

```ts
// packages/auth/src/providers/stub.ts (sketch)
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export class StubAuthProvider implements AuthProvider {
  async login(email: string, password: string) { /* ... */ }
  async getSession() { /* reads cookie, verifies JWT, returns Session | null */ }
  async signOut() { /* clears cookie */ }
}
```

### 9.3 Factory export (the swap point)

```ts
// packages/auth/src/index.ts
import { StubAuthProvider } from './providers/stub'
// import { ClerkAuthProvider } from './providers/clerk'  // added in F4

export const auth: AuthProvider = new StubAuthProvider()
// F4: const auth = new ClerkAuthProvider()  ← one-line change
```

All application code imports `auth` from `@platform/auth`. Nothing imports stub code directly.

### 9.4 Route protection via Next.js middleware

```ts
// apps/gr8loci/middleware.ts
import { NextResponse } from 'next/server'
import { auth } from '@platform/auth'

export async function middleware(req) {
  const path = req.nextUrl.pathname
  if (path.startsWith('/admin') && path !== '/admin/login') {
    const session = await auth.getSession()
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', req.url))
    }
  }
}

export const config = { matcher: ['/admin/:path*'] }
```

One place to enforce, runs at the edge before the route component loads, keeps auth concerns out of page components.

### 9.5 F1 admin surface (two routes)

1. **`/admin/login`** — form with email + password, submits to a server action calling the stub's login method
2. **`/admin`** — placeholder page reading `auth.getSession()` and showing "Logged in as {email}. Admin features land in F4." with a logout button

No post editor, media library, theme editor, or user management in F1. Those are F4 deliverables.

### 9.6 Security caveats (explicit)

- Single hardcoded admin; multi-admin = F4
- Plaintext password compared against env var; F4 replaces with bcrypt-per-user (via Clerk)
- No rate limiting on login attempts; Clerk provides this
- No lockout, no password reset, no MFA; Clerk provides all
- Cookie session with no server-side revocation; acceptable for F1, Clerk's call thereafter

This is acceptable because the admin UI has nothing valuable in it yet. Code comments and README must clearly label the stub "DO NOT USE IN PRODUCTION AS-IS." The `ADMIN_STUB_PASSWORD` env var is never set in production before F4 lands.

### 9.7 Migration to Clerk (future spec, not F1)

1. `pnpm add @clerk/nextjs`
2. Implement `ClerkAuthProvider` in `packages/auth/src/providers/clerk.ts` (~50 lines)
3. Swap the factory export in `packages/auth/src/index.ts` (one line)
4. Replace `/admin/login` form with Clerk `<SignIn />` component (or redirect to hosted UI)
5. Add webhook handler at `/api/webhooks/clerk` syncing `user.created/updated/deleted` → `AdminUser` mirror table
6. Delete `packages/auth/src/providers/stub.ts` and `ADMIN_STUB_PASSWORD` env var
7. Add `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_WEBHOOK_SECRET` env vars

Middleware, page components, and the `/admin` URL all remain unchanged. The `AdminUser` table survives the migration as Clerk's mirror, gaining role/siteId/externalId columns when needed.

## 10. Deployment, environments, CI

### 10.1 Architecture diagram

```
┌─────────────────────────────────────────────────────┐
│  Vercel                                             │
│  ┌─────────────────────────────────────────────┐    │
│  │  apps/gr8loci       (F1 ships this)         │    │
│  │  apps/msew          (O2)                    │    │
│  │  apps/breadmons     (O2)                    │    │
│  │  apps/prostate      (O2)                    │    │
│  └──────┬──────┬──────┬──────┬─────────────────┘    │
└─────────┼──────┼──────┼──────┼──────────────────────┘
          │      │      │      │ Prisma (pooled, port 25061)
          ▼      ▼      ▼      ▼
┌─────────────────────────────────────────────────────┐
│  DigitalOcean Managed Postgres (shared cluster)     │
│  ┌────────────────────┐                             │
│  │  gr8loci_prod      │  ← F1                       │
│  │  msew_prod         │  ← O2                       │
│  │  breadmons_prod    │  ← O2                       │
│  │  prostate_prod     │  ← O2                       │
│  │  gr8loci_preview   │  ← F1 (for PR previews)     │
│  │  + _preview / _test per brand as onboarded       │
│  └────────────────────┘                             │
└─────────────────────────────────────────────────────┘
```

Custom domain wiring (pointing `gr8loci.online` at the Vercel deployment) is deferred to O1. F1 deploys to Vercel's default `*.vercel.app` URL.

### 10.2 Environments

| Environment | Trigger | Database | URL |
|---|---|---|---|
| Local | `pnpm dev` | Local Postgres via Homebrew, `gr8loci_dev` | `localhost:3000` |
| Preview | PR / non-main branch push | Shared DO cluster: `gr8loci_preview` | `*-preview.vercel.app` per branch |
| Production | Merge to `main` | DO cluster: `gr8loci_prod` | `*.vercel.app` (custom domain = O1) |

Each environment has its own env-var set in Vercel's dashboard. Local uses `.env.local` (gitignored), documented via `.env.example`.

### 10.3 Env vars required in F1

```
# Database
DATABASE_URL=              # pooled, port 25061
DIRECT_URL=                # direct for migrations, port 25060

# Site identity
NEXT_PUBLIC_SITE_NAME=     # e.g., "GR8LOCI"
NEXT_PUBLIC_SITE_URL=      # e.g., "https://gr8loci-xxx.vercel.app"

# F1 auth stub (deleted when Clerk ships)
AUTH_STUB_SECRET=          # random 32-byte hex, JWT signing
ADMIN_STUB_EMAIL=          # the single seeded admin's email
ADMIN_STUB_PASSWORD=       # plaintext; dev/preview only; NEVER in production
```

### 10.4 CI/CD pipeline

On every pull request (GitHub Actions):
1. `pnpm install --frozen-lockfile`
2. `pnpm lint` (ESLint, CI-blocking)
3. `pnpm typecheck` (TypeScript strict, CI-blocking)
4. `pnpm build` (Turbo build across affected packages + apps)
5. `pnpm test` (Vitest + Playwright smoke tests)
6. Vercel auto-deploys preview URL

On merge to `main`:
1. Same checks as above
2. Vercel deploys to production
3. Prisma migrations run automatically via Vercel build hook: `prisma migrate deploy`

Build caching: Turborepo's remote cache via Vercel (free for personal use).

### 10.5 Testing approach in F1

F1 is deliberately **under-tested** by design — we prove architecture, not business logic.

| Layer | F1 coverage | Where proper testing lands |
|---|---|---|
| Type checking | Full, strict mode, CI-blocking | Always |
| Linting | ESLint + shared config, CI-blocking | Always |
| Unit tests (design-system primitives) | Smoke test per primitive — renders without crashing | Expand in F2 when tokens become runtime |
| Prisma query integration tests | Skipped | F4 when real CRUD lands |
| E2E / Playwright | One smoke test: home loads, blog index loads, single post loads, admin login redirect works | Expand per feature |
| Visual regression | Skipped | Optional in F3 |

**Stack:** Vitest for unit, Playwright for E2E. When integration tests land (F4+), `gr8loci_test` database on the same DO cluster, wiped between test runs via Prisma.

## 11. Non-goals for F1 (explicit)

Calling these out so scope discussions stay clean:

- ❌ Custom domains / DNS / SSL automation (→ O1)
- ❌ Multiple apps deployed (`apps/msew`, etc.) (→ O2)
- ❌ Runtime-editable theme tokens from admin UI (→ F2)
- ❌ Template preset picker (→ F3)
- ❌ Real auth with Clerk (→ F4 or dedicated auth spec)
- ❌ Post/page editor UI (→ F4)
- ❌ Media library / upload UI / DO Spaces integration (→ Media spec inside F4 or separate)
- ❌ Categories, tags, comments, view tracking (→ F4 or later)
- ❌ Email sending / newsletters (→ P1)
- ❌ Site alerts / announcements (→ P2)
- ❌ Image galleries (→ P3)
- ❌ Events / calendar / RSVP (→ P4)
- ❌ Social media integrations (→ P5)
- ❌ WhatsApp integration (→ P6)
- ❌ Production data migration from existing GR8LOCI site (→ migration spec after F4)
- ❌ SEO metadata generation, sitemap.xml, robots.txt (→ small follow-up spec)
- ❌ Analytics / tracking code injection (→ future spec)

## 12. Definition of done (F1)

F1 ships when all of the following are observably true:

1. ✅ Monorepo exists on GitHub at `github.com/welly-bda/gr8loci-platform`, clonable, with working `pnpm install`
2. ✅ `pnpm dev` from the root starts `apps/gr8loci` on localhost with the design system loaded
3. ✅ Four public pages render correctly: `/`, `/blog`, `/blog/[slug]`, `/about`
4. ✅ All four pages consume data from Prisma via `lib/content.ts` (no hardcoded arrays)
5. ✅ Rich content renders via `<RichContent>` component from the design-system package
6. ✅ `/admin` redirects to `/admin/login` when unauthenticated; `/admin/login` successfully authenticates via the stub; authenticated `/admin` shows a placeholder page with logout
7. ✅ Auth is consumed exclusively through the `packages/auth` abstraction — no direct stub imports in app code
8. ✅ Design-system primitives pass accessibility baseline (focus-visible, contrast, keyboard nav)
9. ✅ GitHub Actions CI is green on `main` (lint, typecheck, build, smoke tests)
10. ✅ Vercel production deploy is live at its `*.vercel.app` URL
11. ✅ DO Postgres `gr8loci_prod` database exists, is migrated, and is seeded with demo content
12. ✅ README documents: clone, install, local DB setup, dev server, deploy procedure

## 13. Open questions

None. All decisions resolved during the brainstorming session documented in this spec.

## 14. References

Project memories informing this spec:
- `memory/project_platform_direction.md` — multi-tenant direction (greenfield, custom domains)
- `memory/project_brand_portfolio.md` — 4 brands in scope, BakersPinch separate
- `memory/project_theming_decision.md` — token-runtime + preset-picker
- `memory/project_content_editor_decision.md` — WYSIWYG rich text JSON, not Markdown
- `memory/project_auth_strategy.md` — Clerk as target provider
- `memory/project_platform_vision.md` — content + promotion toolkit
- `memory/user_background.md` — user's development background
