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
            id: '1',
            slug: 'a',
            title: 'Alpha',
            excerpt: null,
            heroImageUrl: null,
            heroImageAlt: null,
            publishedAt: new Date(),
          },
        ]}
      />,
    )
    expect(screen.getByRole('link', { name: 'Alpha' })).toBeInTheDocument()
  })
})
