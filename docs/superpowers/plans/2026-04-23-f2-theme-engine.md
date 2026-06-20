# F2 — Theme engine implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the F1 build-time CSS-variable generation with a runtime generator backed by a `BrandTheme` Prisma model, so token values can be edited in the database without a code deploy.

**Architecture:** New `BrandTheme` model keyed by `slug`. `packages/design-system` exports a `runtime/` subpath (`loadTheme`, `serializeTokens`, `ThemeStyle` RSC) that reads the DB row on each request (via React `cache()` for dedup), validates with Zod against a schema derived from the F1 `Tokens` type, serializes to CSS custom properties, and injects them as inline `<style>` in `<head>`. Falls back to compile-time defaults on any failure. Breakpoints stay compile-time (CSS `@media` can't consume CSS variables).

**Tech Stack:** Prisma 6 (BrandTheme model + JSONB), Zod (schema validation), Next.js 15 App Router (Server Component for `<ThemeStyle>`), React 19 `cache()` (per-request dedup), Vitest (unit + integration), Playwright (e2e).

**Spec reference:** `docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md`.

---

## File Structure Overview

### Created
- `packages/design-system/src/tokens/schema.ts` — Zod `TokensSchema`, inferred `TokensInput` type
- `packages/design-system/src/runtime/loadTheme.ts` — server-only theme loader, cache-wrapped, fallback-safe
- `packages/design-system/src/runtime/serializeTokens.ts` — token tree → CSS custom properties string
- `packages/design-system/src/runtime/ThemeStyle.tsx` — Server Component rendering `<style>` into `<head>`
- `packages/design-system/src/runtime/index.ts` — barrel export for `runtime/`
- `packages/design-system/test/serializeTokens.test.ts` — byte-equivalence unit test (output matches F1 tokens.css)
- `packages/design-system/test/loadTheme.test.ts` — fallback behavior with mocked Prisma client
- `packages/design-system/test/fixtures/f1-tokens.css` — frozen copy of F1's generated tokens.css (equivalence target)
- `apps/gr8loci/test/theme-integration.test.ts` — integration test against a live DB (skip-if-no-DB)
- `apps/gr8loci/tests/e2e/theme-runtime.spec.ts` — Playwright e2e for edit-and-reload
- `apps/gr8loci/prisma/migrations/<timestamp>_add_brand_theme/migration.sql` — Prisma-generated migration for BrandTheme

### Modified
- `packages/design-system/package.json` — add Zod dep, add `./runtime` export path, remove `generate:tokens` script
- `packages/design-system/src/tokens/index.ts` — split into `defaultTokens` + `breakpoints` exports, derive `Tokens` type
- `packages/design-system/src/index.ts` — re-export `defaultTokens`, `breakpoints`, keep legacy `tokens` re-export for one version
- `packages/design-system/src/server.ts` — re-export runtime helpers
- `apps/gr8loci/prisma/schema.prisma` — add `BrandTheme` model
- `apps/gr8loci/prisma/seed.ts` — upsert one `BrandTheme` row with `defaultTokens`
- `apps/gr8loci/app/layout.tsx` — mount `<ThemeStyle slug={process.env.BRAND_SLUG ?? 'gr8loci'} />`
- `apps/gr8loci/app/globals.css` — remove `@import '@platform/design-system/tokens.css'` (tokens now come from `<ThemeStyle>`)
- `apps/gr8loci/.env.example` — add `BRAND_SLUG=gr8loci`
- `apps/gr8loci/package.json` — add Zod dep (if not already provided transitively)
- `README.md` — update doc links to reflect F2 shipped
- `docs/superpowers/handoff/README.md` — mark F2 shipped, set F3 as next target
- `docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md` — flip status frontmatter `accepted` → `shipped` on final commit

### Deleted
- `packages/design-system/scripts/generate-tokens.ts`
- `packages/design-system/tokens.css` (and its `./tokens.css` export in `package.json`)
- `packages/design-system/scripts/` (if it becomes empty)

---

## Pre-flight (human steps before Task 1)

- [ ] **Confirm F1 is green on main**

```bash
cd /Users/davidwellman2/Developer/ClaudeDev-local/gr8loci-platform
git status          # expect clean
git log -1          # expect 8add8d6 (F2 spec) or later
```

- [ ] **Confirm local dev DB is reachable**

```bash
cd apps/gr8loci
pnpm prisma migrate status
# expect: "Database schema is up to date!"
```

- [ ] **Confirm the dev site currently renders against F1 defaults**

```bash
pnpm --filter gr8loci dev
# open http://localhost:3005; verify hero + 3 blog cards appear styled.
# Ctrl-C to stop.
```

---

## Phase 1 — Zod schema + token refactor

### Task 1: Add Zod dependency to `@platform/design-system`

**Files:**
- Modify: `packages/design-system/package.json`

- [ ] **Step 1: Add zod to dependencies**

Run:
```bash
pnpm --filter @platform/design-system add zod@^3.23.0
```

Expected: `package.json` gains `"zod": "^3.23.0"` under `dependencies`. Lockfile updates.

- [ ] **Step 2: Verify it resolves**

```bash
pnpm --filter @platform/design-system exec node -e "console.log(require('zod').z)"
```
Expected: prints a Zod builder object, no error.

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/package.json pnpm-lock.yaml
git commit -m "chore(design-system): add zod dependency for F2 theme schema"
```

---

### Task 2: Create `TokensSchema` with exact-keyed Zod shape

**Files:**
- Create: `packages/design-system/src/tokens/schema.ts`

- [ ] **Step 1: Write the schema**

Create `packages/design-system/src/tokens/schema.ts`:

```ts
import { z } from 'zod'

export const TokensSchema = z.object({
  color: z.object({
    brand: z.object({
      primary: z.string(),
      primaryMuted: z.string(),
      accent: z.string(),
    }),
    neutral: z.object({
      '50': z.string(),
      '100': z.string(),
      '200': z.string(),
      '300': z.string(),
      '400': z.string(),
      '500': z.string(),
      '600': z.string(),
      '700': z.string(),
      '800': z.string(),
      '900': z.string(),
      '950': z.string(),
    }),
    semantic: z.object({
      success: z.string(),
      warning: z.string(),
      danger: z.string(),
      dangerHover: z.string(),
      info: z.string(),
    }),
    surface: z.object({
      page: z.string(),
      card: z.string(),
      overlay: z.string(),
    }),
    text: z.object({
      primary: z.string(),
      secondary: z.string(),
      muted: z.string(),
      inverse: z.string(),
      link: z.string(),
    }),
  }),
  typography: z.object({
    fontFamily: z.object({
      sans: z.string(),
      serif: z.string(),
      mono: z.string(),
    }),
    fontSize: z.object({
      xs: z.string(),
      sm: z.string(),
      base: z.string(),
      lg: z.string(),
      xl: z.string(),
      '2xl': z.string(),
      '3xl': z.string(),
      '4xl': z.string(),
      '5xl': z.string(),
    }),
    fontWeight: z.object({
      regular: z.number(),
      medium: z.number(),
      semibold: z.number(),
      bold: z.number(),
    }),
    lineHeight: z.object({
      tight: z.number(),
      snug: z.number(),
      normal: z.number(),
      relaxed: z.number(),
      loose: z.number(),
    }),
  }),
  spacing: z.object({
    '0': z.string(),
    '1': z.string(),
    '2': z.string(),
    '3': z.string(),
    '4': z.string(),
    '6': z.string(),
    '8': z.string(),
    '12': z.string(),
    '16': z.string(),
    '20': z.string(),
    '24': z.string(),
    '32': z.string(),
  }),
  radius: z.object({
    none: z.string(),
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    full: z.string(),
  }),
  shadow: z.object({
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
  }),
})

export type TokensInput = z.input<typeof TokensSchema>
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm --filter @platform/design-system typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/src/tokens/schema.ts
git commit -m "feat(design-system): add TokensSchema Zod schema for F2 theme validation"
```

---

### Task 3: Split `tokens/index.ts` into `defaultTokens` + `breakpoints`

**Files:**
- Modify: `packages/design-system/src/tokens/index.ts`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Rewrite `tokens/index.ts`**

Replace the full contents of `packages/design-system/src/tokens/index.ts` with:

```ts
import type { TokensInput } from './schema'

export const defaultTokens = {
  color: {
    brand: {
      primary: '#163759',
      primaryMuted: '#2a4f73',
      accent: '#20b2aa',
    },
    neutral: {
      '50': '#f8fafc',
      '100': '#f1f5f9',
      '200': '#e2e8f0',
      '300': '#cbd5e1',
      '400': '#94a3b8',
      '500': '#64748b',
      '600': '#475569',
      '700': '#334155',
      '800': '#1e293b',
      '900': '#0f172a',
      '950': '#020617',
    },
    semantic: {
      success: '#16a34a',
      warning: '#f59e0b',
      danger: '#dc2626',
      dangerHover: '#b91c1c',
      info: '#0284c7',
    },
    surface: {
      page: '#ffffff',
      card: '#ffffff',
      overlay: 'rgba(15, 23, 42, 0.6)',
    },
    text: {
      primary: '#0f172a',
      secondary: '#334155',
      muted: '#64748b',
      inverse: '#ffffff',
      link: '#163759',
    },
  },
  typography: {
    fontFamily: {
      sans: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      serif: "'Cormorant Garamond', Georgia, serif",
      mono: "'JetBrains Mono', 'SF Mono', Consolas, monospace",
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
      '4xl': '2.25rem',
      '5xl': '3rem',
    },
    fontWeight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      snug: 1.35,
      normal: 1.5,
      relaxed: 1.625,
      loose: 1.75,
    },
  },
  spacing: {
    '0': '0',
    '1': '0.25rem',
    '2': '0.5rem',
    '3': '0.75rem',
    '4': '1rem',
    '6': '1.5rem',
    '8': '2rem',
    '12': '3rem',
    '16': '4rem',
    '20': '5rem',
    '24': '6rem',
    '32': '8rem',
  },
  radius: {
    none: '0',
    sm: '0.25rem',
    md: '0.5rem',
    lg: '0.75rem',
    xl: '1rem',
    full: '9999px',
  },
  shadow: {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  },
} as const satisfies TokensInput

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const

