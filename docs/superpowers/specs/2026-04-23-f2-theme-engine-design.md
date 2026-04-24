# F2 — Theme engine (runtime-editable tokens)

**Status:** accepted
**Author:** David Wellman (with Claude)
**Date:** 2026-04-23
**Depends on:** F1 (monorepo foundation, shipping)
**Follows:** `docs/superpowers/specs/2026-04-22-f1-monorepo-foundation-design.md`

## 1. Goal

Replace the F1 build-time CSS-variable generation with a runtime generator that reads token values from a `BrandTheme` Prisma model. Ship the plumbing only — no admin editor UI, no theme history, no dark-mode switcher. Editing happens through Prisma Studio until a proper editor lands (F4 or dedicated spec).

After F2, adding or retheming a brand is a DB row change, not a code deploy.

## 2. Motivation

The F1 design system is a custom implementation (`packages/design-system`) with six primitives styled via CSS Modules + CSS custom properties. Token values live in `packages/design-system/src/tokens/index.ts` as a `const` TypeScript object. A build script (`scripts/generate-tokens.ts`) emits these to `packages/design-system/tokens.css`, which each app imports once in its root layout.

This works but bakes token values into the artifact. Changing a brand color or font requires a code commit, PR, review, build, and deploy. The multi-brand roadmap (m-sew, breadmons, prostateawarenessbermuda in O2) makes that friction worse — every brand-specific tweak, even a one-line hex change, goes through full CI/CD.

The F1 spec §4 explicitly pre-committed to "CSS Modules + CSS custom properties — zero runtime cost; F2-ready for runtime theming." F2 delivers on that promise.

## 3. Non-goals (explicit)

- ❌ Admin UI for editing tokens (→ F4 or dedicated editor spec)
- ❌ Per-user themes or user-level overrides
- ❌ Theme versioning / undo / history
- ❌ Dark-mode toggle or multi-palette per theme (one palette per brand; dark-mode support is its own spec)
- ❌ Migration of the F1 custom design system to a third-party library (e.g., Mantine) — explicitly deferred to a separate pre-F4 design-strategy brainstorm
- ❌ Breakpoint runtime editability (CSS media queries cannot consume CSS variables; breakpoints stay compile-time)
- ❌ Per-component theming (the `BrandTheme` is site-wide; component-level overrides remain a primitive-level CSS Module concern)

## 4. Scope — what moves to the database

All tokens in `packages/design-system/src/tokens/index.ts` become runtime-editable **except `breakpoint`**:

| Group | Runtime-editable? | Reason |
|---|---|---|
| `color` | ✅ | Primary brand-identity surface |
| `typography.fontFamily` | ✅ | Brand voice |
| `typography.fontSize` | ✅ | Per-brand tone (editorial vs sans-humanist vs utilitarian) |
| `typography.fontWeight` | ✅ | Same as above |
| `typography.lineHeight` | ✅ | Same as above |
| `spacing` | ✅ | Allows per-brand density (airy vs dense) |
| `radius` | ✅ | Brand shape language (hard/soft) |
| `shadow` | ✅ | Brand elevation language |
| `breakpoint` | ❌ compile-time only | Used in CSS `@media` queries which cannot read `var(--…)` |

Rationale for "full set minus breakpoints": the first time a brand needs a structural token tweak that isn't runtime, it becomes a migration regardless. Paying the cost now while the schema is new is cheaper than paying it piecemeal later. Breakpoints are the one exception forced by the browser.

