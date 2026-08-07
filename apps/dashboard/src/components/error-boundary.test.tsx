import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SwarmErrorBoundary } from './error-boundary'

const ProblemChild = () => {
  throw new Error('Test boundary crash')
}

const SafeChild = () => <div>All Good Child</div>

describe('SwarmErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <SwarmErrorBoundary>
        <SafeChild />
      </SwarmErrorBoundary>
    )
    expect(screen.getByText('All Good Child')).toBeInTheDocument()
  })

  it('renders fallback UI when an error is thrown', () => {
    // Suppress console.error for expected thrown error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <SwarmErrorBoundary>
        <ProblemChild />
      </SwarmErrorBoundary>
    )

    expect(screen.getByText('System Encountered an Error')).toBeInTheDocument()
    expect(screen.getByText('Test boundary crash')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Reload Swarm Dashboard/i })).toBeInTheDocument()

    spy.mockRestore()
  })

  it('handles reload button click', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const originalReload = window.location.reload
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { reload: vi.fn() },
    })

    render(
      <SwarmErrorBoundary>
        <ProblemChild />
      </SwarmErrorBoundary>
    )

    const reloadBtn = screen.getByRole('button', { name: /Reload Swarm Dashboard/i })
    fireEvent.click(reloadBtn)

    expect(window.location.reload).toHaveBeenCalled()

    window.location.reload = originalReload
    spy.mockRestore()
  })
})
