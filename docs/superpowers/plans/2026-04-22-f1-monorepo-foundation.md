# F1 Monorepo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Turborepo + pnpm monorepo containing one Next.js 15 app (`apps/gr8loci`) rendering four demo pages end-to-end, styled through a shared design-system package, gated by a swappable auth abstraction (stub implementation), deployed to Vercel production and connected to DigitalOcean Postgres.

**Architecture:** Monorepo (Turborepo + pnpm workspaces). Apps are independently deployable Next.js projects. Shared `packages/design-system` provides tokens + UI primitives via CSS Modules and CSS custom properties. Shared `packages/auth` wraps authentication behind an `AuthProvider` interface with a disposable JWT stub. Prisma ORM targets PostgreSQL, one database per brand on a shared DO managed cluster.

**Tech Stack:** Node 20 LTS, pnpm 9, Turborepo 2, Next.js 15, React 19, TypeScript 5.5+ (strict), Prisma 6, PostgreSQL 16, jose (JWT), Vitest, Playwright, GitHub Actions, Vercel, DigitalOcean Managed Postgres.

**Reference spec:** `docs/superpowers/specs/2026-04-22-f1-monorepo-foundation-design.md`

---

## File Structure Overview

Produced by this plan (in the NEW `gr8loci-platform` repo, not the current repo):

```
gr8loci-platform/
├── apps/gr8loci/
│   ├── app/
│   │   ├── layout.tsx, page.tsx, globals.css
│   │   ├── blog/page.tsx, blog/[slug]/page.tsx
│   │   ├── about/page.tsx
│   │   └── (admin)/admin/page.tsx, (admin)/admin/login/page.tsx
│   ├── components/BlogGrid.tsx, HeroSection.tsx, SiteHeader.tsx, SiteFooter.tsx
│   ├── lib/db.ts, lib/content.ts, lib/auth-actions.ts
│   ├── prisma/schema.prisma, prisma/seed.ts, prisma/migrations/
│   ├── public/hero-*.jpg
│   ├── middleware.ts, next.config.ts, tsconfig.json, package.json
├── packages/
│   ├── design-system/
│   │   ├── src/tokens/index.ts
│   │   ├── src/components/{Button,Card,Typography,Layout,Input,Icon}/*.{tsx,module.css}
│   │   ├── src/content/{schema.ts,RichContent.tsx}
│   │   ├── src/index.ts, src/server.ts
│   │   ├── scripts/generate-tokens.ts
│   │   ├── tokens.css (generated, committed)
│   │   └── package.json
│   ├── auth/
│   │   ├── src/types.ts, src/providers/stub.ts, src/index.ts
│   │   └── package.json
│   ├── config-typescript/base.json, nextjs.json, package-config.json
│   ├── config-eslint/index.js
│   └── config-prettier/index.js
├── .github/workflows/ci.yml
├── package.json, pnpm-workspace.yaml, turbo.json
├── .gitignore, .nvmrc, .npmrc, .env.example
└── README.md
```

---

## Pre-flight (human steps before Task 1)

Before any code, the developer needs three accounts and one DB:

1. **GitHub account** — already exists (`welly-bda`)
2. **Vercel account** — sign up at vercel.com with GitHub login if not already
3. **DigitalOcean account** — already exists (has Postgres cluster)
4. **Verify local tooling** on the M4 Mac Mini:

```bash
# Check / install Homebrew
brew --version || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Check / install Node 20 via nvm (or fnm)
node -v                                        # expect v20.x
# If not: brew install nvm && nvm install 20 && nvm use 20

# Check / install pnpm
pnpm -v                                        # expect 9.x
# If not: npm install -g pnpm@9

# Check / install PostgreSQL 16
psql --version                                 # expect 16.x
# If not: brew install postgresql@16 && brew services start postgresql@16

# Verify local Postgres is accepting connections
psql postgres -c 'SELECT version();'
```

If any verification fails, install and retry before proceeding.

---

## Phase 1 — Monorepo scaffold

### Task 1: Create empty GitHub repo and clone locally

**Files:**
- Create: `~/Developer/ClaudeDev-local/gr8loci-platform/` (working directory for all subsequent tasks)

- [ ] **Step 1: Create repository on GitHub**

In browser, go to https://github.com/new. Set:
- Owner: `welly-bda`
- Repository name: `gr8loci-platform`
- Description: "Multi-brand content platform — monorepo for gr8loci.online, m-sew.com, breadmons.com, prostateawarenessbermuda.com"
- Visibility: Private
- Initialize with: nothing (no README, no .gitignore, no license)

Click "Create repository."

- [ ] **Step 2: Clone locally**

```bash
cd ~/Developer/ClaudeDev-local
git clone git@github.com:welly-bda/gr8loci-platform.git
cd gr8loci-platform
```

- [ ] **Step 3: Verify clean state**

```bash
git status
# expect: On branch main, nothing to commit, working tree clean
```

- [ ] **Step 4: Create initial README placeholder**

Write `README.md`:

```markdown
# gr8loci-platform

Multi-brand content platform. See `docs/` for architecture and specs.

This repo is under active development. README expands when F1 ships.
```

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "chore: initial commit"
git push -u origin main
```

---

### Task 2: Initialize pnpm workspace + Turborepo + Node pin

**Files:**
- Create: `.nvmrc`, `.npmrc`, `.gitignore`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`

- [ ] **Step 1: Pin Node version**

Write `.nvmrc`:

```
20
```

- [ ] **Step 2: Configure pnpm behavior**

Write `.npmrc`:

```
engine-strict=true
strict-peer-dependencies=false
auto-install-peers=true
```

- [ ] **Step 3: Write comprehensive .gitignore**

Write `.gitignore`:

```
# Dependencies
node_modules/
.pnpm-store/

# Next.js
.next/
out/
next-env.d.ts

# Turbo
.turbo/

# Environment files
.env
.env.local
.env.*.local

# Build outputs
dist/
build/
*.tsbuildinfo

# Editor/OS
.DS_Store
.idea/
.vscode/
*.swp

# Logs
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage/
playwright-report/
test-results/

# Prisma
**/prisma/*.db
**/prisma/*.db-journal
```

- [ ] **Step 4: Create root package.json**

Write `package.json`:

```json
{
  "name": "gr8loci-platform",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.15.0",
  "engines": {
    "node": ">=20",
    "pnpm": ">=9"
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "clean": "turbo run clean && rm -rf node_modules"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 5: Create pnpm workspace config**

Write `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 6: Create Turborepo config**

Write `turbo.json`:

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

- [ ] **Step 7: Install dependencies**

```bash
pnpm install
```

Expected output ends with: `Done in <N>s` and a `node_modules/` + `pnpm-lock.yaml` exist.

- [ ] **Step 8: Verify turbo runs**

```bash
pnpm turbo --version
# expect: 2.x.x
```

- [ ] **Step 9: Commit**

```bash
git add .nvmrc .npmrc .gitignore package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml
git commit -m "chore: initialize pnpm workspace with turborepo"
git push
```

---

### Task 3: Create shared TypeScript config package

**Files:**
- Create: `packages/config-typescript/package.json`, `base.json`, `nextjs.json`, `package.json`

- [ ] **Step 1: Create package directory structure**

```bash
mkdir -p packages/config-typescript
cd packages/config-typescript
```

- [ ] **Step 2: Write package.json**

Write `packages/config-typescript/package.json`:

```json
{
  "name": "@platform/config-typescript",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "nextjs.json", "package-config.json"]
}
```

- [ ] **Step 3: Write base TS config**

Write `packages/config-typescript/base.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 4: Write Next.js-specific TS config**

Write `packages/config-typescript/nextjs.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "noEmit": true,
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  }
}
```

- [ ] **Step 5: Write package-library TS config**

Write `packages/config-typescript/package-config.json`:

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: Re-install to register workspace package**

```bash
cd ../..
pnpm install
```

Expected: `+ @platform/config-typescript 0.0.0` in output.

- [ ] **Step 7: Commit**

```bash
git add packages/config-typescript pnpm-lock.yaml
git commit -m "chore: add shared TypeScript config package"
git push
```

---

### Task 4: Create shared ESLint config package

**Files:**
- Create: `packages/config-eslint/package.json`, `index.js`

- [ ] **Step 1: Create package scaffold**

```bash
mkdir -p packages/config-eslint
```

- [ ] **Step 2: Write package.json**

Write `packages/config-eslint/package.json`:

```json
{
  "name": "@platform/config-eslint",
  "version": "0.0.0",
  "private": true,
  "main": "index.js",
  "dependencies": {
    "@typescript-eslint/eslint-plugin": "^8.15.0",
    "@typescript-eslint/parser": "^8.15.0",
    "eslint": "^9.15.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-react": "^7.37.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "typescript-eslint": "^8.15.0"
  }
}
```

- [ ] **Step 3: Write flat config**

Write `packages/config-eslint/index.js`:

```js
const js = require('@eslint/js')
const tseslint = require('typescript-eslint')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')
const prettier = require('eslint-config-prettier')

module.exports = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
    settings: {
      react: { version: 'detect' },
    },
  },
  prettier,
]
```

- [ ] **Step 4: Install & wire up**

```bash
pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add packages/config-eslint pnpm-lock.yaml
git commit -m "chore: add shared ESLint config package"
git push
```

---

### Task 5: Create shared Prettier config package

**Files:**
- Create: `packages/config-prettier/package.json`, `index.js`

- [ ] **Step 1: Create package scaffold**

```bash
mkdir -p packages/config-prettier
```

- [ ] **Step 2: Write package.json**

Write `packages/config-prettier/package.json`:

```json
{
  "name": "@platform/config-prettier",
  "version": "0.0.0",
  "private": true,
  "main": "index.js"
}
```

- [ ] **Step 3: Write Prettier config**

Write `packages/config-prettier/index.js`:

```js
module.exports = {
  semi: false,
  singleQuote: true,
  jsxSingleQuote: false,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
}
```

- [ ] **Step 4: Install**

```bash
pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add packages/config-prettier pnpm-lock.yaml
git commit -m "chore: add shared Prettier config package"
git push
```

---

### Task 6: Wire GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write CI workflow**

Write `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    name: Lint, Typecheck, Build, Test
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Build
        run: pnpm build

      - name: Test
        run: pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add lint+typecheck+build+test workflow"
git push
```

- [ ] **Step 4: Verify workflow triggers**

In browser, go to `https://github.com/welly-bda/gr8loci-platform/actions` and confirm the workflow started on the push. It may fail right now (no apps/packages defined with these scripts yet) — that's expected. It will pass once later tasks wire up the scripts.

---

## Phase 2 — Design system package

### Task 7: Create `packages/design-system` scaffold