## 5. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  packages/design-system/src/tokens/index.ts                 │
│    - defaultTokens (const, shape source-of-truth)           │
│    - Tokens (TS type)                                       │
│    - TokensSchema (Zod, derived from Tokens)                │
│    - breakpoints (export kept separate, compile-time)       │
└──────────────────────────┬──────────────────────────────────┘
                           │ imports
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  packages/design-system/src/runtime/                        │
│    - loadTheme.ts  (server-only; React cache() wrapped)     │
│    - serializeTokens.ts  (tokens → CSS custom props)        │
│    - ThemeStyle.tsx  (Server Component; <style> in <head>)  │
└──────────────────────────┬──────────────────────────────────┘
                           │ used by
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  apps/gr8loci/src/app/layout.tsx (root layout)              │
│    <html>                                                   │
│      <head>                                                 │
│        <ThemeStyle />      ← runtime tokens as CSS vars     │
│      </head>                                                │
│      ...                                                    │
│    </html>                                                  │
└─────────────────────────────────────────────────────────────┘

Breakpoints remain a TypeScript-only export (`breakpoints` from `tokens/index.ts`). They are currently unused in the codebase — F1 has no responsive `@media` rules. When responsive styles get added, they'll hardcode the pixel values in CSS Modules (mirroring the TS export) because CSS `@media` queries cannot consume CSS variables. No separate `breakpoints.css` file is needed in F2.
                           │
                           │ reads via Prisma
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  BrandTheme table (Postgres)                                │
│    id, slug, tokens (JSONB), updatedAt, createdAt           │
└─────────────────────────────────────────────────────────────┘
```

No client-side JavaScript is added. The theme is resolved server-side per request, serialized to CSS custom properties, and injected inline into the rendered HTML. Browsers treat it identically to F1's static `tokens.css` for all paint/layout purposes.

## 6. Data model

### 6.1 Prisma schema addition

```prisma
model BrandTheme {
  id        String   @id @default(cuid())
  slug      String   @unique
  tokens    Json
  updatedAt DateTime @updatedAt
  createdAt DateTime @default(now())

  @@map("brand_themes")
}
```

- `slug` — stable identifier per brand, matches `process.env.BRAND_SLUG` in the corresponding app (`"gr8loci"`, later `"breadmons"`, `"m-sew"`, `"prostateawarenessbermuda"`)
- `tokens` — JSONB column matching `TokensSchema` shape (see 6.2). JSONB, not Json, so Postgres indexes + partial updates are possible later
- `updatedAt` — used for cache invalidation tags
- No `deletedAt` / soft-delete — F2 does not support deleting themes (no admin affordance exists). Manual deletion via Prisma Studio is acceptable if ever needed

### 6.2 TokensSchema (Zod, derived)

A Zod schema mirrors the `Tokens` TypeScript type. `packages/design-system/src/tokens/schema.ts`:

```ts
import { z } from 'zod'

export const TokensSchema = z.object({
  color: z.object({
    brand: z.object({ primary: z.string(), primaryMuted: z.string(), accent: z.string() }),
    neutral: z.object({
      50: z.string(), 100: z.string(), 200: z.string(), 300: z.string(), 400: z.string(),
      500: z.string(), 600: z.string(), 700: z.string(), 800: z.string(), 900: z.string(), 950: z.string(),
    }),
    semantic: z.object({ success: z.string(), warning: z.string(), danger: z.string(), dangerHover: z.string(), info: z.string() }),
    surface: z.object({ page: z.string(), card: z.string(), overlay: z.string() }),
    text: z.object({ primary: z.string(), secondary: z.string(), muted: z.string(), inverse: z.string(), link: z.string() }),
  }),
  typography: z.object({
    fontFamily: z.object({ sans: z.string(), serif: z.string(), mono: z.string() }),
    fontSize: z.object({
      xs: z.string(), sm: z.string(), base: z.string(), lg: z.string(), xl: z.string(),
      '2xl': z.string(), '3xl': z.string(), '4xl': z.string(), '5xl': z.string(),
    }),
    fontWeight: z.object({ regular: z.number(), medium: z.number(), semibold: z.number(), bold: z.number() }),
    lineHeight: z.object({ tight: z.number(), snug: z.number(), normal: z.number(), relaxed: z.number(), loose: z.number() }),
  }),
  spacing: z.object({
    0: z.string(), 1: z.string(), 2: z.string(), 3: z.string(), 4: z.string(),
    6: z.string(), 8: z.string(), 12: z.string(), 16: z.string(), 20: z.string(), 24: z.string(), 32: z.string(),
  }),
  radius: z.object({ none: z.string(), sm: z.string(), md: z.string(), lg: z.string(), xl: z.string(), full: z.string() }),
  shadow: z.object({ sm: z.string(), md: z.string(), lg: z.string(), xl: z.string() }),
})

