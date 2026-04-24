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
    expect(output).toContain('--font-weight-regular: 400;')
  })
})