**Files:**
- Create: `packages/design-system/package.json`, `tsconfig.json`, `src/index.ts`, `src/server.ts`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p packages/design-system/src/{tokens,components,content}
mkdir -p packages/design-system/scripts
```

- [ ] **Step 2: Write package.json**

Write `packages/design-system/package.json`:

```json
{
  "name": "@platform/design-system",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./server": "./src/server.ts",
    "./tokens.css": "./tokens.css"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "generate:tokens": "tsx scripts/generate-tokens.ts",
    "clean": "rm -rf dist tokens.css"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lucide-react": "^0.460.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@platform/config-eslint": "workspace:*",
    "@platform/config-typescript": "workspace:*",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.1.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "happy-dom": "^15.11.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: Write tsconfig.json**

Write `packages/design-system/tsconfig.json`:

```json
{
  "extends": "@platform/config-typescript/package-config.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.*"]
}
```

- [ ] **Step 4: Write placeholder entry points (to be filled later)**

Write `packages/design-system/src/index.ts`:

```ts
// Client-safe entry. Grows as primitives are added.
export {} // temporary — removed when first real export lands in Task 10
```

Write `packages/design-system/src/server.ts`:

```ts
// Server-only entry for utilities that need server runtime (none in F1 yet).
export {} // temporary
```

- [ ] **Step 5: Install**

```bash
pnpm install
```

- [ ] **Step 6: Commit**

```bash
git add packages/design-system pnpm-lock.yaml
git commit -m "feat(design-system): create package scaffold"
git push
```

---

### Task 8: Define design tokens (TypeScript source of truth)

**Files:**
- Create: `packages/design-system/src/tokens/index.ts`

- [ ] **Step 1: Write tokens module**

Write `packages/design-system/src/tokens/index.ts`:

```ts
export const tokens = {
  color: {
    brand: {
      primary: '#163759',
      primaryMuted: '#2a4f73',
      accent: '#20b2aa',
    },
    neutral: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
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
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    6: '1.5rem',
    8: '2rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
    32: '8rem',
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
  breakpoint: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    '2xl': 1536,
  },
} as const

export type Tokens = typeof tokens
```

- [ ] **Step 2: Re-export from index**

Edit `packages/design-system/src/index.ts`:

```ts
export { tokens } from './tokens'
export type { Tokens } from './tokens'
```

- [ ] **Step 3: Verify typecheck passes**

```bash
pnpm --filter @platform/design-system typecheck
# expect: clean exit, no errors
```

- [ ] **Step 4: Commit**

```bash
git add packages/design-system/src
git commit -m "feat(design-system): define token vocabulary"
git push
```

---

### Task 9: Write token generation script (CSS custom properties)

**Files:**
- Create: `packages/design-system/scripts/generate-tokens.ts`
- Create: `packages/design-system/tokens.css` (generated, committed)

- [ ] **Step 1: Write the generator**

Write `packages/design-system/scripts/generate-tokens.ts`:

```ts
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tokens } from '../src/tokens/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

type Leaf = string | number
type Tree = { [k: string]: Leaf | Tree }

function flatten(tree: Tree, prefix = ''): Array<[string, Leaf]> {
  const out: Array<[string, Leaf]> = []
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}-${k}` : k
    if (v !== null && typeof v === 'object') {
      out.push(...flatten(v as Tree, key))
    } else {
      out.push([key, v])
    }
  }
  return out
}

function toCssVars(category: string, tree: Tree): string[] {
  return flatten(tree).map(([k, v]) => `  --${category}-${k}: ${v};`)
}

const lines: string[] = [
  '/* AUTO-GENERATED from src/tokens/index.ts — do not edit by hand. */',
  '/* Regenerate with: pnpm --filter @platform/design-system generate:tokens */',
  '',
  ':root {',
  ...toCssVars('color', tokens.color as Tree),
  ...toCssVars('font', tokens.typography.fontFamily as Tree).map((l) => l.replace('--font-', '--font-family-')),
  ...toCssVars('font-size', tokens.typography.fontSize as Tree),
  ...toCssVars('font-weight', tokens.typography.fontWeight as Tree),
  ...toCssVars('line-height', tokens.typography.lineHeight as Tree),
  ...toCssVars('space', tokens.spacing as Tree),
  ...toCssVars('radius', tokens.radius as Tree),
  ...toCssVars('shadow', tokens.shadow as Tree),
  '}',
  '',
]

const outputPath = resolve(__dirname, '..', 'tokens.css')
writeFileSync(outputPath, lines.join('\n'), 'utf8')
console.log(`Wrote ${outputPath}`)
```

- [ ] **Step 2: Run the generator**

```bash
pnpm --filter @platform/design-system generate:tokens
# expect: "Wrote /path/to/packages/design-system/tokens.css"
```

- [ ] **Step 3: Inspect generated file**

```bash
cat packages/design-system/tokens.css | head -20
```

Expected: first lines are the auto-generated header and `:root {` followed by `--color-brand-primary: #163759;` etc.

- [ ] **Step 4: Wire build script to regenerate tokens**

Edit `packages/design-system/package.json`, update `"build"`:

```json
"build": "pnpm run generate:tokens && tsc",
```

- [ ] **Step 5: Commit**

```bash
git add packages/design-system/scripts packages/design-system/tokens.css packages/design-system/package.json
git commit -m "feat(design-system): generate tokens.css from TS source"
git push
```

---

### Task 10: Build Button primitive (TDD)

**Files:**
- Create: `packages/design-system/src/components/Button/Button.tsx`, `Button.module.css`, `Button.test.tsx`, `index.ts`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Set up Vitest config for the package**

Write `packages/design-system/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

Write `packages/design-system/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2: Write the failing test**

Write `packages/design-system/src/components/Button/Button.test.tsx`:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Click</Button>)
    screen.getByRole('button').click()
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('applies variant class', () => {
    render(<Button variant="danger">Delete</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('danger')
  })

  it('applies size class', () => {
    render(<Button size="sm">Small</Button>)
    const btn = screen.getByRole('button')
    expect(btn.className).toContain('sm')
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

- [ ] **Step 3: Run test — expect failure**

```bash
pnpm --filter @platform/design-system test
# expect: Cannot find module './Button' — or similar
```

- [ ] **Step 4: Implement Button component**

Write `packages/design-system/src/components/Button/Button.tsx`:

```tsx
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import clsx from 'clsx'
import styles from './Button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(styles.button, styles[variant], styles[size], className)}
      {...rest}
    />
  )
})
```

- [ ] **Step 5: Write styles**

Write `packages/design-system/src/components/Button/Button.module.css`:

```css
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-family-sans);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-md);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, color 120ms ease;
  text-decoration: none;
}

.button:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px var(--color-brand-accent);
}

.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Sizes */
.sm {
  padding: var(--space-1) var(--space-3);
  font-size: var(--font-size-sm);
}
.md {
  padding: var(--space-2) var(--space-4);
  font-size: var(--font-size-base);
}
.lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--font-size-lg);
}

/* Variants */
.primary {
  background: var(--color-brand-primary);
  color: var(--color-text-inverse);
}
.primary:hover:not(:disabled) {
  background: var(--color-brand-primaryMuted);
}

.secondary {
  background: var(--color-neutral-100);
  color: var(--color-text-primary);
  border-color: var(--color-neutral-300);
}
.secondary:hover:not(:disabled) {
  background: var(--color-neutral-200);
}

.ghost {
  background: transparent;
  color: var(--color-text-primary);
}
.ghost:hover:not(:disabled) {
  background: var(--color-neutral-100);
}

.danger {
  background: var(--color-semantic-danger);
  color: var(--color-text-inverse);
}
.danger:hover:not(:disabled) {
  background: var(--color-semantic-dangerHover);
}
```

- [ ] **Step 6: Create barrel export**

Write `packages/design-system/src/components/Button/index.ts`:

```ts
export { Button } from './Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button'
```

- [ ] **Step 7: Update package-level exports**

Edit `packages/design-system/src/index.ts`:

```ts
export { tokens } from './tokens'
export type { Tokens } from './tokens'

export { Button } from './components/Button'
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button'
```

- [ ] **Step 8: Handle CSS Modules typing**

Write `packages/design-system/src/css-modules.d.ts`:

```ts
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
```

- [ ] **Step 9: Run test — expect PASS**

```bash
pnpm --filter @platform/design-system test
# expect: 5 tests passed
```

- [ ] **Step 10: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): add Button primitive with tests"
git push
```

---

### Task 11: Build Card primitive (TDD)

**Files:**
- Create: `packages/design-system/src/components/Card/Card.tsx`, `Card.module.css`, `Card.test.tsx`, `index.ts`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/design-system/src/components/Card/Card.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello</Card>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('applies variant class (elevated)', () => {
    const { container } = render(<Card variant="elevated">x</Card>)
    expect(container.firstChild).toHaveClass(expect.stringContaining('elevated'))
  })

  it('applies variant class (outlined)', () => {
    const { container } = render(<Card variant="outlined">x</Card>)
    expect(container.firstChild).toHaveClass(expect.stringContaining('outlined'))
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
pnpm --filter @platform/design-system test Card
# expect: module not found
```

- [ ] **Step 3: Implement Card**

Write `packages/design-system/src/components/Card/Card.tsx`:

```tsx
import { HTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Card.module.css'

export type CardVariant = 'elevated' | 'outlined' | 'flat'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  as?: 'div' | 'article' | 'section'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'elevated', as: Component = 'div', className, ...rest },
  ref,
) {
  return (
    <Component ref={ref} className={clsx(styles.card, styles[variant], className)} {...rest} />
  )
})
```

- [ ] **Step 4: Write styles**

Write `packages/design-system/src/components/Card/Card.module.css`:

```css
.card {
  background: var(--color-surface-card);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
}

.elevated {
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-neutral-100);
}

.outlined {
  border: 1px solid var(--color-neutral-200);
}

.flat {
  background: var(--color-neutral-50);
}
```

- [ ] **Step 5: Barrel + package export**

Write `packages/design-system/src/components/Card/index.ts`:

```ts
export { Card } from './Card'
export type { CardProps, CardVariant } from './Card'
```

Edit `packages/design-system/src/index.ts` — append:

```ts
export { Card } from './components/Card'
export type { CardProps, CardVariant } from './components/Card'
```

- [ ] **Step 6: Run test — expect PASS**

```bash
pnpm --filter @platform/design-system test Card
# expect: 3 tests passed
```

- [ ] **Step 7: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): add Card primitive with tests"
git push
```

---

### Task 12: Build Typography primitives (Heading, Text, Link)

**Files:**
- Create: `packages/design-system/src/components/Typography/Typography.tsx`, `Typography.module.css`, `Typography.test.tsx`, `index.ts`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Write the failing test**

Write `packages/design-system/src/components/Typography/Typography.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Heading, Text, Link } from './Typography'

describe('Heading', () => {
  it('renders h1 by default', () => {
    render(<Heading>Hello</Heading>)
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeInTheDocument()
  })

  it('renders at specified level', () => {
    render(<Heading level={3}>Sub</Heading>)
    expect(screen.getByRole('heading', { level: 3, name: 'Sub' })).toBeInTheDocument()
  })
})

describe('Text', () => {
  it('renders a paragraph', () => {
    render(<Text>Body</Text>)
    expect(screen.getByText('Body').tagName).toBe('P')
  })

  it('renders inline when specified', () => {
    render(<Text as="span">Inline</Text>)
    expect(screen.getByText('Inline').tagName).toBe('SPAN')
  })
})