export type Tokens = typeof defaultTokens
export type Breakpoints = typeof breakpoints

/**
 * @deprecated Use `defaultTokens` instead. `tokens` is re-exported for one release
 * to ease migration from F1; will be removed when F3 lands.
 */
export const tokens = defaultTokens
```

Note: numeric keys for neutral/fontSize/spacing become string-keyed (`'50'` not `50`) to match the Zod schema exactly. TypeScript sees both the same at runtime.

- [ ] **Step 2: Update the package-level barrel export**

Replace the first two lines of `packages/design-system/src/index.ts`:

```ts
export { tokens } from './tokens'
export type { Tokens } from './tokens'
```

with:

```ts
export { defaultTokens, breakpoints, tokens } from './tokens'
export type { Tokens, Breakpoints } from './tokens'
export { TokensSchema } from './tokens/schema'
export type { TokensInput } from './tokens/schema'
```

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @platform/design-system typecheck
pnpm --filter gr8loci typecheck
```
Expected: both pass. The legacy `tokens` re-export keeps any F1 consumer code compiling.

- [ ] **Step 4: Run existing unit tests**

```bash
pnpm --filter @platform/design-system test
pnpm --filter gr8loci test
```
Expected: all existing tests pass unchanged.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/src/tokens/index.ts packages/design-system/src/index.ts
git commit -m "refactor(design-system): split tokens into defaultTokens + breakpoints for F2"
```

---

## Phase 2 — Runtime package

### Task 4: Snapshot the F1 `tokens.css` as a test fixture

**Files:**
- Create: `packages/design-system/test/fixtures/f1-tokens.css`

- [ ] **Step 1: Copy the current generated tokens.css to the fixture directory**

```bash
mkdir -p packages/design-system/test/fixtures
cp packages/design-system/tokens.css packages/design-system/test/fixtures/f1-tokens.css
```

This fixture is the byte-equivalence target. The F2 `serializeTokens` function must produce an output that, when tested against `defaultTokens`, equals this fixture. Preserving it in the test tree means we can delete the top-level `tokens.css` later while keeping the safety net.

- [ ] **Step 2: Verify the fixture is present and non-empty**

```bash
wc -l packages/design-system/test/fixtures/f1-tokens.css
```
Expected: 70–80 lines, matching the current generated file.

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/test/fixtures/f1-tokens.css
git commit -m "test(design-system): snapshot F1 tokens.css as equivalence fixture"
```

