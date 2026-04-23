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
  it('renders a paragraph by default', () => {
    render(<Text>Body</Text>)
    expect(screen.getByText('Body').tagName).toBe('P')
  })

  it('renders as span when specified', () => {
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
