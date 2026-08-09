import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StatsCards } from './stats-cards'
import { useVaultData, useAgentInfos, usePaymentStats } from '@/lib/hooks'

vi.mock('@/lib/hooks')

const mockUseVaultData = vi.mocked(useVaultData)
const mockUseAgentInfos = vi.mocked(useAgentInfos)
const mockUsePaymentStats = vi.mocked(usePaymentStats)

describe('StatsCards', () => {
  beforeEach(() => {
    mockUseVaultData.mockReturnValue({ data: { balance: '125000.50', totalDeposits: '200000', totalYield: '5000.50', depositorCount: 3 }, loading: false, error: null, refresh: vi.fn() })
    mockUseAgentInfos.mockReturnValue({ data: [{ address: '0xabc', active: true, name: 'Yield', agentType: 0, reputationScore: 100n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0x', agentId: '0x01' }, { address: '0xdef', active: true, name: 'Risk', agentType: 4, reputationScore: 95n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0x', agentId: '0x02' }, { address: '0x123', active: false, name: 'FX', agentType: 2, reputationScore: 80n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0x', agentId: '0x03' }], loading: false, error: null, refresh: vi.fn() })
    mockUsePaymentStats.mockReturnValue({ data: { paymentCount: 42, nanopaymentCount: 156 }, loading: false, error: null, refresh: vi.fn() })
  })

  it('renders vault balance from on-chain data', () => {
    render(<StatsCards />)
    expect(screen.getByText(/125,000\.50 USDC/)).toBeTruthy()
  })

  it('renders yield earned', () => {
    render(<StatsCards />)
    expect(screen.getAllByText(/5,000\.50 USDC/).length).toBeGreaterThanOrEqual(1)
  })

  it('renders active agent count', () => {
    render(<StatsCards />)
    expect(screen.getByText(/2 \/ 3/)).toBeTruthy()
  })

  it('renders payment count', () => {
    render(<StatsCards />)
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('shows loading state', () => {
    mockUseVaultData.mockReturnValue({ data: null, loading: true, error: null, refresh: vi.fn() })
    mockUseAgentInfos.mockReturnValue({ data: [], loading: true, error: null, refresh: vi.fn() })
    mockUsePaymentStats.mockReturnValue({ data: null, loading: true, error: null, refresh: vi.fn() })
    render(<StatsCards />)
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0)
  })
})