---

### Task 5: Write `serializeTokens` (TDD)

**Files:**
- Create: `packages/design-system/test/serializeTokens.test.ts`
- Create: `packages/design-system/src/runtime/serializeTokens.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/test/serializeTokens.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { serializeTokens } from '../src/runtime/serializeTokens'
import { defaultTokens } from '../src/tokens'

const fixture = readFileSync(
  join(__dirname, 'fixtures/f1-tokens.css'),
  'utf8',
)

describe('serializeTokens', () => {
  it('produces CSS custom properties matching the F1 generated tokens.css for defaultTokens', () => {
    const output = serializeTokens(defaultTokens)
    expect(output.trim()).toEqual(fixture.trim())
  })

  it('emits a :root selector wrapping all custom properties', () => {
    const output = serializeTokens(defaultTokens)
    expect(output).toMatch(/^:root\s*\{/m)
    expect(output).toMatch(/\}\s*$/m)
  })

  it('flattens nested keys with hyphens, preserving token case', () => {
    const output = serializeTokens(defaultTokens)
    expect(output).toContain('--color-brand-primary: #163759;')
    expect(output).toContain('--color-semantic-dangerHover: #b91c1c;')
    expect(output).toContain('--spacing-32: 8rem;')
    expect(output).toContain('--font-weight-regular: 400;')
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
pnpm --filter @platform/design-system test -- serializeTokens
```
Expected: FAIL — `serializeTokens` not found.

- [ ] **Step 3: Implement `serializeTokens`**

Create `packages/design-system/src/runtime/serializeTokens.ts`. Read the existing generator at `packages/design-system/scripts/generate-tokens.ts` for the exact flattening/naming rules — the F2 serializer must replicate them byte-for-byte:

```ts
import type { Tokens } from '../tokens'

/**
 * Serialize tokens to a `:root { --k-v: v; }` CSS string.
 *
 * Naming rules (must match F1 scripts/generate-tokens.ts exactly — see test fixture):
 * - Top-level group names map to prefixes: color, typography → font-family/font-size/font-weight/line-height,
 *   spacing, radius, shadow. "typography" is special-cased.
 * - Nested keys are joined with "-". Object keys keep their original casing (e.g. primaryMuted, dangerHover, 2xl).
 * - Leaf values are emitted as-is (strings or numbers).
 */
export function serializeTokens(tokens: Tokens): string {
  const lines: string[] = [
    '/* AUTO-GENERATED from src/tokens/index.ts — do not edit by hand. */',
    '/* Regenerate with: pnpm --filter @platform/design-system generate:tokens */',
    '',
    ':root {',
  ]

  for (const [group, value] of Object.entries(tokens)) {
    if (group === 'typography') {
      // Typography splits into font-family, font-size, font-weight, line-height
      const t = value as Tokens['typography']
      for (const [k, v] of Object.entries(t.fontFamily)) lines.push(`  --font-family-${k}: ${v};`)
      for (const [k, v] of Object.entries(t.fontSize)) lines.push(`  --font-size-${k}: ${v};`)
      for (const [k, v] of Object.entries(t.fontWeight)) lines.push(`  --font-weight-${k}: ${v};`)
      for (const [k, v] of Object.entries(t.lineHeight)) lines.push(`  --line-height-${k}: ${v};`)
      continue
    }

    flatten(group, value, lines)
  }

  lines.push('}')
  return lines.join('\n')
}

function flatten(prefix: string, value: unknown, out: string[]): void {
  if (value === null || typeof value !== 'object') {
    out.push(`  --${prefix}: ${value as string | number};`)
    return
  }
  for (const [k, v] of Object.entries(value)) {
    flatten(`${prefix}-${k}`, v, out)
  }
}
```

**If the fixture-match test fails** (almost certainly will on the first try — byte-equivalence is fussy): open `packages/design-system/test/fixtures/f1-tokens.css` side-by-side with the serializer output and align the two. Do NOT edit the fixture; adjust the serializer. The goal is to prove F2 reproduces F1 output exactly.

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm --filter @platform/design-system test -- serializeTokens
```
Expected: all three tests pass. If the equivalence test fails, compare `output` vs `fixture` in the failure diff and fix the serializer until they match.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/test/serializeTokens.test.ts packages/design-system/src/runtime/serializeTokens.ts
git commit -m "feat(design-system): serializeTokens emits CSS vars matching F1 tokens.css"
```

---

### Task 6: Write `loadTheme` with Prisma mock (TDD)

**Files:**
- Create: `packages/design-system/test/loadTheme.test.ts`
- Create: `packages/design-system/src/runtime/loadTheme.ts`

Note: `loadTheme` takes a Prisma client as its first argument. This makes the design-system package agnostic to where Prisma lives (it lives in the consuming app). Apps wrap `loadTheme` with their own client. This also makes the unit test trivial (inject a mock).

- [ ] **Step 1: Write the failing test**

Create `packages/design-system/test/loadTheme.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { loadTheme } from '../src/runtime/loadTheme'
import { defaultTokens } from '../src/tokens'

type BrandThemeRow = { slug: string; tokens: unknown } | null
type PrismaLike = {
  brandTheme: { findUnique: (args: { where: { slug: string } }) => Promise<BrandThemeRow> }
}

function mockPrisma(handler: (slug: string) => Promise<BrandThemeRow> | BrandThemeRow): PrismaLike {
  return {
    brandTheme: {
      findUnique: vi.fn(async ({ where: { slug } }) => handler(slug)),
    },
  }
}

// loadTheme is wrapped in React.cache(); to isolate tests we bypass the cache.
// The cache memoizes by argument identity — passing distinct prisma mocks avoids collisions,
// but we still disable the wrapper for clarity.
beforeEach(() => {
  vi.restoreAllMocks()
})

describe('loadTheme', () => {
  it('returns the DB tokens when a valid row exists', async () => {
    const custom = structuredClone(defaultTokens) as typeof defaultTokens & { color: typeof defaultTokens.color }
    ;(custom.color.brand as { primary: string }).primary = '#ff0000'
    const prisma = mockPrisma(async () => ({ slug: 'gr8loci', tokens: custom }))

    const result = await loadTheme(prisma, 'gr8loci')
    expect(result.color.brand.primary).toBe('#ff0000')
  })

  it('falls back to defaults when the row is missing', async () => {
    const prisma = mockPrisma(async () => null)
    const result = await loadTheme(prisma, 'unknown-slug')
    expect(result).toEqual(defaultTokens)
  })

  it('falls back to defaults when the row tokens fail Zod validation', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const prisma = mockPrisma(async () => ({ slug: 'gr8loci', tokens: { not: 'valid' } }))

    const result = await loadTheme(prisma, 'gr8loci')
    expect(result).toEqual(defaultTokens)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[theme] invalid tokens for slug=gr8loci'),
      expect.anything(),
    )
  })

  it('falls back to defaults when Prisma throws', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const prisma: PrismaLike = {
      brandTheme: { findUnique: vi.fn(async () => { throw new Error('connect ECONNREFUSED') }) },
    }

    const result = await loadTheme(prisma, 'gr8loci')
    expect(result).toEqual(defaultTokens)
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[theme] DB unreachable for slug=gr8loci'),
      expect.any(Error),
    )
  })
})
```

