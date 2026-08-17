import { ethers } from 'ethers'

const ARC_RPC = 'https://rpc.testnet.arc.network'
const USDC_DECIMALS = 6

export const VAULT_ADDRESS = '0x68c104C39B8f8B0a0C7FA8Dec094b5eFD655AB3C'
export const AGENT_REGISTRY_ADDRESS = '0xD168D3185E1A972b32719169e42Bb949De61B6d9'
export const BUDGET_MANAGER_ADDRESS = '0x61dAF0E077555362ea135C1C56c808aA8b0e71F8'
export const RISK_ORACLE_ADDRESS = '0x255C053490060Df61D374A42D95Fd570D25418a7'
export const PAYMENT_ROUTER_ADDRESS = '0x5CEed60c98b7F98e79016295AAdaCC5166D2e0Ab'
export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000'

const VAULT_ABI = [
  'function getVaultBalance() external view returns (uint256)',
  'function totalDeposits() external view returns (uint256)',
  'function totalYield() external view returns (uint256)',
  'function getDepositorCount() external view returns (uint256)',
  'function userDeposits(address) external view returns (uint256)',
  'function deposit(uint256 amount) external',
  'function withdraw(uint256 amount) external',
  'function allocateToAgent(address agent, uint256 amount) external',
  'function grantAgentRole(address agent) external',
  'event Deposited(address indexed user, uint256 amount)',
  'event Withdrawn(address indexed user, uint256 amount)',
  'event YieldHarvested(uint256 amount, uint256 totalYield)',
  'event Rebalanced(uint256 yieldAmount, uint256 liquidityAmount)',
  'event AllocatedToAgent(address indexed agent, uint256 amount)',
]

const AGENT_REGISTRY_ABI = [
  'function getAgentCount() external view returns (uint256)',
  'function getAllAgents() external view returns (address[])',
  'function isAgent(address) external view returns (bool)',
  'function getAgentInfo(address) external view returns (tuple(bytes32 agentId, uint8 agentType, string name, uint256 registeredAt, uint256 lastActiveAt, uint256 reputationScore, bool active, address wallet))',
]

const BUDGET_MANAGER_ABI = [
  'function getBudget(address agent) external view returns (uint256)',
  'function getSpent(address agent) external view returns (uint256)',
  'function getRemaining(address agent) external view returns (uint256)',
  'function getActiveAgents() external view returns (address[])',
  'function getAgentCount() external view returns (uint256)',
]

const RISK_ORACLE_ABI = [
  'function checkHealth() external view returns (bool healthy, uint256 riskScore)',
  'function getRiskScore() external view returns (uint256)',
  'function isPaused() external view returns (bool)',
  'function getMetrics() external view returns (tuple(uint256 totalExposure, uint256 currentDrawdown, uint256 maxDrawdownReached, uint256 lastRiskCheck, uint256 riskScore, bool circuitBreakerActive))',
]

const PAYMENT_ROUTER_ABI = [
  'function getPaymentCount() external view returns (uint256)',
  'function getNanopaymentCount() external view returns (uint256)',
  'function getAgentPayments(address agent) external view returns (uint256)',
  'function getAgentTotalPaid(address agent) external view returns (uint256)',
]

const provider = new ethers.JsonRpcProvider(ARC_RPC, { chainId: 5042002, name: 'arc-testnet' })

export function getVaultContract() {
  return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider)
}

export function getAgentRegistryContract() {
  return new ethers.Contract(AGENT_REGISTRY_ADDRESS, AGENT_REGISTRY_ABI, provider)
}

export function getBudgetManagerContract() {
  return new ethers.Contract(BUDGET_MANAGER_ADDRESS, BUDGET_MANAGER_ABI, provider)
}

export function getRiskOracleContract() {
  return new ethers.Contract(RISK_ORACLE_ADDRESS, RISK_ORACLE_ABI, provider)
}

export function getPaymentRouterContract() {
  return new ethers.Contract(PAYMENT_ROUTER_ADDRESS, PAYMENT_ROUTER_ABI, provider)
}

export function getSignerContract(signer: ethers.Signer) {
  return new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, signer)
}

export const AGENT_TYPES = [
  { id: 0, name: 'Yield Agent', type: 'yield', color: 'from-emerald-500 to-teal-500', icon: '📈' },
  { id: 1, name: 'Liquidity Agent', type: 'liquidity', color: 'from-blue-500 to-cyan-500', icon: '💧' },
  { id: 2, name: 'FX Agent', type: 'fx', color: 'from-violet-500 to-purple-500', icon: '💱' },
  { id: 3, name: 'Payment Agent', type: 'payment', color: 'from-orange-500 to-amber-500', icon: '💸' },
  { id: 4, name: 'Risk Agent', type: 'risk', color: 'from-red-500 to-rose-500', icon: '🛡️' },
  { id: 5, name: 'Coordinator', type: 'coordinator', color: 'from-primary to-violet-500', icon: '🎯' },
] as const

