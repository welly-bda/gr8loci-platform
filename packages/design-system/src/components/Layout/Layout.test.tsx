import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stack, Row, Container } from './Layout'

describe('Stack', () => {
  it('renders children', () => {
    render(<Stack><span>a</span><span>b</span></Stack>)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })
})

describe('Row', () => {
  it('renders children', () => {
    render(<Row><span>a</span><span>b</span></Row>)
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })
})

describe('Container', () => {
  it('wraps children', () => {
    render(<Container><span>inside</span></Container>)
    expect(screen.getByText('inside')).toBeInTheDocument()
  })

  it('applies maxWidth class variant', () => {
    const { container } = render(<Container maxWidth="sm"><span>x</span></Container>)
    expect((container.firstChild as HTMLElement).className).toContain('maxw-sm')
  })
})