- [ ] **Step 2: Run the test — expect failure**

```bash
pnpm --filter @platform/design-system test -- loadTheme
```
Expected: FAIL — `loadTheme` not found.

- [ ] **Step 3: Implement `loadTheme`**

Create `packages/design-system/src/runtime/loadTheme.ts`:

```ts
import { cache } from 'react'
import { defaultTokens } from '../tokens'
import { TokensSchema } from '../tokens/schema'
import type { Tokens } from '../tokens'

/**
 * Structural interface describing the single Prisma query we need.
 * Keeps @platform/design-system free of a Prisma import; consumers pass their own client.
 */
export interface BrandThemePrismaClient {
  brandTheme: {
    findUnique(args: { where: { slug: string } }): Promise<{ tokens: unknown } | null>
  }
}

/**
 * Load the theme for `slug`, falling back to compile-time defaults on any failure.
 *
 * Failure modes (all logged, never throw):
 *  - row missing          → defaultTokens
 *  - Zod validation fails → defaultTokens
 *  - Prisma query throws  → defaultTokens
 *
 * Wrapped in React.cache() so one render pass = one DB hit, even with multiple callers.
 */
export const loadTheme = cache(
  async (prisma: BrandThemePrismaClient, slug: string): Promise<Tokens> => {
    let row: { tokens: unknown } | null
    try {
      row = await prisma.brandTheme.findUnique({ where: { slug } })
    } catch (err) {
      console.error(`[theme] DB unreachable for slug=${slug}; falling back to defaults`, err)
      return defaultTokens
    }

    if (!row) return defaultTokens

    const parsed = TokensSchema.safeParse(row.tokens)
    if (!parsed.success) {
      console.error(`[theme] invalid tokens for slug=${slug}; falling back to defaults`, parsed.error.issues)
      return defaultTokens
    }
    return parsed.data as Tokens
  },
)
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm --filter @platform/design-system test -- loadTheme
```
Expected: all four tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/test/loadTheme.test.ts packages/design-system/src/runtime/loadTheme.ts
git commit -m "feat(design-system): add loadTheme with Zod validation + fallback to defaults"
```

---

### Task 7: Write `ThemeStyle` Server Component

**Files:**
- Create: `packages/design-system/src/runtime/ThemeStyle.tsx`

`<ThemeStyle>` is the composition point: it takes a Prisma client + slug, calls `loadTheme`, and renders the serialized CSS inline. No client JS. Tested end-to-end by Task 12 (app-level smoke) and Task 15 (Playwright); no unit test here because RSC harnesses are currently awkward in Vitest and the component is pure composition of two already-tested helpers.

- [ ] **Step 1: Implement the component**

Create `packages/design-system/src/runtime/ThemeStyle.tsx`:

```tsx
import { loadTheme, type BrandThemePrismaClient } from './loadTheme'
import { serializeTokens } from './serializeTokens'

interface ThemeStyleProps {
  prisma: BrandThemePrismaClient
  slug: string
}

/**
 * Server Component. Loads the theme for `slug`, serializes to CSS variables,
 * and emits them inline as a <style> block in the rendered HTML.
 *
 * Place this inside <head> in the root layout so the CSS variables are
 * available to every style rule on the page (including design-system primitives
 * which consume them via CSS Modules).
 *
 * The inline-style is safe because `serializeTokens` only emits strings/numbers
 * that have already been Zod-validated against TokensSchema by `loadTheme`.
 */
export async function ThemeStyle({ prisma, slug }: ThemeStyleProps) {
  const tokens = await loadTheme(prisma, slug)
  const css = serializeTokens(tokens)
  // eslint-disable-next-line react/no-danger -- content is Zod-validated, no user input
  return <style dangerouslySetInnerHTML={{ __html: css }} />
}
```

- [ ] **Step 2: Verify typecheck**

```bash
pnpm --filter @platform/design-system typecheck
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/design-system/src/runtime/ThemeStyle.tsx
git commit -m "feat(design-system): add ThemeStyle Server Component"
```

---

### Task 8: Wire `runtime/` into package exports

**Files:**
- Create: `packages/design-system/src/runtime/index.ts`
- Modify: `packages/design-system/package.json`
- Modify: `packages/design-system/src/server.ts`

- [ ] **Step 1: Create the runtime barrel**

Create `packages/design-system/src/runtime/index.ts`:

```ts
export { loadTheme } from './loadTheme'
export type { BrandThemePrismaClient } from './loadTheme'
export { serializeTokens } from './serializeTokens'
export { ThemeStyle } from './ThemeStyle'
```

- [ ] **Step 2: Add the `./runtime` export to `package.json`**

In `packages/design-system/package.json`, modify the `exports` block from:

```json
"exports": {
  ".": "./src/index.ts",
  "./server": "./src/server.ts",
  "./tokens.css": "./tokens.css"
}
```

to:

```json
"exports": {
  ".": "./src/index.ts",
  "./server": "./src/server.ts",
  "./runtime": "./src/runtime/index.ts",
  "./tokens.css": "./tokens.css"
}
```

(The `./tokens.css` export is still present here because we haven't deleted the file yet; Task 14 removes it.)

- [ ] **Step 3: Re-export from `server.ts` for consumers that already import from `@platform/design-system/server`**

Replace the contents of `packages/design-system/src/server.ts` with:

```ts
// Server-only entry for utilities that need server runtime.
// Re-exports runtime theme helpers so consumers can import from either
// `@platform/design-system/server` or `@platform/design-system/runtime`.
export { loadTheme, serializeTokens, ThemeStyle } from './runtime'
export type { BrandThemePrismaClient } from './runtime'
```

- [ ] **Step 4: Verify typecheck in all consumers**

```bash
pnpm typecheck
```
Expected: all packages typecheck cleanly.

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/src/runtime/index.ts packages/design-system/package.json packages/design-system/src/server.ts
git commit -m "feat(design-system): export runtime/ subpath and re-export from server.ts"
```