describe('Link', () => {
  it('renders an anchor', () => {
    render(<Link href="/about">About</Link>)
    const link = screen.getByRole('link', { name: 'About' })
    expect(link).toHaveAttribute('href', '/about')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @platform/design-system test Typography
```

- [ ] **Step 3: Implement**

Write `packages/design-system/src/components/Typography/Typography.tsx`:

```tsx
import { AnchorHTMLAttributes, HTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Typography.module.css'

type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: HeadingLevel
}

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(
  { level = 1, className, ...rest },
  ref,
) {
  const Tag = `h${level}` as const
  return <Tag ref={ref} className={clsx(styles.heading, styles[`h${level}`], className)} {...rest} />
})

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: 'p' | 'span' | 'div'
  size?: 'sm' | 'base' | 'lg'
}

export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as: Component = 'p', size = 'base', className, ...rest },
  ref,
) {
  return <Component ref={ref as never} className={clsx(styles.text, styles[`text-${size}`], className)} {...rest} />
})

export interface LinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {}

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { className, ...rest },
  ref,
) {
  return <a ref={ref} className={clsx(styles.link, className)} {...rest} />
})
```

- [ ] **Step 4: Styles**

Write `packages/design-system/src/components/Typography/Typography.module.css`:

```css
.heading {
  font-family: var(--font-family-sans);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: var(--line-height-tight);
  margin: 0;
}

.h1 { font-size: var(--font-size-5xl); }
.h2 { font-size: var(--font-size-4xl); }
.h3 { font-size: var(--font-size-3xl); }
.h4 { font-size: var(--font-size-2xl); }
.h5 { font-size: var(--font-size-xl); }
.h6 { font-size: var(--font-size-lg); }

.text {
  font-family: var(--font-family-sans);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
  margin: 0;
}

.text-sm { font-size: var(--font-size-sm); }
.text-base { font-size: var(--font-size-base); }
.text-lg { font-size: var(--font-size-lg); }

.link {
  color: var(--color-text-link);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.link:hover {
  text-decoration-thickness: 2px;
}
.link:focus-visible {
  outline: 2px solid var(--color-brand-accent);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}
```

- [ ] **Step 5: Barrel + package export**

Write `packages/design-system/src/components/Typography/index.ts`:

```ts
export { Heading, Text, Link } from './Typography'
export type { HeadingProps, TextProps, LinkProps } from './Typography'
```

Append to `packages/design-system/src/index.ts`:

```ts
export { Heading, Text, Link } from './components/Typography'
export type { HeadingProps, TextProps, LinkProps } from './components/Typography'
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
pnpm --filter @platform/design-system test Typography
```

- [ ] **Step 7: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): add Heading, Text, Link primitives"
git push
```

---

### Task 13: Build Layout primitives (Stack, Row, Container)

**Files:**
- Create: `packages/design-system/src/components/Layout/Layout.tsx`, `Layout.module.css`, `Layout.test.tsx`, `index.ts`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Test**

Write `packages/design-system/src/components/Layout/Layout.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stack, Row, Container } from './Layout'

describe('Stack', () => {
  it('renders children in a flex column', () => {
    render(<Stack><span>a</span><span>b</span></Stack>)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })
})

describe('Row', () => {
  it('renders children in a flex row', () => {
    render(<Row><span>a</span><span>b</span></Row>)
    expect(screen.getByText('a')).toBeInTheDocument()
  })
})

describe('Container', () => {
  it('wraps children', () => {
    render(<Container><span>inside</span></Container>)
    expect(screen.getByText('inside')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @platform/design-system test Layout
```

- [ ] **Step 3: Implement**

Write `packages/design-system/src/components/Layout/Layout.tsx`:

```tsx
import { HTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Layout.module.css'

type GapToken = 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16

interface StackOrRowProps extends HTMLAttributes<HTMLDivElement> {
  gap?: GapToken
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
}

export interface StackProps extends StackOrRowProps {}
export interface RowProps extends StackOrRowProps {}

export const Stack = forwardRef<HTMLDivElement, StackProps>(function Stack(
  { gap = 4, align = 'stretch', justify = 'start', className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={clsx(styles.stack, className)}
      style={{
        gap: `var(--space-${gap})`,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        ...style,
      }}
      {...rest}
    />
  )
})

export const Row = forwardRef<HTMLDivElement, RowProps>(function Row(
  { gap = 4, align = 'center', justify = 'start', className, style, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={clsx(styles.row, className)}
      style={{
        gap: `var(--space-${gap})`,
        alignItems: alignMap[align],
        justifyContent: justifyMap[justify],
        ...style,
      }}
      {...rest}
    />
  )
})

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(function Container(
  { maxWidth = 'lg', className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={clsx(styles.container, styles[`maxw-${maxWidth}`], className)} {...rest} />
  )
})

const alignMap = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' } as const
const justifyMap = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' } as const
```

- [ ] **Step 4: Styles**

Write `packages/design-system/src/components/Layout/Layout.module.css`:

```css
.stack {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.container {
  margin-inline: auto;
  padding-inline: var(--space-4);
  width: 100%;
}

.maxw-sm { max-width: 640px; }
.maxw-md { max-width: 768px; }
.maxw-lg { max-width: 1024px; }
.maxw-xl { max-width: 1280px; }
.maxw-2xl { max-width: 1536px; }
```

- [ ] **Step 5: Barrel + export**

Write `packages/design-system/src/components/Layout/index.ts`:

```ts
export { Stack, Row, Container } from './Layout'
export type { StackProps, RowProps, ContainerProps } from './Layout'
```

Append to `packages/design-system/src/index.ts`:

```ts
export { Stack, Row, Container } from './components/Layout'
export type { StackProps, RowProps, ContainerProps } from './components/Layout'
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @platform/design-system test Layout
```

- [ ] **Step 7: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): add Stack, Row, Container primitives"
git push
```

---

### Task 14: Build Input primitive (TDD)

**Files:**
- Create: `packages/design-system/src/components/Input/Input.tsx`, `Input.module.css`, `Input.test.tsx`, `index.ts`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Test**

Write `packages/design-system/src/components/Input/Input.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from './Input'

