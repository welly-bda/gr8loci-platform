import type { Tokens } from '../tokens'

export function serializeTokens(tokens: Tokens): string {
  const lines: string[] = [
    '/* AUTO-GENERATED from src/tokens/index.ts — do not edit by hand. */',
    '/* Regenerate with: pnpm --filter @platform/design-system generate:tokens */',
    '',
    ':root {',
  ]

  // color
  flatten('color', tokens.color, lines)

  // typography — subgroups get explicit prefixes that differ from their TS key names
  flatten('font-family', tokens.typography.fontFamily, lines)
  flatten('font-size', tokens.typography.fontSize, lines)
  flatten('font-weight', tokens.typography.fontWeight, lines)
  flatten('line-height', tokens.typography.lineHeight, lines)

  // spacing → space (KEY REMAPPING)
  flatten('space', tokens.spacing, lines)
  flatten('radius', tokens.radius, lines)
  flatten('shadow', tokens.shadow, lines)

  lines.push('}')
  lines.push('') // trailing newline after }

  return lines.join('\n')
}

function flatten(prefix: string, value: unknown, out: string[]): void {
  if (value === null || typeof value !== 'object') {
    out.push(`  --${prefix}: ${value as string | number};`)
    return
  }
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    flatten(`${prefix}-${k}`, v, out)
  }
}
