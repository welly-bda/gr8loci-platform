import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RichContent } from './RichContent'
import type { RichContent as RC } from './schema'

describe('RichContent', () => {
  it('renders paragraphs', () => {
    const doc: RC = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
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

  it('applies italic marks', () => {
    const doc: RC = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'italic', marks: [{ type: 'italic' }] }] },
      ],
    }
    render(<RichContent doc={doc} />)
    expect(screen.getByText('italic').tagName).toBe('EM')
  })

  it('renders a link from text mark', () => {
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

  it('renders a bullet list', () => {
    const doc: RC = {
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'item' }] }] },
          ],
        },
      ],
    }
    const { container } = render(<RichContent doc={doc} />)
    expect(container.querySelector('ul')).toBeTruthy()
    expect(container.querySelector('li')).toBeTruthy()
  })

  it('renders a horizontal rule', () => {
    const doc: RC = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    }
    const { container } = render(<RichContent doc={doc} />)
    expect(container.querySelector('hr')).toBeTruthy()
  })
})