describe('Input', () => {
  it('renders a text input by default', () => {
    render(<Input label="Email" id="email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders an error message when provided', () => {
    render(<Input label="Email" id="email" error="Invalid" />)
    expect(screen.getByText('Invalid')).toBeInTheDocument()
  })

  it('marks input as invalid when error present', () => {
    render(<Input label="Email" id="email" error="Invalid" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @platform/design-system test Input
```

- [ ] **Step 3: Implement**

Write `packages/design-system/src/components/Input/Input.tsx`:

```tsx
import { InputHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'
import styles from './Input.module.css'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string
  label: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { id, label, error, className, ...rest },
  ref,
) {
  const errorId = error ? `${id}-error` : undefined
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className={clsx(styles.input, error && styles.invalid, className)}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={errorId}
        {...rest}
      />
      {error && (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  )
})
```

- [ ] **Step 4: Styles**

Write `packages/design-system/src/components/Input/Input.module.css`:

```css
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.label {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.input {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-neutral-300);
  border-radius: var(--radius-md);
  background: var(--color-surface-card);
}

.input:focus-visible {
  outline: 2px solid var(--color-brand-accent);
  outline-offset: 1px;
  border-color: var(--color-brand-primary);
}

.invalid {
  border-color: var(--color-semantic-danger);
}

.error {
  font-family: var(--font-family-sans);
  font-size: var(--font-size-sm);
  color: var(--color-semantic-danger);
  margin: 0;
}
```

- [ ] **Step 5: Barrel + export**

Write `packages/design-system/src/components/Input/index.ts`:

```ts
export { Input } from './Input'
export type { InputProps } from './Input'
```

Append to `packages/design-system/src/index.ts`:

```ts
export { Input } from './components/Input'
export type { InputProps } from './components/Input'
```

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @platform/design-system test Input
```

- [ ] **Step 7: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): add Input primitive with label + error slot"
git push
```

---

### Task 15: Build Icon primitive (Lucide wrapper)

**Files:**
- Create: `packages/design-system/src/components/Icon/Icon.tsx`, `Icon.test.tsx`, `index.ts`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Test**

Write `packages/design-system/src/components/Icon/Icon.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ArrowRight } from 'lucide-react'
import { Icon } from './Icon'

describe('Icon', () => {
  it('renders an SVG at the default size', () => {
    const { container } = render(<Icon as={ArrowRight} aria-label="forward" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('width')).toBe('20')
  })

  it('respects size prop', () => {
    const { container } = render(<Icon as={ArrowRight} size="lg" aria-label="forward" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('28')
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @platform/design-system test Icon
```

- [ ] **Step 3: Implement**

Write `packages/design-system/src/components/Icon/Icon.tsx`:

```tsx
import type { ComponentType, SVGProps } from 'react'

export type IconSize = 'sm' | 'md' | 'lg' | 'xl'

const SIZE_PX: Record<IconSize, number> = { sm: 16, md: 20, lg: 28, xl: 36 }

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  as: ComponentType<SVGProps<SVGSVGElement> & { size?: number }>
  size?: IconSize
}

export function Icon({ as: Component, size = 'md', ...rest }: IconProps) {
  const px = SIZE_PX[size]
  return <Component width={px} height={px} aria-hidden={rest['aria-label'] ? undefined : true} {...rest} />
}
```

- [ ] **Step 4: Barrel + export**

Write `packages/design-system/src/components/Icon/index.ts`:

```ts
export { Icon } from './Icon'
export type { IconProps, IconSize } from './Icon'
```

Append to `packages/design-system/src/index.ts`:

```ts
export { Icon } from './components/Icon'
export type { IconProps, IconSize } from './components/Icon'
```

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @platform/design-system test Icon
```

- [ ] **Step 6: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): add Icon wrapper over lucide-react"
git push
```

---

### Task 16: Define rich content JSON schema

**Files:**
- Create: `packages/design-system/src/content/schema.ts`, `schema.test.ts`

- [ ] **Step 1: Test schema types**

Write `packages/design-system/src/content/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isRichContent, type RichContent } from './schema'

describe('content schema', () => {
  it('accepts a minimal valid document', () => {
    const doc: RichContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi' }] }],
    }
    expect(isRichContent(doc)).toBe(true)
  })

  it('rejects non-object input', () => {
    expect(isRichContent('nope')).toBe(false)
    expect(isRichContent(null)).toBe(false)
  })

  it('rejects missing type', () => {
    expect(isRichContent({ content: [] })).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @platform/design-system test schema
```

- [ ] **Step 3: Implement schema + guard**

Write `packages/design-system/src/content/schema.ts`:

```ts
/**
 * Structured rich-content JSON schema. Tiptap/ProseMirror-compatible.
 * Editor choice (Tiptap / Lexical / BlockNote) is implementation detail;
 * the serialized document conforms to this shape.
 */

export type TextMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'link'; attrs: { href: string } }

export type TextNode = {
  type: 'text'
  text: string
  marks?: TextMark[]
}

export type ParagraphNode = {
  type: 'paragraph'
  content?: InlineNode[]
}

export type HeadingNode = {
  type: 'heading'
  attrs: { level: 1 | 2 | 3 | 4 | 5 | 6 }
  content?: InlineNode[]
}

export type BulletListNode = { type: 'bulletList'; content?: ListItemNode[] }
export type OrderedListNode = { type: 'orderedList'; content?: ListItemNode[] }
export type ListItemNode = { type: 'listItem'; content?: BlockNode[] }

export type BlockquoteNode = { type: 'blockquote'; content?: BlockNode[] }

export type ImageNode = {
  type: 'image'
  attrs: { src: string; alt?: string; title?: string }
}

export type HorizontalRuleNode = { type: 'horizontalRule' }

export type InlineNode = TextNode
export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | BulletListNode
  | OrderedListNode
  | BlockquoteNode
  | ImageNode
  | HorizontalRuleNode

export type RichContent = {
  type: 'doc'
  content: BlockNode[]
}

export function isRichContent(value: unknown): value is RichContent {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return v.type === 'doc' && Array.isArray(v.content)
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @platform/design-system test schema
```

- [ ] **Step 5: Export from package**

Append to `packages/design-system/src/index.ts`:

```ts
export { isRichContent } from './content/schema'
export type {
  RichContent,
  BlockNode,
  InlineNode,
  TextNode,
  TextMark,
  ParagraphNode,
  HeadingNode,
  BulletListNode,
  OrderedListNode,
  ListItemNode,
  BlockquoteNode,
  ImageNode,
  HorizontalRuleNode,
} from './content/schema'
```

- [ ] **Step 6: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): define rich content JSON schema"
git push
```

---

### Task 17: Build RichContent renderer

**Files:**
- Create: `packages/design-system/src/content/RichContent.tsx`, `RichContent.module.css`, `RichContent.test.tsx`
- Modify: `packages/design-system/src/index.ts`

- [ ] **Step 1: Test**

Write `packages/design-system/src/content/RichContent.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichContent } from './RichContent'
import type { RichContent as RC } from './schema'

describe('RichContent', () => {
  it('renders paragraphs', () => {
    const doc: RC = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] },
      ],
    }
    render(<RichContent doc={doc} />)
    expect(screen.getByText('Hello world').tagName).toBe('P')
  })

  it('renders headings at the right level', () => {
    const doc: RC = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      ],
    }
    render(<RichContent doc={doc} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Title' })).toBeInTheDocument()
  })

  it('applies bold marks', () => {
    const doc: RC = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'bold', marks: [{ type: 'bold' }] }] },
      ],
    }
    render(<RichContent doc={doc} />)
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })

  it('renders a link', () => {
    const doc: RC = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'here', marks: [{ type: 'link', attrs: { href: '/x' } }] },
          ],
        },
      ],
    }
    render(<RichContent doc={doc} />)
    expect(screen.getByRole('link', { name: 'here' })).toHaveAttribute('href', '/x')
  })

  it('renders an image with alt text', () => {
    const doc: RC = {
      type: 'doc',
      content: [{ type: 'image', attrs: { src: '/a.jpg', alt: 'alt-text' } }],
    }
    render(<RichContent doc={doc} />)
    expect(screen.getByAltText('alt-text')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm --filter @platform/design-system test RichContent
```

- [ ] **Step 3: Implement renderer**

Write `packages/design-system/src/content/RichContent.tsx`:

```tsx
import { Fragment, type ReactNode } from 'react'
import styles from './RichContent.module.css'
import type {
  BlockNode,
  InlineNode,
  RichContent as RichContentDoc,
  TextMark,
  TextNode,
} from './schema'

export interface RichContentProps {
  doc: RichContentDoc
}

export function RichContent({ doc }: RichContentProps) {
  return (
    <div className={styles.content}>
      {doc.content.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  )
}

function renderBlock(node: BlockNode): ReactNode {
  switch (node.type) {
    case 'paragraph':
      return <p>{(node.content ?? []).map(renderInline)}</p>
    case 'heading': {
      const Tag = `h${node.attrs.level}` as const
      return <Tag>{(node.content ?? []).map(renderInline)}</Tag>
    }
    case 'bulletList':
      return <ul>{(node.content ?? []).map((li, i) => <Fragment key={i}>{renderBlock(li as never)}</Fragment>)}</ul>
    case 'orderedList':
      return <ol>{(node.content ?? []).map((li, i) => <Fragment key={i}>{renderBlock(li as never)}</Fragment>)}</ol>
    case 'listItem':
      return <li>{(node.content ?? []).map((child, i) => <Fragment key={i}>{renderBlock(child)}</Fragment>)}</li>
    case 'blockquote':
      return <blockquote>{(node.content ?? []).map((child, i) => <Fragment key={i}>{renderBlock(child)}</Fragment>)}</blockquote>
    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={node.attrs.src} alt={node.attrs.alt ?? ''} title={node.attrs.title} />
      )
    case 'horizontalRule':
      return <hr />
  }
}

function renderInline(node: InlineNode, i?: number): ReactNode {
  if (node.type === 'text') return <Fragment key={i}>{applyMarks(node)}</Fragment>
  return null
}

function applyMarks(node: TextNode): ReactNode {
  let content: ReactNode = node.text
  for (const mark of node.marks ?? []) {
    content = wrapMark(mark, content)
  }
  return content
}

function wrapMark(mark: TextMark, inner: ReactNode): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong>{inner}</strong>
    case 'italic':
      return <em>{inner}</em>
    case 'link':
      return <a href={mark.attrs.href}>{inner}</a>
  }
}
```

- [ ] **Step 4: Minimal styles**

Write `packages/design-system/src/content/RichContent.module.css`:

```css
.content {
  font-family: var(--font-family-sans);
  color: var(--color-text-primary);
  line-height: var(--line-height-relaxed);
}

.content > * + * {
  margin-top: var(--space-4);
}

.content h1, .content h2, .content h3, .content h4, .content h5, .content h6 {
  font-weight: var(--font-weight-bold);
  line-height: var(--line-height-tight);
}

.content h1 { font-size: var(--font-size-4xl); }
.content h2 { font-size: var(--font-size-3xl); }
.content h3 { font-size: var(--font-size-2xl); }
.content h4 { font-size: var(--font-size-xl); }

.content a {
  color: var(--color-text-link);
  text-decoration: underline;
}

.content blockquote {
  border-left: 3px solid var(--color-brand-primary);
  padding-left: var(--space-4);
  color: var(--color-text-secondary);
  font-style: italic;
}

.content img {
  max-width: 100%;
  height: auto;
  border-radius: var(--radius-md);
}

.content hr {
  border: 0;
  border-top: 1px solid var(--color-neutral-200);
  margin: var(--space-8) 0;
}

.content ul, .content ol {
  padding-left: var(--space-8);
}
```

- [ ] **Step 5: Export**

Append to `packages/design-system/src/index.ts`:

```ts
export { RichContent } from './content/RichContent'
export type { RichContentProps } from './content/RichContent'
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
pnpm --filter @platform/design-system test RichContent
```

- [ ] **Step 7: Commit**

```bash
git add packages/design-system
git commit -m "feat(design-system): add RichContent renderer"
git push
```

---

## Phase 3 — Auth package

### Task 18: Create `packages/auth` scaffold with interface

**Files:**
- Create: `packages/auth/package.json`, `tsconfig.json`, `src/types.ts`, `src/index.ts`

- [ ] **Step 1: Create directory**

```bash
mkdir -p packages/auth/src/providers
```

- [ ] **Step 2: Write package.json**

Write `packages/auth/package.json`:

```json
{
  "name": "@platform/auth",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./providers/stub": "./src/providers/stub.ts"
  },
  "scripts": {
    "build": "tsc",
    "lint": "eslint src",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "jose": "^5.9.0"
  },
  "peerDependencies": {
    "next": "^15.0.0"
  },
  "devDependencies": {
    "@platform/config-eslint": "workspace:*",
    "@platform/config-typescript": "workspace:*",
    "next": "^15.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 3: tsconfig**

Write `packages/auth/tsconfig.json`:

```json
{
  "extends": "@platform/config-typescript/package-config.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.*"]
}
```

- [ ] **Step 4: Write interface**

Write `packages/auth/src/types.ts`:

```ts
export type Session = {
  userId: string
  email: string
}

export interface AuthProvider {
  /** Returns current session, or null if not authenticated. */
  getSession(): Promise<Session | null>
  /** Clears the current session cookie. */
  signOut(): Promise<void>
}
```

- [ ] **Step 5: Placeholder index (real factory added after stub lands)**

Write `packages/auth/src/index.ts`:

```ts
export type { Session, AuthProvider } from './types'
// `auth` export added in Task 20 once StubAuthProvider exists
```

- [ ] **Step 6: Install**

```bash
pnpm install
```

- [ ] **Step 7: Commit**

```bash
git add packages/auth pnpm-lock.yaml
git commit -m "feat(auth): create package scaffold with AuthProvider interface"
git push
```

---

### Task 19: Test-drive StubAuthProvider

**Files:**
- Create: `packages/auth/src/providers/stub.ts`, `stub.test.ts`
- Create: `packages/auth/vitest.config.ts`

- [ ] **Step 1: Vitest config**

Write `packages/auth/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 2: Write test**

Write `packages/auth/src/providers/stub.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest'
import { createStubAuthProvider, signStubToken } from './stub'

const SECRET = 'test-secret-for-unit-tests-only-32b'

describe('StubAuthProvider', () => {
  let cookieStore: Map<string, string>

  beforeEach(() => {
    cookieStore = new Map()
  })

  const mockCookies = () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieStore.set(name, value),
    delete: (name: string) => void cookieStore.delete(name),
  })

  it('returns null when no cookie is present', async () => {
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    expect(await provider.getSession()).toBeNull()
  })

  it('returns a session when a valid token is in the cookie', async () => {
    const token = await signStubToken({ userId: 'u1', email: 'a@b.com' }, SECRET)
    cookieStore.set('admin_session', token)
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    const session = await provider.getSession()
    expect(session).toEqual({ userId: 'u1', email: 'a@b.com' })
  })

  it('returns null when the token is invalid', async () => {
    cookieStore.set('admin_session', 'garbage')
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    expect(await provider.getSession()).toBeNull()
  })

  it('signOut clears the cookie', async () => {
    cookieStore.set('admin_session', 'anything')
    const provider = createStubAuthProvider({ secret: SECRET, getCookies: mockCookies })
    await provider.signOut()
    expect(cookieStore.has('admin_session')).toBe(false)
  })
})
```

- [ ] **Step 3: Run — expect failure**

```bash
pnpm --filter @platform/auth test
```

- [ ] **Step 4: Implement the stub**

Write `packages/auth/src/providers/stub.ts`:

```ts
import { SignJWT, jwtVerify } from 'jose'
import type { AuthProvider, Session } from '../types'

const COOKIE_NAME = 'admin_session'

type CookieStore = {
  get(name: string): { value: string } | undefined
  set(name: string, value: string): void
  delete(name: string): void
}

type GetCookies = () => CookieStore

export interface StubAuthOptions {
  /** 32+ byte secret for HS256 signing. */
  secret: string
  /** Abstracted cookie access so this works both in Next.js runtime and tests. */
  getCookies: GetCookies
}

export async function signStubToken(session: Session, secret: string): Promise<string> {
  const key = new TextEncoder().encode(secret)
  return await new SignJWT({ email: session.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(session.userId)
    .setExpirationTime('7d')
    .sign(key)
}

export function createStubAuthProvider({ secret, getCookies }: StubAuthOptions): AuthProvider & {
  signIn(session: Session): Promise<void>
} {
  const key = new TextEncoder().encode(secret)

  return {
    async getSession() {
      const token = getCookies().get(COOKIE_NAME)?.value
      if (!token) return null
      try {
        const { payload } = await jwtVerify(token, key)
        if (!payload.sub || typeof payload.email !== 'string') return null
        return { userId: payload.sub, email: payload.email }
      } catch {
        return null
      }
    },

    async signIn(session) {
      const token = await signStubToken(session, secret)
      getCookies().set(COOKIE_NAME, token)
    },

    async signOut() {
      getCookies().delete(COOKIE_NAME)
    },
  }
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter @platform/auth test
# expect: 4 tests passed
```

- [ ] **Step 6: Commit**

```bash
git add packages/auth
git commit -m "feat(auth): add StubAuthProvider with tests"
git push
```

---

### Task 20: Wire factory export (Next.js cookie bridge)

**Files:**
- Modify: `packages/auth/src/index.ts`
- Create: `packages/auth/src/next-runtime.ts`

- [ ] **Step 1: Write Next.js runtime adapter**

Write `packages/auth/src/next-runtime.ts`:

```ts
import { cookies as nextCookies } from 'next/headers'

/** Bridges Next.js's async cookies() to the synchronous CookieStore interface used by the stub. */
export async function getNextCookieStore() {
  const jar = await nextCookies()
  return {
    get: (name: string) => {
      const c = jar.get(name)
      return c ? { value: c.value } : undefined
    },
    set: (name: string, value: string) =>
      jar.set(name, value, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      }),
    delete: (name: string) => jar.delete(name),
  }
}
```

- [ ] **Step 2: Write the factory**

Overwrite `packages/auth/src/index.ts`:

```ts
import { createStubAuthProvider } from './providers/stub'
import { getNextCookieStore } from './next-runtime'
import type { AuthProvider } from './types'

export type { Session, AuthProvider } from './types'
export { signStubToken } from './providers/stub'

const secret = process.env.AUTH_STUB_SECRET
if (!secret) {
  throw new Error('AUTH_STUB_SECRET env var is required')
}

let cachedStore: Awaited<ReturnType<typeof getNextCookieStore>> | null = null

/**
 * F1 export. F4 replaces the stub implementation with Clerk.
 * See spec §9 for the migration path.
 */
export const auth: AuthProvider & { signIn(session: { userId: string; email: string }): Promise<void> } =
  createStubAuthProvider({
    secret,
    getCookies: () => {
      // Next.js route handlers provide request-scoped cookies asynchronously. We resolve
      // lazily and memoize per-request via React cache semantics when used in RSC.
      if (!cachedStore) throw new Error('auth.getSession/signIn must be called after initAuthForRequest()')
      return cachedStore
    },
  })

export async function initAuthForRequest() {
  cachedStore = await getNextCookieStore()
}
```

Note: this lazy-init pattern is used because `cookies()` in Next.js 15 is async. Callers will invoke `initAuthForRequest()` at the entry point of middleware or a server action before using `auth`.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @platform/auth typecheck
# expect: clean
```

- [ ] **Step 4: Commit**

```bash
git add packages/auth
git commit -m "feat(auth): add factory export with Next.js cookie bridge"
git push
```

---

## Phase 4 — apps/gr8loci scaffold

### Task 21: Bootstrap `apps/gr8loci` with Next.js 15

**Files:**
- Create: `apps/gr8loci/package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `next-env.d.ts`

- [ ] **Step 1: Directory + package.json**

```bash
mkdir -p apps/gr8loci/app apps/gr8loci/lib apps/gr8loci/components apps/gr8loci/prisma apps/gr8loci/public
```

Write `apps/gr8loci/package.json`:

```json
{
  "name": "gr8loci",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbo --port 3000",
    "build": "prisma generate && next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "prisma:migrate": "prisma migrate dev",
    "prisma:generate": "prisma generate",
    "prisma:seed": "tsx prisma/seed.ts",
    "prisma:studio": "prisma studio",
    "clean": "rm -rf .next .turbo"
  },
  "dependencies": {
    "@platform/auth": "workspace:*",
    "@platform/design-system": "workspace:*",
    "@prisma/client": "^6.0.0",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@platform/config-eslint": "workspace:*",
    "@platform/config-typescript": "workspace:*",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.15.0",
    "eslint-config-next": "^15.0.0",
    "playwright": "^1.49.0",
    "prisma": "^6.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.5.0",
    "vitest": "^2.1.0"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 2: tsconfig**

Write `apps/gr8loci/tsconfig.json`:

```json
{
  "extends": "@platform/config-typescript/nextjs.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", ".next"]
}
```

- [ ] **Step 3: next.config**

Write `apps/gr8loci/next.config.ts`:

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: ['@platform/design-system', '@platform/auth'],
}

export default nextConfig
```

- [ ] **Step 4: next-env stub**

Write `apps/gr8loci/next-env.d.ts`:

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />
```

- [ ] **Step 5: globals.css (imports tokens)**

Write `apps/gr8loci/app/globals.css`:

```css
@import '@platform/design-system/tokens.css';

*, *::before, *::after {
  box-sizing: border-box;
}

html, body {
  margin: 0;
  padding: 0;
  font-family: var(--font-family-sans);
  color: var(--color-text-primary);
  background: var(--color-surface-page);
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}
```

- [ ] **Step 6: Root layout**

Write `apps/gr8loci/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GR8LOCI', template: '%s · GR8LOCI' },
  description: 'Health & wellness content and community.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

- [ ] **Step 7: Temporary home page (filled in Task 28)**

Write `apps/gr8loci/app/page.tsx`:

```tsx
export default function HomePage() {
  return <main>Home — placeholder.</main>
}
```

- [ ] **Step 8: Install**

```bash
pnpm install
```

- [ ] **Step 9: Verify dev server starts**

```bash
pnpm --filter gr8loci dev
# expect: Next.js starts on http://localhost:3000, page renders "Home — placeholder."
# Ctrl+C to stop.
```

- [ ] **Step 10: Commit**

```bash
git add apps/gr8loci pnpm-lock.yaml
git commit -m "feat(gr8loci): bootstrap Next.js 15 app with design-system integration"
git push
```

---

### Task 22: Set up Prisma schema + local dev DB

**Files:**
- Create: `apps/gr8loci/prisma/schema.prisma`
- Create: `apps/gr8loci/.env.local`, `apps/gr8loci/.env.example`
- Create: `apps/gr8loci/lib/db.ts`

- [ ] **Step 1: Create local Postgres database**

```bash
createdb gr8loci_dev
# if already exists: dropdb gr8loci_dev && createdb gr8loci_dev
```

- [ ] **Step 2: Write .env.example (committed template)**

Write `apps/gr8loci/.env.example`:

```
# Database
DATABASE_URL="postgresql://USER@localhost:5432/gr8loci_dev"
DIRECT_URL="postgresql://USER@localhost:5432/gr8loci_dev"

# Site identity
NEXT_PUBLIC_SITE_NAME="GR8LOCI"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

# F1 auth stub (delete when Clerk ships)
AUTH_STUB_SECRET="generate-with-openssl-rand-hex-32"
ADMIN_STUB_EMAIL="you@example.com"
ADMIN_STUB_PASSWORD="local-dev-only-not-for-production"
```

- [ ] **Step 3: Write real .env.local (gitignored)**

```bash
export STUB_SECRET=$(openssl rand -hex 32)
cat > apps/gr8loci/.env.local <<EOF
DATABASE_URL="postgresql://$(whoami)@localhost:5432/gr8loci_dev"
DIRECT_URL="postgresql://$(whoami)@localhost:5432/gr8loci_dev"

NEXT_PUBLIC_SITE_NAME="GR8LOCI"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"

AUTH_STUB_SECRET="$STUB_SECRET"
ADMIN_STUB_EMAIL="admin@gr8loci.online"
ADMIN_STUB_PASSWORD="dev-only-change-me-$(openssl rand -hex 8)"
EOF
cat apps/gr8loci/.env.local
```

- [ ] **Step 4: Write Prisma schema**

Write `apps/gr8loci/prisma/schema.prisma`:

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
  id             String     @id @default(cuid())
  slug           String     @unique
  title          String
  excerpt        String?
  content        Json
  contentVersion Int        @default(1)
  heroImageUrl   String?
  heroImageAlt   String?
  status         PostStatus @default(draft)
  publishedAt    DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@index([status, publishedAt])
  @@map("blog_posts")
}

model Page {
  id             String   @id @default(cuid())
  slug           String   @unique
  title          String
  content        Json
  contentVersion Int      @default(1)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@map("pages")
}

model AdminUser {
  id        String   @id @default(cuid())
  email     String   @unique
  createdAt DateTime @default(now())

  @@map("admin_users")
}
```

- [ ] **Step 5: Run first migration**

```bash
pnpm --filter gr8loci prisma migrate dev --name foundation_initial_schema
# expect: creates prisma/migrations/*/migration.sql, applies to gr8loci_dev, generates client
```

- [ ] **Step 6: Create Prisma client singleton**

Write `apps/gr8loci/lib/db.ts`:

```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 7: Commit**

```bash
git add apps/gr8loci/prisma apps/gr8loci/.env.example apps/gr8loci/lib/db.ts
git commit -m "feat(gr8loci): add Prisma schema and client singleton"
git push
```

---

### Task 23: Seed demo content

**Files:**
- Create: `apps/gr8loci/prisma/seed.ts`
- Create: `apps/gr8loci/public/hero-home.svg`, `hero-post-1.svg`, `hero-post-2.svg`, `hero-post-3.svg`

- [ ] **Step 1: Create placeholder hero images (SVG stubs)**

Write `apps/gr8loci/public/hero-home.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="800" viewBox="0 0 1600 800">
  <rect width="1600" height="800" fill="#163759"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="system-ui" font-size="48">HERO</text>
</svg>
```

Duplicate three variants with different colors:

```bash
sed 's/#163759/#2a4f73/' apps/gr8loci/public/hero-home.svg > apps/gr8loci/public/hero-post-1.svg
sed 's/#163759/#20b2aa/' apps/gr8loci/public/hero-home.svg > apps/gr8loci/public/hero-post-2.svg
sed 's/#163759/#475569/' apps/gr8loci/public/hero-home.svg > apps/gr8loci/public/hero-post-3.svg
```

- [ ] **Step 2: Write seed script**

Write `apps/gr8loci/prisma/seed.ts`:

```ts
import { PrismaClient, PostStatus } from '@prisma/client'

const prisma = new PrismaClient()

function paragraph(text: string) {
  return { type: 'paragraph', content: [{ type: 'text', text }] } as const
}

function heading(level: 1 | 2 | 3, text: string) {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] } as const
}

async function main() {
  const adminEmail = process.env.ADMIN_STUB_EMAIL
  if (!adminEmail) throw new Error('ADMIN_STUB_EMAIL required for seeding')

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    create: { email: adminEmail },
    update: {},
  })

  const posts = [
    {
      slug: 'welcome-to-gr8loci',
      title: 'Welcome to GR8LOCI',
      excerpt: 'What the platform is about, in one short paragraph.',
      heroImageUrl: '/hero-post-1.svg',
      heroImageAlt: 'Welcome banner',
    },
    {
      slug: 'five-habits',
      title: 'Five Habits That Change Your Day',
      excerpt: 'A short list of practical daily habits with real evidence behind them.',
      heroImageUrl: '/hero-post-2.svg',
      heroImageAlt: 'Five habits illustration',
    },
    {
      slug: 'the-basics-of-sleep',
      title: 'The Basics of Sleep',
      excerpt: 'Why sleep matters, what wrecks it, and what helps.',
      heroImageUrl: '/hero-post-3.svg',
      heroImageAlt: 'Sleep article banner',
    },
  ]

  for (const p of posts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        heroImageUrl: p.heroImageUrl,
        heroImageAlt: p.heroImageAlt,
        status: PostStatus.published,
        publishedAt: new Date(),
        content: {
          type: 'doc',
          content: [
            heading(1, p.title),
            paragraph(p.excerpt ?? ''),
            heading(2, 'Section one'),
            paragraph('Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis blandit.'),
            paragraph('Nulla facilisi. Sed euismod, risus a volutpat sagittis, lectus libero ultricies purus.'),
            heading(2, 'Section two'),
            paragraph('Integer vel augue a libero hendrerit placerat eu at augue.'),
          ],
        },
      },
    })
  }

  await prisma.page.upsert({
    where: { slug: 'about' },
    update: {},
    create: {
      slug: 'about',
      title: 'About GR8LOCI',
      content: {
        type: 'doc',
        content: [
          heading(1, 'About GR8LOCI'),
          paragraph('GR8LOCI is a health & wellness publication. This about page exercises the typography and layout of the design system.'),
          heading(2, 'Our focus'),
          paragraph('Evidence-based habits, honest reviews, no fluff.'),
        ],
      },
    },
  })

  console.log('Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 3: Run seed**

```bash
pnpm --filter gr8loci prisma:seed
# expect: "Seed complete."
```

- [ ] **Step 4: Verify with Prisma Studio (optional)**

```bash
pnpm --filter gr8loci prisma:studio &
# browser opens at http://localhost:5555; verify 3 posts + 1 page + 1 admin user exist
# Ctrl+C when done
```

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci/prisma/seed.ts apps/gr8loci/public
git commit -m "feat(gr8loci): add seed data and placeholder hero images"
git push
```

---

### Task 24: Write typed content fetchers

**Files:**
- Create: `apps/gr8loci/lib/content.ts`

- [ ] **Step 1: Write fetchers**

Write `apps/gr8loci/lib/content.ts`:

```ts
// Note: design-system exports the doc-shape type as `RichContentSchema`
// (the name `RichContent` is reserved for the renderer component due
// to TS verbatimModuleSyntax constraints on same-name type+value re-exports).
// Alias on import so downstream code reads naturally.
import type { RichContentSchema as RichContent } from '@platform/design-system'
import { prisma } from './db'

export type BlogPostSummary = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  heroImageUrl: string | null
  heroImageAlt: string | null
  publishedAt: Date | null
}

export type BlogPost = BlogPostSummary & {
  content: RichContent
}

export async function getPublishedBlogPosts(): Promise<BlogPostSummary[]> {
  const rows = await prisma.blogPost.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true, slug: true, title: true, excerpt: true,
      heroImageUrl: true, heroImageAlt: true, publishedAt: true,
    },
  })
  return rows
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const row = await prisma.blogPost.findFirst({
    where: { slug, status: 'published' },
  })
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    heroImageUrl: row.heroImageUrl,
    heroImageAlt: row.heroImageAlt,
    publishedAt: row.publishedAt,
    content: row.content as unknown as RichContent,
  }
}

export async function getPageBySlug(slug: string) {
  const row = await prisma.page.findUnique({ where: { slug } })
  if (!row) return null
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    content: row.content as unknown as RichContent,
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter gr8loci typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/lib/content.ts
git commit -m "feat(gr8loci): add typed content fetchers over Prisma"
git push
```

---

### Task 25: Build shared site components (Header, Footer, BlogGrid, HeroSection)

**Files:**
- Create: `apps/gr8loci/components/SiteHeader.tsx`, `SiteHeader.module.css`
- Create: `apps/gr8loci/components/SiteFooter.tsx`, `SiteFooter.module.css`
- Create: `apps/gr8loci/components/BlogGrid.tsx`, `BlogGrid.module.css`
- Create: `apps/gr8loci/components/HeroSection.tsx`, `HeroSection.module.css`

- [ ] **Step 1: SiteHeader**

Write `apps/gr8loci/components/SiteHeader.tsx`:

```tsx
import Link from 'next/link'
import { Container, Row } from '@platform/design-system'
import styles from './SiteHeader.module.css'

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <Container>
        <Row align="center" justify="between" gap={6}>
          <Link href="/" className={styles.brand}>
            GR8LOCI
          </Link>
          <nav>
            <Row gap={6} align="center">
              <Link href="/">Home</Link>
              <Link href="/blog">Blog</Link>
              <Link href="/about">About</Link>
            </Row>
          </nav>
        </Row>
      </Container>
    </header>
  )
}
```

Write `apps/gr8loci/components/SiteHeader.module.css`:

```css
.header {
  padding-block: var(--space-4);
  border-bottom: 1px solid var(--color-neutral-200);
}

.brand {
  font-family: var(--font-family-serif);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-brand-primary);
}
```

- [ ] **Step 2: SiteFooter**

Write `apps/gr8loci/components/SiteFooter.tsx`:

```tsx
import { Container, Text } from '@platform/design-system'
import styles from './SiteFooter.module.css'

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <Container>
        <Text size="sm">© {new Date().getFullYear()} GR8LOCI. All rights reserved.</Text>
      </Container>
    </footer>
  )
}
```

Write `apps/gr8loci/components/SiteFooter.module.css`:

```css
.footer {
  margin-top: var(--space-16);
  padding-block: var(--space-8);
  border-top: 1px solid var(--color-neutral-200);
  color: var(--color-text-muted);
}
```

- [ ] **Step 3: HeroSection**

Write `apps/gr8loci/components/HeroSection.tsx`:

```tsx
import { Container, Heading, Stack, Text } from '@platform/design-system'
import styles from './HeroSection.module.css'

export interface HeroSectionProps {
  title: string
  tagline: string
  imageUrl: string
  imageAlt: string
}

export function HeroSection({ title, tagline, imageUrl, imageAlt }: HeroSectionProps) {
  return (
    <section className={styles.hero}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.image} src={imageUrl} alt={imageAlt} />
      <Container>
        <Stack gap={4} className={styles.content}>
          <Heading level={1}>{title}</Heading>
          <Text size="lg">{tagline}</Text>
        </Stack>
      </Container>
    </section>
  )
}
```

Write `apps/gr8loci/components/HeroSection.module.css`:

```css
.hero {
  position: relative;
  isolation: isolate;
  padding-block: var(--space-24);
  color: var(--color-text-inverse);
  overflow: hidden;
}

.image {
  position: absolute;
  inset: 0;
  z-index: -2;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(rgba(15, 23, 42, 0.5), rgba(15, 23, 42, 0.7));
}

.content :is(h1, h2, h3, h4, h5, h6, p) {
  color: var(--color-text-inverse);
}
```

- [ ] **Step 4: BlogGrid**

Write `apps/gr8loci/components/BlogGrid.tsx`:

```tsx
import Link from 'next/link'
import { Card, Heading, Stack, Text } from '@platform/design-system'
import styles from './BlogGrid.module.css'
import type { BlogPostSummary } from '@/lib/content'

export interface BlogGridProps {
  posts: BlogPostSummary[]
}

export function BlogGrid({ posts }: BlogGridProps) {
  if (posts.length === 0) {
    return <Text>No posts yet.</Text>
  }
  return (
    <div className={styles.grid}>
      {posts.map((post) => (
        <Card key={post.id} as="article" variant="elevated" className={styles.card}>
          {post.heroImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.heroImageUrl} alt={post.heroImageAlt ?? ''} className={styles.cardImage} />
          )}
          <Stack gap={3} className={styles.cardBody}>
            <Heading level={3}>
              <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            </Heading>
            {post.excerpt && <Text>{post.excerpt}</Text>}
          </Stack>
        </Card>
      ))}
    </div>
  )
}
```

Write `apps/gr8loci/components/BlogGrid.module.css`:

```css
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--space-6);
}

.card {
  padding: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cardImage {
  width: 100%;
  aspect-ratio: 16 / 9;
  object-fit: cover;
}

.cardBody {
  padding: var(--space-6);
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci/components
git commit -m "feat(gr8loci): add SiteHeader, SiteFooter, HeroSection, BlogGrid components"
git push
```

---

### Task 26: Build home page (`/`)

**Files:**
- Modify: `apps/gr8loci/app/page.tsx`
- Modify: `apps/gr8loci/app/layout.tsx` (add header/footer)

- [ ] **Step 1: Add header/footer to root layout**

Overwrite `apps/gr8loci/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { SiteHeader } from '@/components/SiteHeader'
import { SiteFooter } from '@/components/SiteFooter'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'GR8LOCI', template: '%s · GR8LOCI' },
  description: 'Health & wellness content and community.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Home page**

Overwrite `apps/gr8loci/app/page.tsx`:

```tsx
import { Container, Heading, Stack } from '@platform/design-system'
import { HeroSection } from '@/components/HeroSection'
import { BlogGrid } from '@/components/BlogGrid'
import { getPublishedBlogPosts } from '@/lib/content'

export default async function HomePage() {
  const posts = (await getPublishedBlogPosts()).slice(0, 3)

  return (
    <main>
      <HeroSection
        title="Clear answers on health and wellness."
        tagline="Evidence-based habits, honest reviews, practical guides."
        imageUrl="/hero-home.svg"
        imageAlt="Abstract hero banner"
      />

      <Container>
        <Stack gap={12} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={2}>Latest posts</Heading>
          <BlogGrid posts={posts} />
        </Stack>
      </Container>
    </main>
  )
}
```

- [ ] **Step 3: Verify in browser**

```bash
pnpm --filter gr8loci dev
```

Visit `http://localhost:3000`. Expected: hero banner, "Latest posts" heading, 3 blog cards.

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/app
git commit -m "feat(gr8loci): build home page with hero + latest posts"
git push
```

---

### Task 27: Build blog index (`/blog`)

**Files:**
- Create: `apps/gr8loci/app/blog/page.tsx`

- [ ] **Step 1: Write page**

Write `apps/gr8loci/app/blog/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { Container, Heading, Stack, Text } from '@platform/design-system'
import { BlogGrid } from '@/components/BlogGrid'
import { getPublishedBlogPosts } from '@/lib/content'

export const metadata: Metadata = {
  title: 'Blog',
  description: 'All published articles on GR8LOCI.',
}

export default async function BlogIndexPage() {
  const posts = await getPublishedBlogPosts()
  return (
    <main>
      <Container>
        <Stack gap={8} style={{ paddingBlock: 'var(--space-16)' }}>
          <Stack gap={3}>
            <Heading level={1}>Blog</Heading>
            <Text size="lg">All articles, most recent first.</Text>
          </Stack>
          <BlogGrid posts={posts} />
        </Stack>
      </Container>
    </main>
  )
}
```

- [ ] **Step 2: Verify**

Visit `http://localhost:3000/blog`. Expected: heading "Blog", 3 cards.

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/app/blog
git commit -m "feat(gr8loci): build blog index page"
git push
```

---

### Task 28: Build single post page (`/blog/[slug]`)

**Files:**
- Create: `apps/gr8loci/app/blog/[slug]/page.tsx`

- [ ] **Step 1: Write page**

Write `apps/gr8loci/app/blog/[slug]/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container, Heading, RichContent, Stack, Text } from '@platform/design-system'
import { getBlogPostBySlug } from '@/lib/content'

interface Params {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
  }
}

export default async function BlogPostPage({ params }: Params) {
  const { slug } = await params
  const post = await getBlogPostBySlug(slug)
  if (!post) notFound()

  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={8} style={{ paddingBlock: 'var(--space-16)' }}>
          <Stack gap={3}>
            <Heading level={1}>{post.title}</Heading>
            {post.excerpt && <Text size="lg">{post.excerpt}</Text>}
            {post.publishedAt && (
              <Text size="sm" style={{ color: 'var(--color-text-muted)' }}>
                Published {post.publishedAt.toLocaleDateString()}
              </Text>
            )}
          </Stack>
          {post.heroImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.heroImageUrl} alt={post.heroImageAlt ?? ''} style={{ borderRadius: 'var(--radius-lg)' }} />
          )}
          <RichContent doc={post.content} />
        </Stack>
      </Container>
    </main>
  )
}
```

- [ ] **Step 2: Verify**

Visit `http://localhost:3000/blog/welcome-to-gr8loci`. Expected: post title, excerpt, hero image, rich content sections.

- [ ] **Step 3: Verify 404**

Visit `http://localhost:3000/blog/nonexistent`. Expected: Next.js 404 page.

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/app/blog
git commit -m "feat(gr8loci): build single blog post page with RichContent"
git push
```

---

### Task 29: Build about page (`/about`)

**Files:**
- Create: `apps/gr8loci/app/about/page.tsx`

- [ ] **Step 1: Write page**

Write `apps/gr8loci/app/about/page.tsx`:

```tsx
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Container, RichContent, Stack } from '@platform/design-system'
import { getPageBySlug } from '@/lib/content'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPageBySlug('about')
  if (!page) return {}
  return { title: page.title }
}

