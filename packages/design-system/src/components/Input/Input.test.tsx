import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Input } from './Input'

describe('Input', () => {
  it('renders a labeled text input', () => {
    render(<Input label="Email" id="email" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders an error message when provided', () => {
    render(<Input label="Email" id="email" error="Invalid" />)
    expect(screen.getByText('Invalid')).toBeInTheDocument()
  })

  it('marks input as invalid when error present', () => {
    render(<Input label="Email" id="email" error="Invalid" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('links error via aria-describedby', () => {
    render(<Input label="Email" id="email" error="Invalid" />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', 'email-error')
  })
})
