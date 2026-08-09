import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { AgentGrid } from './agent-grid'
import { useAgentInfos } from '@/lib/hooks'

vi.mock('@/lib/hooks')

const mockUseAgentInfos = vi.mocked(useAgentInfos)

describe('AgentGrid', () => {
  beforeEach(() => {
    mockUseAgentInfos.mockReturnValue({
      data: [
        { address: '0xabc1234567890def1234', active: true, name: 'Yield Agent', agentType: 0, reputationScore: 100n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0xabc', agentId: '0x01' },
        { address: '0xdef1234567890abc1234', active: true, name: 'Risk Agent', agentType: 4, reputationScore: 95n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0xdef', agentId: '0x02' },
        { address: '0x1234567890abcdef1234', active: false, name: 'FX Agent', agentType: 2, reputationScore: 80n, registeredAt: 1n, lastActiveAt: 2n, wallet: '0x123', agentId: '0x03' },
      ],
      loading: false,
      error: null,
      refresh: vi.fn(),
    })
  })

  it('renders agent names', () => {
    render(<AgentGrid />)
    expect(screen.getByText('Yield Agent')).toBeTruthy()
    expect(screen.getByText('Risk Agent')).toBeTruthy()
    expect(screen.getByText('FX Agent')).toBeTruthy()
  })

  it('shows active/inactive status', () => {
    render(<AgentGrid />)
    expect(screen.getAllByText('Active').length).toBe(2)
    expect(screen.getAllByText('Inactive').length).toBe(1)
  })

  it('shows agent count', () => {
    render(<AgentGrid />)
    expect(screen.getByText(/2 active \/ 3 total/)).toBeTruthy()
  })

  it('shows empty state when no agents', () => {
    mockUseAgentInfos.mockReturnValue({ data: [], loading: false, error: null, refresh: vi.fn() })
    render(<AgentGrid />)
    expect(screen.getByText(/No agents registered/)).toBeTruthy()
  })

  it('shows loading state', () => {
    mockUseAgentInfos.mockReturnValue({ data: [], loading: true, error: null, refresh: vi.fn() })
    render(<AgentGrid />)
    expect(screen.getByText(/Loading agents/)).toBeTruthy()
  })
})