export type TokensInput = z.input<typeof TokensSchema>
// The Tokens type exported from tokens/index.ts must remain structurally compatible.
// A type assertion `defaultTokens satisfies TokensInput` in index.ts enforces sync at build time.
```

Exact-keyed `z.object` (not `z.record`) is deliberate: if a brand's saved theme is missing a token that some CSS Module references, the browser renders an empty CSS variable and styles silently break. Validating the full canonical key set on read turns that into a logged fallback-to-defaults instead. Color values stay as strings (not strict hex) to allow `rgba()`, `hsl()`, etc. — matching F1's existing `surface.overlay` which uses rgba.

### 6.3 Default tokens export

`packages/design-system/src/tokens/index.ts` is refactored from a single `tokens` export to:

```ts
import type { TokensInput } from './schema'

export const defaultTokens = {
  color: { /* existing F1 values */ },
  typography: { /* existing F1 values */ },
  spacing: { /* existing F1 values */ },
  radius: { /* existing F1 values */ },
  shadow: { /* existing F1 values */ },
} as const satisfies TokensInput

export const breakpoints = { sm: 640, md: 768, lg: 1024, xl: 1280, '2xl': 1536 } as const

export type Tokens = typeof defaultTokens
```

Breakpoints move to a separate export since they are compile-time-only. The `satisfies TokensInput` check enforces that `defaultTokens` structurally matches the Zod schema — if the two drift, TypeScript fails the build.

## 7. Runtime

### 7.1 `loadTheme.ts`

```ts
import { cache } from 'react'
import { prisma } from '@/lib/prisma'   // per-app prisma singleton
import { defaultTokens } from '../tokens'
import { TokensSchema } from '../tokens/schema'
import type { Tokens } from '../tokens'

export const loadTheme = cache(async (slug: string): Promise<Tokens> => {
  try {
    const row = await prisma.brandTheme.findUnique({ where: { slug } })
    if (!row) return defaultTokens

    const parsed = TokensSchema.safeParse(row.tokens)
    if (!parsed.success) {
      console.error(`[theme] invalid tokens for slug=${slug}`, parsed.error.issues)
      return defaultTokens
    }
    return parsed.data as Tokens
  } catch (err) {
    console.error(`[theme] DB unreachable for slug=${slug}; falling back to defaults`, err)
    return defaultTokens
  }
})
```

- `cache()` dedupes within a single request (React server cache).
- Three failure modes all fall back to `defaultTokens`: missing row, invalid JSON shape, DB unreachable. All are logged. None throw. Never block a page render on theming.
- `cache()` is per-request, not per-process. F2 does not add a process-level cache — Prisma's connection pool + Postgres row-level latency is fast enough, and avoiding a process-wide cache means theme edits are visible on next request without bust logic.

### 7.2 `serializeTokens.ts`

```ts
export function serializeTokens(tokens: Tokens): string {
  const lines: string[] = [':root {']
  walk(tokens, '', lines)
  lines.push('}')
  return lines.join('\n')
}
```

Flattens the token tree into `--color-brand-primary: #163759;` shape, matching F1's existing `tokens.css` output exactly. Unit-test by comparing serialized `defaultTokens` byte-for-byte against the F1 committed `tokens.css`.

### 7.3 `ThemeStyle.tsx`

```tsx
import { loadTheme } from './loadTheme'
import { serializeTokens } from './serializeTokens'

export async function ThemeStyle({ slug }: { slug: string }) {
  const tokens = await loadTheme(slug)
  return <style dangerouslySetInnerHTML={{ __html: serializeTokens(tokens) }} />
}
```

