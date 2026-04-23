import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { ArrowRight } from 'lucide-react'
import { Icon } from './Icon'

describe('Icon', () => {
  it('renders an SVG at the default (md) size', () => {
    const { container } = render(<Icon as={ArrowRight} aria-label="forward" />)
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    expect(svg?.getAttribute('width')).toBe('20')
  })

  it('respects size="sm"', () => {
    const { container } = render(<Icon as={ArrowRight} size="sm" aria-label="forward" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('16')
  })

  it('respects size="lg"', () => {
    const { container } = render(<Icon as={ArrowRight} size="lg" aria-label="forward" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('28')
  })

  it('respects size="xl"', () => {
    const { container } = render(<Icon as={ArrowRight} size="xl" aria-label="forward" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('36')
  })

  it('is aria-hidden when no aria-label is provided', () => {
    const { container } = render(<Icon as={ArrowRight} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
  })
})
