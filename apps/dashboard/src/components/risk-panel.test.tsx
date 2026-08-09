import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { RiskPanel } from './risk-panel'
import { useRiskMetrics } from '@/lib/hooks'

vi.mock('@/lib/hooks')

const mockUseRiskMetrics = vi.mocked(useRiskMetrics)

describe('RiskPanel', () => {
  beforeEach(() => {
    mockUseRiskMetrics.mockReturnValue({
      data: { healthy: true, riskScore: '25', totalExposure: '100000', currentDrawdown: '2.5', paused: false },
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('renders risk score', () => {
    render(<RiskPanel />)
    expect(screen.getByText('25')).toBeTruthy()
  })

  it('renders healthy status', () => {
    render(<RiskPanel />)
    expect(screen.getByText('Healthy')).toBeTruthy()
  })

  it('renders total exposure', () => {
    render(<RiskPanel />)
    expect(screen.getByText(/100,000\.00 USDC/)).toBeTruthy()
  })

  it('renders circuit breaker status', () => {
    render(<RiskPanel />)
    expect(screen.getByText('Normal')).toBeTruthy()
  })

  it('shows elevated risk when score is high', () => {
    mockUseRiskMetrics.mockReturnValue({
      data: { healthy: false, riskScore: '85', totalExposure: '50000', currentDrawdown: '10', paused: false },
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    render(<RiskPanel />)
    expect(screen.getByText('85')).toBeTruthy()
    expect(screen.getByText('Elevated Risk')).toBeTruthy()
  })

  it('shows circuit breaker triggered', () => {
    mockUseRiskMetrics.mockReturnValue({
      data: { healthy: false, riskScore: '95', totalExposure: '0', currentDrawdown: '25', paused: true },
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
    render(<RiskPanel />)
    expect(screen.getByText('Circuit Breaker Active')).toBeTruthy()
    expect(screen.getByText('TRIGGERED')).toBeTruthy()
  })

  it('shows loading state', () => {
    mockUseRiskMetrics.mockReturnValue({ data: null, loading: true, error: null, refresh: vi.fn() })
    render(<RiskPanel />)
    expect(screen.getByText(/Loading risk data/)).toBeTruthy()
  })
})
