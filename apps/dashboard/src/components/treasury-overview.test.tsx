import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TreasuryOverview } from './treasury-overview'
import { useVaultData } from '@/lib/hooks'

vi.mock('@/lib/hooks')

const mockUseVaultData = vi.mocked(useVaultData)

describe('TreasuryOverview', () => {
  beforeEach(() => {
    mockUseVaultData.mockReturnValue({ data: { balance: '125000.50', totalDeposits: '200000', totalYield: '5000.50', depositorCount: 3 }, loading: false, error: null, refresh: vi.fn() })
  })

  it('renders vault balance', () => {
    render(<TreasuryOverview />)
    expect(screen.getByText(/125,000\.50 USDC/)).toBeTruthy()
  })

  it('renders total deposits', () => {
    render(<TreasuryOverview />)
    expect(screen.getByText(/200,000\.00 USDC/)).toBeTruthy()
  })

  it('renders total yield', () => {
    render(<TreasuryOverview />)
    expect(screen.getAllByText(/5,000\.50 USDC/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders depositor count', () => {
    render(<TreasuryOverview />)
    expect(screen.getByText('3')).toBeTruthy()
  })

  it('shows loading state', () => {
    mockUseVaultData.mockReturnValue({ data: null, loading: true, error: null, refresh: vi.fn() })
    render(<TreasuryOverview />)
    expect(screen.getAllByText('Loading').length).toBeGreaterThan(0)
  })
})