---

## Phase 3 — Prisma + seed + env

### Task 9: Add `BrandTheme` model and migration

**Files:**
- Modify: `apps/gr8loci/prisma/schema.prisma`
- Create: `apps/gr8loci/prisma/migrations/<timestamp>_add_brand_theme/migration.sql` (Prisma-generated)

- [ ] **Step 1: Add the model to schema.prisma**

Append to `apps/gr8loci/prisma/schema.prisma`:

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

- [ ] **Step 2: Create the migration**

```bash
cd apps/gr8loci
pnpm prisma migrate dev --name add_brand_theme
```

Expected output: Prisma creates `prisma/migrations/<ts>_add_brand_theme/migration.sql` with `CREATE TABLE "brand_themes" (...)`, applies it to the local dev DB, regenerates `@prisma/client`.

- [ ] **Step 3: Verify the table exists locally**

```bash
pnpm prisma studio  # opens browser; verify BrandTheme appears in the model list
```

Close Prisma Studio when done.

Also confirm via CLI:
```bash
psql gr8loci_dev -c "\d brand_themes"
```
Expected: table schema with id, slug, tokens, updatedAt, createdAt; unique index on `slug`.

- [ ] **Step 4: Commit**

```bash
cd /Users/davidwellman2/Developer/ClaudeDev-local/gr8loci-platform
git add apps/gr8loci/prisma/schema.prisma apps/gr8loci/prisma/migrations/
git commit -m "feat(gr8loci): add BrandTheme Prisma model for F2 runtime theme"
```

---

### Task 10: Update seed script to upsert the `gr8loci` theme row

**Files:**
- Modify: `apps/gr8loci/prisma/seed.ts`

- [ ] **Step 1: Import `defaultTokens` and add the upsert**

Open `apps/gr8loci/prisma/seed.ts`. Find the top of `async function main()` (right after admin-user upsert). Add these lines at the start of `main`, after the `adminEmail` check but before the posts array:

```ts
import { defaultTokens } from '@platform/design-system'
```
(Add to existing imports at the top of the file.)

Inside `main()`, after the `adminUser.upsert(...)` call:

```ts
  await prisma.brandTheme.upsert({
    where: { slug: 'gr8loci' },
    create: { slug: 'gr8loci', tokens: defaultTokens },
    update: {}, // do not clobber edits made via Prisma Studio
  })
```

The `update: {}` is deliberate: if someone has edited the theme row via Prisma Studio, re-running the seed must NOT overwrite their changes. The seed's job is to bootstrap an empty DB to a working state, not to force-reset.

- [ ] **Step 2: Run the seed locally**

```bash
pnpm --filter gr8loci prisma:seed
```
Expected: seed completes without error. If this is a fresh DB, the gr8loci BrandTheme row is created; if the row already exists, no change.

- [ ] **Step 3: Verify the row was created**

```bash
psql gr8loci_dev -c "SELECT slug, jsonb_typeof(tokens) FROM brand_themes;"
```
Expected: `slug=gr8loci | jsonb_typeof=object` (or `json` on older pg).

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/prisma/seed.ts
git commit -m "feat(gr8loci): seed default BrandTheme row for gr8loci slug"
```

---

### Task 11: Add `BRAND_SLUG` env var to `.env.example` and local `.env.local`

**Files:**
- Modify: `apps/gr8loci/.env.example`

- [ ] **Step 1: Append to `.env.example`**

Append to the end of `apps/gr8loci/.env.example`:

```

# F2 — selects which BrandTheme row to load at runtime.
# One per app/brand. gr8loci uses "gr8loci". O2 brands add m-sew, breadmons, etc.
BRAND_SLUG="gr8loci"
```

- [ ] **Step 2: Update your local `.env.local`**

Manually append the same `BRAND_SLUG="gr8loci"` line to `apps/gr8loci/.env.local` (gitignored, so per-machine).

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/.env.example
git commit -m "docs(gr8loci): document BRAND_SLUG env var for F2 theme loader"
```

---

## Phase 4 — App wiring

### Task 12: Mount `<ThemeStyle>` in the root layout and remove tokens.css import

**Files:**
- Modify: `apps/gr8loci/app/layout.tsx`
- Modify: `apps/gr8loci/app/globals.css`

- [ ] **Step 1: Remove the tokens.css import from globals.css**

Open `apps/gr8loci/app/globals.css`. The first line is currently:

```css
@import '@platform/design-system/tokens.css';
```

Delete that line. The remaining `globals.css` content (box-sizing reset, base typography, focus-visible ring) stays.

- [ ] **Step 2: Wire `<ThemeStyle>` into layout.tsx**

Replace `apps/gr8loci/app/layout.tsx` with:

```tsx
import type { Metadata } from 'next'
import { ThemeStyle } from '@platform/design-system/runtime'
import { prisma } from '@/lib/db'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GR8LOCI', template: '%s · GR8LOCI' },
  description: 'Health & wellness content and community.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const slug = process.env.BRAND_SLUG ?? 'gr8loci'
  return (
    <html lang="en">
      <head>
        <ThemeStyle prisma={prisma} slug={slug} />
      </head>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
```

Next.js 15 fully supports async Server Components inside `<head>`; no type workarounds needed. If TypeScript complains, verify `@types/react` is v19 and `next` is current — do NOT silently add `@ts-expect-error`.

- [ ] **Step 3: Dev-server smoke test**

```bash
pnpm --filter gr8loci dev
```

Open http://localhost:3005 in the browser. Verify:
- Page renders (no 500).
- Styles are applied: hero section has the brand-primary navy, buttons have brand colors, typography is Inter/Cormorant.
- Open DevTools → Elements → `<head>`. Confirm there's a `<style>` block containing `--color-brand-primary: #163759;` etc.
- The old `<link rel="stylesheet" href="..tokens.css">` should NOT be present.