export default async function AboutPage() {
  const page = await getPageBySlug('about')
  if (!page) notFound()

  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <RichContent doc={page.content} />
        </Stack>
      </Container>
    </main>
  )
}
```

- [ ] **Step 2: Verify**

Visit `http://localhost:3000/about`. Expected: about page content from seeded data.

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/app/about
git commit -m "feat(gr8loci): build about page"
git push
```

---

## Phase 5 — Admin stub

### Task 30: Admin login page + server action

**Files:**
- Create: `apps/gr8loci/app/(admin)/admin/login/page.tsx`
- Create: `apps/gr8loci/lib/auth-actions.ts`

- [ ] **Step 1: Write server action**

Write `apps/gr8loci/lib/auth-actions.ts`:

```ts
'use server'

import { redirect } from 'next/navigation'
import { auth, initAuthForRequest } from '@platform/auth'
import { prisma } from './db'

export async function loginAction(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    return { error: 'Email and password are required.' }
  }

  if (password !== process.env.ADMIN_STUB_PASSWORD) {
    return { error: 'Invalid credentials.' }
  }

  const user = await prisma.adminUser.findUnique({ where: { email } })
  if (!user) {
    return { error: 'Invalid credentials.' }
  }

  await initAuthForRequest()
  await auth.signIn({ userId: user.id, email: user.email })

  redirect('/admin')
}

