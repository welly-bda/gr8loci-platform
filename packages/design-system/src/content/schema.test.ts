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
    expect(isRichContent(undefined)).toBe(false)
    expect(isRichContent(123)).toBe(false)
  })

  it('rejects objects missing type', () => {
    expect(isRichContent({ content: [] })).toBe(false)
  })

  it('rejects objects with wrong type', () => {
    expect(isRichContent({ type: 'paragraph', content: [] })).toBe(false)
  })

  it('rejects objects where content is not an array', () => {
    expect(isRichContent({ type: 'doc', content: 'not-an-array' })).toBe(false)
  })
})
