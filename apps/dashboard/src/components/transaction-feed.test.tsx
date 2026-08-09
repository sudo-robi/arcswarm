import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { TransactionFeed } from './transaction-feed'

describe('TransactionFeed', () => {
  it('renders empty state', () => {
    render(<TransactionFeed />)
    expect(screen.getByText('No transactions yet')).toBeTruthy()
  })

  it('renders heading', () => {
    render(<TransactionFeed />)
    expect(screen.getByText('Live Transactions')).toBeTruthy()
  })
})
