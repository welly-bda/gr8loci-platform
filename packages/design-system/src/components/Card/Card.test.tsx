import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello</Card>)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('applies elevated variant class by default', () => {
    const { container } = render(<Card>x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('elevated')
  })

  it('applies outlined variant class when specified', () => {
    const { container } = render(<Card variant="outlined">x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('outlined')
  })

  it('applies flat variant class when specified', () => {
    const { container } = render(<Card variant="flat">x</Card>)
    expect((container.firstChild as HTMLElement).className).toContain('flat')
  })

  it('renders as article when as="article"', () => {
    const { container } = render(<Card as="article">x</Card>)
    expect((container.firstChild as HTMLElement).tagName).toBe('ARTICLE')
  })
})