Ctrl-C to stop.

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/app/layout.tsx apps/gr8loci/app/globals.css
git commit -m "feat(gr8loci): mount ThemeStyle RSC in root layout; drop tokens.css import"
```

---

### Task 13: Rollback drill — verify fallback-to-defaults works end-to-end

This is a defensive one-shot test that the fallback path actually renders usably. Do it once, locally, before we ship.

- [ ] **Step 1: Temporarily break theme loading**

In Prisma Studio or via psql, delete the `gr8loci` BrandTheme row:

```bash
psql gr8loci_dev -c "DELETE FROM brand_themes WHERE slug='gr8loci';"
```

- [ ] **Step 2: Restart dev and verify the site still renders**

```bash
pnpm --filter gr8loci dev
```

Open http://localhost:3005. Verify:
- Page renders identically to Task 12 Step 3 (fallback returned `defaultTokens`, which equals the DB row we just deleted).
- Server console shows no `[theme]` error (empty-row path is silent by design).

- [ ] **Step 3: Test the invalid-JSON path**

Re-seed, then corrupt:
```bash
pnpm --filter gr8loci prisma:seed
psql gr8loci_dev -c "UPDATE brand_themes SET tokens='{\"bogus\":true}'::jsonb WHERE slug='gr8loci';"
```

Reload the page. Verify:
- Page still renders with default styles.
- Server console prints `[theme] invalid tokens for slug=gr8loci; falling back to defaults` followed by Zod error details.

- [ ] **Step 4: Restore normal state**

```bash
pnpm --filter gr8loci prisma:seed  # update: {} won't touch bad data, so first delete it
psql gr8loci_dev -c "DELETE FROM brand_themes WHERE slug='gr8loci';"
pnpm --filter gr8loci prisma:seed
```

Verify DB row is valid:
```bash
psql gr8loci_dev -c "SELECT jsonb_typeof(tokens->'color'->'brand') FROM brand_themes WHERE slug='gr8loci';"
```
Expected: `object`.

- [ ] **Step 5: No commit — this was a manual verification only**

---

## Phase 5 — Cleanup

### Task 14: Delete `generate-tokens.ts`, committed `tokens.css`, and related scripts

**Files:**
- Delete: `packages/design-system/scripts/generate-tokens.ts`
- Delete: `packages/design-system/tokens.css`
- Modify: `packages/design-system/package.json` (remove generate:tokens script + exports entry)

- [ ] **Step 1: Delete the generator script and generated CSS**

```bash
rm packages/design-system/scripts/generate-tokens.ts
rm packages/design-system/tokens.css
# If scripts/ is now empty, remove the directory:
rmdir packages/design-system/scripts 2>/dev/null || true
```

- [ ] **Step 2: Update `packages/design-system/package.json`**

Remove the `generate:tokens` script and simplify `build`/`clean`:

```json
"scripts": {
  "build": "tsc",
  "dev": "tsc --watch",
  "lint": "eslint src",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "clean": "rm -rf dist"
}
```

Remove the `./tokens.css` entry from `exports`:

```json
"exports": {
  ".": "./src/index.ts",
  "./server": "./src/server.ts",
  "./runtime": "./src/runtime/index.ts"
}
```

(The `tsx` devDependency can stay — it's cheap, and may be useful for future scripts.)

- [ ] **Step 3: Rebuild and re-test**

```bash
pnpm --filter @platform/design-system typecheck
pnpm --filter @platform/design-system test
pnpm --filter gr8loci build
```

All three must pass. The `gr8loci` build in particular will fail if anything still imports `@platform/design-system/tokens.css` — hunt down and remove any such import.

- [ ] **Step 4: Commit**

```bash
git add -A packages/design-system/
git commit -m "chore(design-system): remove F1 build-time token generation (superseded by F2 runtime)"
```

---

## Phase 6 — Integration + e2e tests

### Task 15: Integration test against a live DB (local-run, skipped in CI)

**Files:**
- Create: `apps/gr8loci/test/theme-integration.test.ts`

F1 CI doesn't provision a test database. Rather than expanding CI scope for F2, this test guards itself with `describe.skipIf(!process.env.DATABASE_URL)` and is run locally by the developer after any theme-related change.

- [ ] **Step 1: Write the test**

Create `apps/gr8loci/test/theme-integration.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { loadTheme, serializeTokens } from '@platform/design-system/runtime'
import { defaultTokens } from '@platform/design-system'

// Skip entirely in CI (no DATABASE_URL). Run locally with `pnpm --filter gr8loci test`.
const dbAvailable = Boolean(process.env.DATABASE_URL)

describe.skipIf(!dbAvailable)('theme integration (requires DATABASE_URL)', () => {
  const prisma = new PrismaClient()
  const TEST_SLUG = 'f2-integration-test'

  beforeAll(async () => {
    await prisma.brandTheme.deleteMany({ where: { slug: TEST_SLUG } })
  })

  afterAll(async () => {
    await prisma.brandTheme.deleteMany({ where: { slug: TEST_SLUG } })
    await prisma.$disconnect()
  })

  it('loads defaults when the row is missing', async () => {
    const tokens = await loadTheme(prisma, TEST_SLUG)
    expect(tokens).toEqual(defaultTokens)
  })

  it('loads the DB row and serializes modified values into the CSS output', async () => {
    const modified = structuredClone(defaultTokens) as typeof defaultTokens
    ;(modified.color.brand as { primary: string }).primary = '#ff0000'
    await prisma.brandTheme.create({ data: { slug: TEST_SLUG, tokens: modified } })

    const tokens = await loadTheme(prisma, TEST_SLUG)
    expect(tokens.color.brand.primary).toBe('#ff0000')

    const css = serializeTokens(tokens)
    expect(css).toContain('--color-brand-primary: #ff0000;')
  })

  it('falls back to defaults when the stored JSON is malformed', async () => {
    // Corrupt the row via raw SQL (bypass Prisma's type-safety)
    await prisma.$executeRawUnsafe(
      `UPDATE brand_themes SET tokens = '{"wrong": true}'::jsonb WHERE slug = $1`,
      TEST_SLUG,
    )

    const tokens = await loadTheme(prisma, TEST_SLUG)
    expect(tokens).toEqual(defaultTokens)
  })
})
```

- [ ] **Step 2: Run the test locally**

```bash
pnpm --filter gr8loci test -- theme-integration
```
Expected: 3 tests pass. If DATABASE_URL is not set, the whole suite is skipped (vitest prints `skipped`).

- [ ] **Step 3: Confirm CI skips it**

Push a trial branch and watch the `test` job in GitHub Actions. The integration tests should appear as `skipped` (CI has no DATABASE_URL). Don't merge this trial — just verify skip behavior, then fold the test into the main F2 commit.

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/test/theme-integration.test.ts
git commit -m "test(gr8loci): add theme integration test (skip-if-no-DATABASE_URL)"
```

