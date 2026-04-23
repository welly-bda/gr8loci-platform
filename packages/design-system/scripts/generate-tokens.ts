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