export async function logoutAction() {
  await initAuthForRequest()
  await auth.signOut()
  redirect('/admin/login')
}
```

- [ ] **Step 2: Write login page**

Write `apps/gr8loci/app/(admin)/admin/login/page.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { Button, Container, Heading, Input, Stack, Text } from '@platform/design-system'
import { loginAction } from '@/lib/auth-actions'

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      const result = await loginAction(formData)
      return result ?? {}
    },
    {},
  )

  return (
    <main>
      <Container maxWidth="sm">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={1}>Admin sign in</Heading>
          <Text>F1 stub — not for production use.</Text>

          <form action={formAction}>
            <Stack gap={4}>
              <Input id="email" name="email" type="email" label="Email" required autoComplete="email" />
              <Input id="password" name="password" type="password" label="Password" required autoComplete="current-password" />
              {state.error && <Text style={{ color: 'var(--color-semantic-danger)' }}>{state.error}</Text>}
              <Button type="submit" disabled={pending}>
                {pending ? 'Signing in…' : 'Sign in'}
              </Button>
            </Stack>
          </form>
        </Stack>
      </Container>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/gr8loci/app apps/gr8loci/lib/auth-actions.ts
git commit -m "feat(gr8loci): add admin login page with server action"
git push
```

---

### Task 31: Admin placeholder page + middleware route guard

**Files:**
- Create: `apps/gr8loci/app/(admin)/admin/page.tsx`
- Create: `apps/gr8loci/middleware.ts`

- [ ] **Step 1: Write middleware**

Write `apps/gr8loci/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(process.env.AUTH_STUB_SECRET)

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname
  if (!path.startsWith('/admin')) return
  if (path === '/admin/login') return

  const token = req.cookies.get('admin_session')?.value
  if (!token) return NextResponse.redirect(new URL('/admin/login', req.url))

  try {
    await jwtVerify(token, SECRET)
  } catch {
    return NextResponse.redirect(new URL('/admin/login', req.url))
  }
}