---

### Task 16: Playwright e2e — edit DB, reload, assert computed style changed

**Files:**
- Create: `apps/gr8loci/tests/e2e/theme-runtime.spec.ts`

- [ ] **Step 1: Write the test**

Create `apps/gr8loci/tests/e2e/theme-runtime.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SLUG = 'gr8loci'

test.describe('F2 theme engine — runtime edits reflect on reload', () => {
  test.beforeAll(async () => {
    // Ensure the gr8loci row exists with defaults before we mutate.
    const existing = await prisma.brandTheme.findUnique({ where: { slug: SLUG } })
    if (!existing) {
      throw new Error(
        `No BrandTheme row for slug=${SLUG}. Run prisma:seed before test:e2e.`,
      )
    }
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })

  test('changing color.brand.primary in DB updates --color-brand-primary after reload', async ({ page }) => {
    // Snapshot original tokens so we can restore at end.
    const original = await prisma.brandTheme.findUniqueOrThrow({ where: { slug: SLUG } })

    try {
      await page.goto('/')
      const before = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-brand-primary').trim(),
      )
      expect(before).toBe('#163759')

      // Mutate the DB row's brand primary.
      const tokens = structuredClone(original.tokens) as { color: { brand: { primary: string } } }
      tokens.color.brand.primary = '#ff0000'
      await prisma.brandTheme.update({
        where: { slug: SLUG },
        data: { tokens: tokens as unknown as object },
      })

      await page.reload()
      const after = await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--color-brand-primary').trim(),
      )
      expect(after).toBe('#ff0000')
    } finally {
      // Always restore, even on assertion failure.
      await prisma.brandTheme.update({
        where: { slug: SLUG },
        data: { tokens: original.tokens as object },
      })
    }
  })
})
```

- [ ] **Step 2: Run the test locally**

Ensure the dev DB is seeded (`pnpm --filter gr8loci prisma:seed`) then:

```bash
pnpm --filter gr8loci test:e2e -- theme-runtime
```
Expected: test passes. Playwright starts its own server on :3007 per F1's config.

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/tests/e2e/theme-runtime.spec.ts
git commit -m "test(gr8loci): e2e for F2 runtime theme edit-and-reload"
```

---

## Phase 7 — Production deploy

### Task 17: Set `BRAND_SLUG` in Vercel (prod + preview)

**Files:** none — this is an ops task in the Vercel dashboard.

- [ ] **Step 1: Add BRAND_SLUG to Vercel project env**

In the Vercel dashboard for the gr8loci project → Settings → Environment Variables:
- Add `BRAND_SLUG=gr8loci` to **Production**.
- Add `BRAND_SLUG=gr8loci` to **Preview**.
- (Optional) Add to **Development** if you want preview to match your local setup.

- [ ] **Step 2: Verify via the Vercel CLI**

```bash
vercel env ls
```
Expected: `BRAND_SLUG` appears for both environments. (Or verify in the dashboard.)

- [ ] **Step 3: No commit — this was a dashboard change only**

---

### Task 18: Run the Prisma migration + seed on production and preview DBs

**Files:** none — ops task.

- [ ] **Step 1: Deploy migration to production DB**

```bash
cd apps/gr8loci
DATABASE_URL='<gr8loci_prod direct URL, port 25060>' \
DIRECT_URL='<gr8loci_prod direct URL, port 25060>' \
pnpm prisma migrate deploy
```
Expected: `1 migration applied` (the `add_brand_theme` migration created in Task 9).

- [ ] **Step 2: Seed the production BrandTheme row**

```bash
DATABASE_URL='<gr8loci_prod direct URL>' \
DIRECT_URL='<gr8loci_prod direct URL>' \
ADMIN_STUB_EMAIL='<existing admin email>' \
pnpm prisma:seed
```

The admin email is required because the seed script still upserts AdminUser. Since that's an `upsert ... update: {}`, the existing admin is untouched.

Verify via psql:
```bash
PGPASSWORD='<pw>' psql 'postgresql://doadmin@<host>:25060/gr8loci_prod?sslmode=require' \
  -c "SELECT slug, jsonb_typeof(tokens) FROM brand_themes;"
```
Expected: `gr8loci | object`.

- [ ] **Step 3: Repeat for preview DB**

Same two commands with `gr8loci_preview` URLs.

- [ ] **Step 4: No commit — ops only**

---

### Task 19: Merge to main, watch the deploy, verify visual parity

**Files:** none — ops task.

- [ ] **Step 1: Push the F2 branch and open a PR**

```bash
git push -u origin f2-theme-engine
gh pr create --title "F2 — runtime theme engine" --body "Implements docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md"
```

- [ ] **Step 2: Verify the preview deploy**

Open the Vercel preview URL from the PR. Manually check:
- `/` renders with hero + 3 blog cards styled identically to pre-F2 main.
- `/blog` renders with 3 cards.
- `/blog/welcome-to-gr8loci` renders full post.
- `/about` renders about content.
- `/admin` redirects to `/admin/login` (unchanged by F2).
- DevTools → Elements → `<head>` shows inline `<style>` with `--color-brand-primary: #163759;`.
- No `<link rel="stylesheet" href="...tokens.css">` in head.

- [ ] **Step 3: Merge to main**

Once preview is verified, merge the PR. Vercel auto-deploys to production.

- [ ] **Step 4: Verify production**

Repeat Step 2's checks against the production URL. If anything looks wrong, the rollback plan (spec §12) applies: revert `apps/gr8loci/app/layout.tsx` to re-import `tokens.css` directly and redeploy. The `brand_themes` table sits unused.

- [ ] **Step 5: No commit — merge was the "commit"**