Server Component. Renders once per request into `<head>`. No client JS.

`dangerouslySetInnerHTML` is safe here because `serializeTokens` output is fully derived from Zod-validated values (no user-controlled strings injected raw).

### 7.4 App-side wiring

`apps/gr8loci/src/app/layout.tsx`:

```tsx
import { ThemeStyle } from '@platform/design-system/runtime'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const slug = process.env.BRAND_SLUG ?? 'gr8loci'
  return (
    <html lang="en">
      <head><ThemeStyle slug={slug} /></head>
      <body>{children}</body>
    </html>
  )
}
```

The existing `import '@platform/design-system/tokens.css'` is removed.

### 7.5 Revalidation on edit

When a theme is edited via Prisma Studio, the user performs a page refresh in the browser to pick up changes. No explicit revalidation plumbing is needed for F2 because:
- `cache()` is per-request, not persisted.
- Next.js full-route cache for dynamic routes is invalidated per-request anyway in F1 (no ISR configured).
- Static pages (F1 uses `force-dynamic` on `/admin`, SSR on everything else in practice) re-render on next request.

If F4 (or earlier) adds `revalidate` / ISR, a `revalidateTag('brand-theme')` call will be added to a `saveTheme` server action at that point.

## 8. Migration path from F1

Sequence (executed by the F2 implementation plan):

1. Add `BrandTheme` model to `apps/gr8loci/prisma/schema.prisma`. Generate migration.
2. Extend `apps/gr8loci/prisma/seed.ts` to upsert one row: `{ slug: "gr8loci", tokens: defaultTokens }`.
3. Add `TokensSchema` to `packages/design-system`.
4. Add `runtime/` subpackage (`loadTheme`, `serializeTokens`, `ThemeStyle`).
5. Split `tokens/index.ts`: rename `tokens` → `defaultTokens`, extract `breakpoints` to separate export.
6. (No breakpoints.css build step — breakpoints remain a TS export for future responsive styles to import; no CSS file needed.)
7. Update `apps/gr8loci/src/app/layout.tsx` to use `<ThemeStyle slug={process.env.BRAND_SLUG ?? 'gr8loci'} />` in place of the `tokens.css` import.
8. Delete `scripts/generate-tokens.ts` and committed `packages/design-system/tokens.css`.
9. Add `BRAND_SLUG=gr8loci` to `apps/gr8loci/.env.example`, `.env.local`, and Vercel env vars (prod + preview).
10. Run `prisma migrate deploy` on production DB, then `prisma:seed` to populate the `gr8loci` theme row.
11. Verify production site renders identically byte-for-byte (visually) to pre-F2.

The migration is fully additive at the schema level and fully replaceable at the layout level. If F2 misbehaves in prod, reverting the `layout.tsx` change restores pre-F2 behavior; the `BrandTheme` table can sit unused.

## 9. Testing

### 9.1 Unit tests (Vitest, `packages/design-system`)

- `serializeTokens(defaultTokens)` produces output byte-equivalent to the F1 committed `tokens.css`. This is the critical safety net: F2 must not change any rendered style by default.
- `loadTheme` fallback behavior — mock Prisma to simulate:
  - missing row → returns `defaultTokens`, logs warning
  - invalid JSON → returns `defaultTokens`, logs Zod errors
  - thrown DB error → returns `defaultTokens`, logs error
- `TokensSchema.parse(defaultTokens)` succeeds — ensures the schema correctly matches the canonical shape.

### 9.2 Integration test (Vitest, `apps/gr8loci`)

Against a test Postgres DB (same pattern as any future DB integration test — instantiated on demand, not committed to CI yet since F1 set up no DB integration harness):
- Seed `BrandTheme` row with modified `color.brand.primary = "#ff0000"`.
- Call `loadTheme("gr8loci")` directly (avoiding RSC harness complexity).
- Assert returned tokens have the modified color.
- Assert `serializeTokens(...)` output contains `--color-brand-primary: #ff0000;`.