export const config = {
  matcher: ['/admin/:path*'],
}
```

Note: middleware runs in Edge runtime, so we verify the JWT inline using `jose` rather than going through `@platform/auth` which depends on `next/headers`. Both implementations use the same secret and shape — no divergence risk.

- [ ] **Step 2: Write admin home**

Write `apps/gr8loci/app/(admin)/admin/page.tsx`:

```tsx
import { Button, Container, Heading, Stack, Text } from '@platform/design-system'
import { auth, initAuthForRequest } from '@platform/auth'
import { logoutAction } from '@/lib/auth-actions'

export default async function AdminHomePage() {
  await initAuthForRequest()
  const session = await auth.getSession()

  return (
    <main>
      <Container maxWidth="md">
        <Stack gap={6} style={{ paddingBlock: 'var(--space-16)' }}>
          <Heading level={1}>Admin</Heading>
          <Text>
            Signed in as <strong>{session?.email ?? 'unknown'}</strong>.
          </Text>
          <Text>
            The admin dashboard ships in F4. This page exists to prove the route guard and session flow.
          </Text>
          <form action={logoutAction}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </Stack>
      </Container>
    </main>
  )
}
```

- [ ] **Step 3: Verify flow manually**

```bash
pnpm --filter gr8loci dev
```

1. Visit `http://localhost:3000/admin` → expect redirect to `/admin/login`
2. Submit wrong password → expect "Invalid credentials."
3. Submit correct email + password (from `.env.local`) → expect redirect to `/admin`
4. Confirm "Signed in as <email>." is displayed
5. Click "Sign out" → expect redirect to `/admin/login`

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/app apps/gr8loci/middleware.ts
git commit -m "feat(gr8loci): add admin placeholder + middleware route guard"
git push
```

---

## Phase 6 — Testing setup

### Task 32: Set up Vitest for app-level tests

**Files:**
- Create: `apps/gr8loci/vitest.config.ts`, `apps/gr8loci/vitest.setup.ts`

- [ ] **Step 1: Config**

Write `apps/gr8loci/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
})
```

Write `apps/gr8loci/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2: Add happy-dom dev dep**

Edit `apps/gr8loci/package.json` devDependencies, add:

```json
"happy-dom": "^15.11.0",
"@testing-library/jest-dom": "^6.6.0",
"@testing-library/react": "^16.1.0"
```

Then:

```bash
pnpm install
```

- [ ] **Step 3: Smoke test**

Write `apps/gr8loci/components/BlogGrid.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BlogGrid } from './BlogGrid'

describe('BlogGrid', () => {
  it('shows an empty-state message when no posts', () => {
    render(<BlogGrid posts={[]} />)
    expect(screen.getByText('No posts yet.')).toBeInTheDocument()
  })

  it('renders a card per post', () => {
    render(
      <BlogGrid
        posts={[
          {
            id: '1', slug: 'a', title: 'Alpha',
            excerpt: null, heroImageUrl: null, heroImageAlt: null, publishedAt: new Date(),
          },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run**

```bash
pnpm --filter gr8loci test
# expect: 2 tests passed
```

- [ ] **Step 5: Commit**

```bash
git add apps/gr8loci pnpm-lock.yaml
git commit -m "test(gr8loci): set up vitest + BlogGrid smoke test"
git push
```

---

### Task 33: Set up Playwright E2E smoke test

**Files:**
- Create: `apps/gr8loci/playwright.config.ts`
- Create: `apps/gr8loci/tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Install browsers (one-time)**

```bash
pnpm --filter gr8loci exec playwright install --with-deps chromium
```

- [ ] **Step 2: Playwright config**

Write `apps/gr8loci/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
```

- [ ] **Step 3: Update package dev-deps**

Edit `apps/gr8loci/package.json` devDependencies, ensure:

```json
"@playwright/test": "^1.49.0"
```

Remove the bare `"playwright"` entry (we use `@playwright/test`):

```bash
pnpm install
```

- [ ] **Step 4: Smoke spec**

Write `apps/gr8loci/tests/e2e/smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test.describe('public pages render', () => {
  test('home loads with hero and latest posts', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /clear answers/i })).toBeVisible()
    await expect(page.getByText('Latest posts')).toBeVisible()
  })

  test('blog index loads', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('heading', { name: 'Blog', level: 1 })).toBeVisible()
  })

  test('single blog post loads', async ({ page }) => {
    await page.goto('/blog/welcome-to-gr8loci')
    await expect(page.getByRole('heading', { name: 'Welcome to GR8LOCI', level: 1 })).toBeVisible()
  })

  test('about page loads', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: /about gr8loci/i })).toBeVisible()
  })
})

test.describe('admin route guard', () => {
  test('unauthenticated /admin redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: /admin sign in/i })).toBeVisible()
  })
})
```

