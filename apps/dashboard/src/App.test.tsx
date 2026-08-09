import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import App from './App'
import { useVaultData, useAgentInfos, useRiskMetrics, usePaymentStats } from '@/lib/hooks'

vi.mock('@/lib/hooks')
vi.mock('@/components/wallet-connect', () => ({
  WalletConnect: () => <div data-testid="wallet-connect">Connect Wallet</div>,
}))

const mockUseVaultData = vi.mocked(useVaultData)
const mockUseAgentInfos = vi.mocked(useAgentInfos)
const mockUseRiskMetrics = vi.mocked(useRiskMetrics)
const mockUsePaymentStats = vi.mocked(usePaymentStats)

describe('App', () => {
  beforeEach(() => {
    mockUseVaultData.mockReturnValue({ data: { balance: '125000.50', totalDeposits: '200000', totalYield: '5000.50', depositorCount: 3 }, loading: false, error: null, refresh: vi.fn() })
    mockUseAgentInfos.mockReturnValue({ data: [{ address: '0xabc', active: true, name: 'Yield Agent', agentType: 0, reputationScore: 100n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0xabc', agentId: '0x01' }], loading: false, error: null, refresh: vi.fn() })
    mockUseRiskMetrics.mockReturnValue({ data: { healthy: true, riskScore: '25', totalExposure: '100000', currentDrawdown: '2.5', paused: false }, loading: false, error: null, refresh: vi.fn() })
    mockUsePaymentStats.mockReturnValue({ data: { paymentCount: 42, nanopaymentCount: 156 }, loading: false, error: null, refresh: vi.fn() })
  })

  it('renders ArcSwarm title', () => {
    render(<App />)
    expect(screen.getByText('ArcSwarm')).toBeTruthy()
  })

  it('renders navigation items', () => {
    render(<App />)
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('Treasury')).toBeTruthy()
    expect(screen.getAllByText('Agents').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Risk Monitor').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Yield Strategies')).toBeTruthy()
  })

  it('renders wallet connect button', () => {
    render(<App />)
    expect(screen.getByTestId('wallet-connect')).toBeTruthy()
  })

  it('shows vault address on dashboard', () => {
    render(<App />)
    expect(screen.getAllByText(/0x86014c/).length).toBeGreaterThanOrEqual(1)
  })
})