export type VaultData = {
  balance: string
  totalDeposits: string
  totalYield: string
  depositorCount: number
}

export type AgentInfo = {
  address: string
  agentId: string
  agentType: number
  name: string
  registeredAt: bigint
  lastActiveAt: bigint
  reputationScore: bigint
  active: boolean
  wallet: string
}

export type RiskMetrics = {
  healthy: boolean
  riskScore: string
  totalExposure: string
  currentDrawdown: string
  paused: boolean
}

export type PaymentStats = {
  paymentCount: number
  nanopaymentCount: number
}

export async function fetchVaultData(): Promise<VaultData> {
  const vault = getVaultContract()
  const usdc = new ethers.Contract(USDC_ADDRESS, ['function balanceOf(address) view returns (uint256)'], provider)
  
  let balance = 0n
  try {
    balance = await usdc.balanceOf(VAULT_ADDRESS)
  } catch { /* ignore */ }

  let totalDeposits = 0n
  try {
    totalDeposits = await vault.totalDeposits()
  } catch { /* ignore */ }

  let totalYield = 0n
  try {
    totalYield = await vault.totalYield()
  } catch { /* ignore */ }

  let depositorCount = 0
  try {
    depositorCount = await vault.getDepositorCount()
  } catch { /* ignore */ }

  return {
    balance: ethers.formatUnits(balance, USDC_DECIMALS),
    totalDeposits: ethers.formatUnits(totalDeposits, USDC_DECIMALS),
    totalYield: ethers.formatUnits(totalYield, USDC_DECIMALS),
    depositorCount: Number(depositorCount),
  }
}

export async function fetchAgentInfos(): Promise<AgentInfo[]> {
  const registry = getAgentRegistryContract()
  
  // Known agent addresses from deployment
  const knownAddresses = [
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
    '0x3333333333333333333333333333333333333333',
    '0x4444444444444444444444444444444444444444',
    '0x5555555555555555555555555555555555555555',
    '0x6666666666666666666666666666666666666666',
  ]

  // Try getAllAgents first, fallback to known addresses
  let agentAddresses: string[] = []
  try {
    agentAddresses = await registry.getAllAgents()
  } catch {
    agentAddresses = knownAddresses
  }

  const agents = await Promise.all(
    agentAddresses.map(async (addr: string) => {
      try {
        const info = await registry.getAgentInfo(addr)
        if (!info.active || info.registeredAt === 0n) return null
        return {
          address: addr,
          agentId: info.agentId,
          agentType: Number(info.agentType),
          name: info.name,
          registeredAt: info.registeredAt,
          lastActiveAt: info.lastActiveAt,
          reputationScore: info.reputationScore,
          active: info.active,
          wallet: info.wallet,
        }
      } catch {
        return null
      }
    })
  )
  return agents.filter(Boolean) as AgentInfo[]
}

export async function fetchRiskMetrics(): Promise<RiskMetrics> {
  const oracle = getRiskOracleContract()

  // Try getMetrics first (most complete data, single call)
  try {
    const metrics = await oracle.getMetrics()
    let paused = false
    try { paused = await oracle.isPaused() } catch { /* ignore */ }
    return {
      healthy: !metrics.circuitBreakerActive,
      riskScore: metrics.riskScore.toString(),
      totalExposure: ethers.formatUnits(metrics.totalExposure, USDC_DECIMALS),
      currentDrawdown: ethers.formatUnits(metrics.currentDrawdown, USDC_DECIMALS),
      paused,
    }
  } catch { /* continue to fallback */ }

  // Fallback: try checkHealth
  try {
    const [healthy, riskScore] = await oracle.checkHealth()
    return { healthy, riskScore: riskScore.toString(), totalExposure: '0', currentDrawdown: '0', paused: false }
  } catch { /* continue to fallback */ }

  // Last fallback: getRiskScore only
  try {
    const score = await oracle.getRiskScore()
    return { healthy: true, riskScore: score.toString(), totalExposure: '0', currentDrawdown: '0', paused: false }
  } catch {
    return { healthy: true, riskScore: '0', totalExposure: '0', currentDrawdown: '0', paused: false }
  }
}

export async function fetchPaymentStats(): Promise<PaymentStats> {
  const router = getPaymentRouterContract()
  let paymentCount = 0
  let nanopaymentCount = 0
  try {
    paymentCount = Number(await router.getPaymentCount())
  } catch { /* ignore */ }
  try {
    nanopaymentCount = Number(await router.getNanopaymentCount())
  } catch { /* ignore */ }
  return { paymentCount, nanopaymentCount }
}