- [ ] **Step 5: Run**

```bash
pnpm --filter gr8loci test:e2e
# expect: 5 tests passed
```

- [ ] **Step 6: Commit**

```bash
git add apps/gr8loci pnpm-lock.yaml
git commit -m "test(gr8loci): add Playwright e2e smoke tests"
git push
```

---

## Phase 7 — Deployment

### Task 34: Provision DigitalOcean Postgres databases

**Files:** none (ops task)

- [ ] **Step 1: Create production database**

In the DigitalOcean control panel, navigate to your existing managed Postgres cluster. Click "Users & Databases" → "Databases" → "Create database":

- Database name: `gr8loci_prod`

- [ ] **Step 2: Create preview database**

Same cluster → "Create database":

- Database name: `gr8loci_preview`

- [ ] **Step 3: Record connection strings**

For each database, click to get the connection string. Note both:
- Pooled (port 25061) → used as `DATABASE_URL`
- Direct (port 25060) → used as `DIRECT_URL`

Save these four URLs temporarily in a secure note — they're configured in Vercel in Task 36.

- [ ] **Step 4: Verify connectivity from local machine**

```bash
# Replace with actual URL from DO
psql 'postgresql://doadmin:xxx@host:25060/gr8loci_prod?sslmode=require' -c 'SELECT 1;'
# expect: "?column?" column with "1"
```

---

### Task 35: Create Vercel project and link to GitHub repo

**Files:** none (ops task)

- [ ] **Step 1: Create Vercel project**

In browser, go to https://vercel.com/new. Click "Import Git Repository." Select `welly-bda/gr8loci-platform`.

- [ ] **Step 2: Configure build settings**

- Framework preset: Next.js
- Root directory: `apps/gr8loci`
- Install command: `pnpm install --frozen-lockfile` (or leave default if Vercel detects)
- Build command: `cd ../.. && pnpm --filter gr8loci build`
- Output directory: leave default (`.next`)

Click "Deploy." **Do not configure env vars yet** — the first build will fail for lack of DB connection. That's expected.

---

### Task 36: Configure Vercel environment variables

**Files:** none (ops task)

- [ ] **Step 1: Add production env vars**

In the Vercel project settings → Environment Variables, add the following for the **Production** environment only:

```
DATABASE_URL=<gr8loci_prod pooled URL from Task 34>
DIRECT_URL=<gr8loci_prod direct URL from Task 34>
NEXT_PUBLIC_SITE_NAME=GR8LOCI
NEXT_PUBLIC_SITE_URL=<the *.vercel.app URL Vercel assigned>
AUTH_STUB_SECRET=<generate fresh: openssl rand -hex 32>
ADMIN_STUB_EMAIL=<your admin email>
ADMIN_STUB_PASSWORD=<strong unique password, or leave unset to disable login entirely>
```

- [ ] **Step 2: Add preview env vars**

Add the same set for the **Preview** environment, except:
- `DATABASE_URL` and `DIRECT_URL` point to `gr8loci_preview`
- Everything else can be the same or a separate set

- [ ] **Step 3: Trigger a redeploy**

In Vercel deployments view, find the latest deployment and click the "…" menu → "Redeploy". Expect it to succeed this time.

---

### Task 37: Run initial Prisma migration on production DB

**Files:** none (ops task)

- [ ] **Step 1: From local machine, temporarily override DATABASE_URL**

```bash
cd apps/gr8loci
DATABASE_URL='<gr8loci_prod direct URL>' \
DIRECT_URL='<gr8loci_prod direct URL>' \
pnpm prisma migrate deploy
# expect: "N migrations found in prisma/migrations", all applied
```

- [ ] **Step 2: Seed production DB**

```bash
cd apps/gr8loci
DATABASE_URL='<gr8loci_prod direct URL>' \
DIRECT_URL='<gr8loci_prod direct URL>' \
ADMIN_STUB_EMAIL='<admin email>' \
pnpm prisma:seed
# expect: "Seed complete."
```

- [ ] **Step 3: Wire automatic migrations into Vercel**

Edit `apps/gr8loci/package.json`, update the `build` script:

```json
"build": "prisma migrate deploy && prisma generate && next build"
```

- [ ] **Step 4: Commit**

```bash
git add apps/gr8loci/package.json
git commit -m "chore(gr8loci): run prisma migrate deploy on each build"
git push
```

---

### Task 38: Verify production deploy end-to-end

**Files:** none (verification task)

- [ ] **Step 1: Visit the production URL**

Open `https://<your-project>.vercel.app` in browser.

- [ ] **Step 2: Verify each DoD item**

Manually check:
1. Home page renders with hero + 3 blog cards ✅
2. `/blog` shows 3 cards ✅
3. `/blog/welcome-to-gr8loci` renders full post ✅
4. `/about` renders about content ✅
5. `/admin` redirects to `/admin/login` ✅
6. Logging in with `ADMIN_STUB_EMAIL` + `ADMIN_STUB_PASSWORD` redirects to `/admin` ✅
7. Logout returns to `/admin/login` ✅

- [ ] **Step 3: Verify CI is green**

Go to https://github.com/welly-bda/gr8loci-platform/actions and confirm the latest workflow run on `main` is green.

---

## Phase 8 — Documentation

### Task 39: Write comprehensive README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace README**

Overwrite `README.md`:

```markdown
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
apps/           One Next.js app per brand. F1: apps/gr8loci only.
packages/
  design-system/   Tokens + UI primitives (Button, Card, Typography, Layout, Input, Icon, RichContent renderer)
  auth/            AuthProvider interface + F1 stub implementation. F4+ swap target: Clerk.
  config-*         Shared TypeScript / ESLint / Prettier configs.
```

## Local setup (M4 Mac / Apple Silicon)

Prerequisites: Node 20 (via nvm), pnpm 9, PostgreSQL 16 (via Homebrew).

```bash
git clone git@github.com:welly-bda/gr8loci-platform.git
cd gr8loci-platform
pnpm install

# Create local dev database
createdb gr8loci_dev

# Configure env
cp apps/gr8loci/.env.example apps/gr8loci/.env.local
# Edit apps/gr8loci/.env.local — set DATABASE_URL, DIRECT_URL, AUTH_STUB_SECRET, ADMIN_STUB_EMAIL, ADMIN_STUB_PASSWORD

# Migrate + seed
pnpm --filter gr8loci prisma migrate dev
pnpm --filter gr8loci prisma:seed

# Dev
pnpm --filter gr8loci dev
# visit http://localhost:3000
```

## Scripts

```bash
pnpm dev                        # run all app dev servers (F1: just gr8loci)
pnpm build                      # build all apps + packages (turbo cached)
pnpm lint                       # lint all packages
pnpm typecheck                  # typecheck all packages
pnpm test                       # run unit tests
pnpm --filter gr8loci test:e2e  # run Playwright e2e
```

## Deploy

Automatic via Vercel on push to `main`. PRs get preview deployments.

## Documentation

- Spec: `docs/superpowers/specs/2026-04-22-f1-monorepo-foundation-design.md`
- Plan: `docs/superpowers/plans/2026-04-22-f1-monorepo-foundation.md`

## Security note

The current auth implementation is a **stub** (plaintext password compared to env var, single hardcoded admin, no rate limiting). It is **not for production use outside dev/preview previews**. The F4 or dedicated auth spec replaces it with Clerk.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: comprehensive README for F1"
git push
```

---

### Task 40: Final verification and definition-of-done checklist

**Files:** none (verification task)

- [ ] **Step 1: Run through the 12-item DoD from the spec**

Verify each:

1. ✅ Repo exists on GitHub, clonable, `pnpm install` works
2. ✅ `pnpm --filter gr8loci dev` starts on localhost with design system loaded
3. ✅ Four pages render: `/`, `/blog`, `/blog/[slug]`, `/about`
4. ✅ All pages pull from Prisma (no hardcoded arrays)
5. ✅ `<RichContent>` renders post and page content
6. ✅ `/admin` route guard + login + placeholder works
7. ✅ Auth consumed only via `@platform/auth` abstraction
8. ✅ Primitives have `:focus-visible`, keyboard nav, WCAG AA contrast
9. ✅ GitHub Actions CI green on main
10. ✅ Vercel production deployed
11. ✅ DO Postgres `gr8loci_prod` migrated + seeded
12. ✅ README documents setup, dev, deploy

- [ ] **Step 2: Tag the release**

```bash
git tag -a f1-complete -m "Foundation-1: monorepo skeleton + first app rendering"
git push --tags
```

- [ ] **Step 3: Celebrate (briefly, then brainstorm F2)**

F1 ships. Move on to design-brainstorming F2 (theme engine — runtime-editable tokens) in a fresh session.

---

## Self-Review

### Spec coverage
- [x] §4 locked decisions → Tasks 1–7 (tooling), 8–17 (design system), 18–20 (auth), 21–24 (app + Prisma), 34–38 (deploy)
- [x] §5 repo structure → Task 1 (repo), 2 (workspace), 3–5 (config packages), 7 (design-system), 18 (auth), 21 (app scaffold)
- [x] §6.1 tokens → Task 8
- [x] §6.2 token generation → Task 9
- [x] §6.3 six primitives → Tasks 10 (Button), 11 (Card), 12 (Typography), 13 (Layout), 14 (Input), 15 (Icon)
- [x] §6.4 CSS Modules approach → Tasks 10–15 styles
- [x] §6.5 RichContent renderer → Tasks 16 (schema), 17 (renderer)
- [x] §6.6 accessibility baseline → enforced per primitive (focus-visible, contrast in variants)
- [x] §7 data model → Task 22 schema, 23 seed
- [x] §8 demo pages → Tasks 26–29
- [x] §8.2 data fetching via typed Prisma wrappers → Task 24
- [x] §9 auth stub + abstraction → Tasks 18–20, 30–31
- [x] §10.4 CI/CD → Task 6
- [x] §10.5 testing → Tasks 32 (Vitest), 33 (Playwright)
- [x] §11 non-goals → respected (no Clerk, no theme engine, no editor UI, no categories, etc.)
- [x] §12 DoD 12 items → Task 40 checklist

### Placeholder scan
- No TBDs, TODOs, "implement later" phrases
- Every step has concrete code or explicit commands with expected output
- No "similar to Task N" cross-references
- Types and function signatures consistent: `Session = { userId, email }` in both `packages/auth/src/types.ts` and all consumers; `AuthProvider.getSession()` / `signOut()` signatures match across stub + Next runtime; `createStubAuthProvider` return type extends `AuthProvider` consistently

### Known human-blocking ops steps
Tasks 1, 6, 34, 35, 36, 37, 38 require browser/dashboard interaction (GitHub repo create, CI first-run observation, DigitalOcean DB create, Vercel project setup, env-var configuration, production verification). These are labeled "ops task" and have step-by-step instructions.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-f1-monorepo-foundation.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with human checkpoints.

Which approach?