---

## Phase 8 — Docs & close-out

### Task 20: Update README, handoff, spec status, and tag release

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/handoff/README.md`
- Modify: `docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md` (status line)
- Modify: `docs/superpowers/plans/2026-04-23-f2-theme-engine.md` (this file — checkbox all complete, add completion note)

- [ ] **Step 1: Flip spec status to `shipped`**

In `docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md`, change the first `Status:` line:

```
**Status:** accepted
```
to:
```
**Status:** shipped (YYYY-MM-DD)
```

- [ ] **Step 2: Update handoff**

Open `docs/superpowers/handoff/README.md`. Replace the "As of 2026-04-23" section with a new "As of <ship date>" entry that:
- Moves F2 from "What's next" to "Shipped".
- Sets F3 (template preset system) as the new "What's next" with a one-paragraph description.
- Notes any F2 follow-ups discovered during execution (e.g., editor UI, multi-brand rollout blockers).

- [ ] **Step 3: Update README footer**

In `README.md`, add the F2 spec + plan to the Project documentation section:

```markdown
- [`docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md`](./docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md) — F2 theme engine spec
- [`docs/superpowers/plans/2026-04-23-f2-theme-engine.md`](./docs/superpowers/plans/2026-04-23-f2-theme-engine.md) — F2 implementation plan
```

Also update the "Current status" line (if the README has one) to reflect F2 shipped.

- [ ] **Step 4: Mirror the updated spec/plan/handoff into Obsidian**

```bash
cp docs/superpowers/specs/2026-04-23-f2-theme-engine-design.md \
   '/Users/davidwellman2/Documents/vault-dw2-notes-remote/04-Projects/gr8loci_newBuild/specs/'
cp docs/superpowers/plans/2026-04-23-f2-theme-engine.md \
   '/Users/davidwellman2/Documents/vault-dw2-notes-remote/04-Projects/gr8loci_newBuild/plans/'
cp docs/superpowers/handoff/README.md \
   '/Users/davidwellman2/Documents/vault-dw2-notes-remote/04-Projects/gr8loci_newBuild/handoff/'
```

- [ ] **Step 5: Tag the release**

```bash
git add -A
git commit -m "docs: mark F2 theme engine shipped; set F3 as next target"
git push
git tag -a f2-complete -m "F2: runtime-editable theme tokens via BrandTheme + Prisma"
git push --tags
```

- [ ] **Step 6: Final DoD walkthrough (spec §13)**

Verify each of the 12 DoD items:

1. ✅ `BrandTheme` model exists; migration applied to local + prod + preview
2. ✅ Seed populates `slug: "gr8loci"` with `defaultTokens`
3. ✅ `@platform/design-system` exports `runtime/loadTheme`, `runtime/serializeTokens`, `runtime/ThemeStyle`, `defaultTokens`, `breakpoints`, `TokensSchema`
4. ✅ `apps/gr8loci/app/layout.tsx` mounts `<ThemeStyle prisma={prisma} slug={process.env.BRAND_SLUG ?? 'gr8loci'} />`
5. ✅ `BRAND_SLUG=gr8loci` set in local, preview, production
6. ✅ Unit tests passing (byte-equivalence, fallback behavior, schema roundtrip)
7. ✅ Integration test passing locally (skipped in CI; documented)
8. ✅ E2E test passing (edit DB → reload → computed style changed)
9. ✅ `scripts/generate-tokens.ts` and committed `tokens.css` deleted
10. ✅ Production site renders visually identical to pre-F2
11. ✅ README + handoff updated; F3 set as next
12. ✅ Spec tagged `shipped`

If any item is ❌, do not tag `f2-complete`. Fix the gap and re-verify.

---

## Self-Review

### Spec coverage
- [x] §4 non-goals → all respected (no admin UI, no versioning, no dark mode, no Mantine pivot, no breakpoint runtime, no per-component theming)
- [x] §5 architecture → Tasks 5–8 (runtime package), Task 9 (model), Task 12 (app wiring)
- [x] §6.1 Prisma schema → Task 9
- [x] §6.2 TokensSchema exact-keyed shape → Task 2
- [x] §6.3 defaultTokens + breakpoints refactor → Task 3
- [x] §7.1 loadTheme with React.cache + fallback → Task 6
- [x] §7.2 serializeTokens byte-equivalent to F1 → Tasks 4–5
- [x] §7.3 ThemeStyle RSC → Task 7
- [x] §7.4 app-side wiring → Task 12
- [x] §7.5 no explicit revalidation in F2 → no task needed; documented by omission
- [x] §8 migration sequence → Tasks 9–14
- [x] §9.1 unit tests (byte-equivalence + fallback + schema) → Tasks 5–6
- [x] §9.2 integration test w/ skip-in-CI → Task 15
- [x] §9.3 e2e edit-and-reload → Task 16
- [x] §9.4 visual regression deferred → respected (no task)
- [x] §10 observability — three log lines, stderr only → implemented in Task 6
- [x] §11 security — dangerouslySetInnerHTML only over Zod-validated values → Task 7
- [x] §12 rollback plan — revert layout.tsx → Task 19 mentions
- [x] §13 DoD 12 items → Task 20 Step 6 walks through each

### Placeholder scan
- No "TBD" / "TODO" / "implement later" in any task body
- Every code step shows the full code
- Every command step shows exact command + expected output
- Types consistent: `BrandThemePrismaClient` interface identical in Tasks 6 and 7; `Tokens` type identical in all references
- `defaultTokens`, `TokensSchema`, `loadTheme`, `serializeTokens`, `ThemeStyle` names match across Tasks 2, 3, 5, 6, 7, 8, 12, 15, 16, 20
- Paths verified against F1 actual layout: `apps/gr8loci/app/layout.tsx` (not `apps/gr8loci/src/app/layout.tsx` — the spec had this wrong, plan corrects)
- Prisma model name: `BrandTheme` (camelCase in Prisma Client, `brand_themes` snake_case in SQL via `@@map`)

### Known human-blocking ops steps
Tasks 9 (prisma migrate dev requires confirmation on the first run), 17 (Vercel dashboard), 18 (prod DB migration), 19 (merge/verify). These are labeled and kept short.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-f2-theme-engine.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks. Best for an opus-driven implementation that wants clean per-task context.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with human checkpoints.

Which approach?