This test is the first one in the repo to require a live DB. If the F1 CI doesn't set up a test DB (it doesn't as of 2026-04-23), the F2 plan either (a) adds a DB-spin-up step to the CI workflow, or (b) marks this test as `.skip` in CI and documents local-run instructions. Decision deferred to the plan.

### 9.3 E2E (Playwright, `apps/gr8loci`)

Single happy-path test:
- Start dev server pointed at test DB with seeded `gr8loci` theme.
- Navigate to `/`.
- Assert `getComputedStyle(document.documentElement).getPropertyValue('--color-brand-primary')` is `"#163759"`.
- Update the DB row (`color.brand.primary` → `"#ff0000"`).
- Reload page, assert property is now `"rgb(255, 0, 0)"` (or `"#ff0000"` depending on browser serialization).

### 9.4 Visual regression

Not added in F2. Deferred to F3.

## 10. Observability

F2 adds three log lines:
- `[theme] invalid tokens for slug=<slug>` — Zod validation failure (indicates DB corruption or schema drift)
- `[theme] DB unreachable for slug=<slug>; falling back to defaults` — Prisma error (connectivity, credentials, etc.)
- No log on happy path (avoid noise).

All three go to stderr; Vercel captures to platform logs automatically. No new log destination, no new tracing dependency.

## 11. Security

- `dangerouslySetInnerHTML` on `<style>` — mitigated: content is fully derived from Zod-validated values. No route for user-controlled strings to reach the style tag in F2.
- `BrandTheme` rows are read by the app runtime only. No API surface exposes them in F2 (read or write). Editing is via Prisma Studio, authenticated by direct DB credentials — same threat model as any Prisma-Studio edit.
- No new attack surface introduced beyond what Prisma Studio already represents in F1.

## 12. Rollback

If F2 needs to be rolled back after deploy:
1. Revert `apps/gr8loci/src/app/layout.tsx` to re-import `tokens.css` directly.
2. Re-run build step to regenerate `tokens.css` from `defaultTokens` (script kept on a rollback branch).
3. The `brand_themes` table can sit unused — no data loss, no foreign-key dependencies.

## 13. Definition of done

1. ✅ `BrandTheme` Prisma model exists, migration applied to local + prod + preview DBs.
2. ✅ Seed script populates `slug: "gr8loci"` with `defaultTokens`.
3. ✅ `@platform/design-system` exports `runtime/loadTheme`, `runtime/serializeTokens`, `runtime/ThemeStyle`, and the new `defaultTokens` / `breakpoints` exports.
4. ✅ `apps/gr8loci/src/app/layout.tsx` uses `<ThemeStyle slug={process.env.BRAND_SLUG} />`.
5. ✅ `BRAND_SLUG=gr8loci` set in local, preview, and production environments.
6. ✅ Unit tests (byte-equivalence, fallback behavior, schema roundtrip) passing.
7. ✅ Integration test (seed → render → snapshot) passing against a test DB.
8. ✅ E2E test (edit DB → reload → computed style changed) passing.
9. ✅ `scripts/generate-tokens.ts` and committed `tokens.css` deleted.
10. ✅ Production site renders visually identical to pre-F2 (manual QA: 4 public pages pixel-eyeball).
11. ✅ README + `docs/superpowers/handoff/README.md` updated to reflect F2-shipped status and set F3 up as the next brainstorm target.
12. ✅ Plan in `docs/superpowers/plans/` updated to mark F2 complete; spec in `docs/superpowers/specs/` tagged `status: accepted → shipped`.

## 14. What F3 unlocks (context for prioritization)

F3 = template preset system (2–3 structural presets per content type). F3 depends on no F2 work directly — the preset mechanism is orthogonal to tokens. F2 can ship before or alongside F3 if desired. But F2 before F4 is meaningful because F4's admin editor will want to edit themes (via the `BrandTheme` row), and having the runtime plumbing in place makes the F4 editor a pure UI task rather than UI + backend.
