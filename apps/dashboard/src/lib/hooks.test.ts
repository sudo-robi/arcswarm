import { renderHook, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useVaultData, useAgentInfos, useRiskMetrics, usePaymentStats } from './hooks'
import * as contracts from './contracts'

vi.mock('./contracts')

describe('useVaultData', () => {
  it('fetches vault data', async () => {
    vi.mocked(contracts.fetchVaultData).mockResolvedValue({ balance: '100000', totalDeposits: '150000', totalYield: '3000', depositorCount: 5 })
    const { result } = renderHook(() => useVaultData(999999, 0))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.balance).toBe('100000')
  })
})

describe('useAgentInfos', () => {
  it('fetches agent data', async () => {
    vi.mocked(contracts.fetchAgentInfos).mockResolvedValue([{ address: '0xabc', active: true, name: 'Test', agentType: 0, reputationScore: 100n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0x', agentId: '0x01' }])
    const { result } = renderHook(() => useAgentInfos(999999, 0))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.length).toBe(1)
    expect(result.current.data?.[0].name).toBe('Test')
  })
})

describe('useRiskMetrics', () => {
  it('fetches risk data', async () => {
    vi.mocked(contracts.fetchRiskMetrics).mockResolvedValue({ healthy: true, riskScore: '30', totalExposure: '50000', currentDrawdown: '1.5', paused: false })
    const { result } = renderHook(() => useRiskMetrics(999999, 0))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.riskScore).toBe('30')
  })
})

describe('usePaymentStats', () => {
  it('fetches payment stats', async () => {
    vi.mocked(contracts.fetchPaymentStats).mockResolvedValue({ paymentCount: 10, nanopaymentCount: 25 })
    const { result } = renderHook(() => usePaymentStats(999999, 0))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data?.paymentCount).toBe(10)
  })
})
