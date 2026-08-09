import { ethers } from 'ethers'

const ARC_RPC = 'https://rpc.testnet.arc.network'

export const VAULT_ADDRESS = '0x86014c6473574F93d4BFc386541681f8c1200160'
export const AGENT_REGISTRY_ADDRESS = '0x8007d0C9630f1AaB8A371702964AD2a5C07d7868'
export const BUDGET_MANAGER_ADDRESS = '0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e'
export const RISK_ORACLE_ADDRESS = '0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd'
export const PAYMENT_ROUTER_ADDRESS = '0x11d0b045Df255940de0dF6CfD0130d9D25204214'
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

const provider = new ethers.JsonRpcProvider(ARC_RPC)

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
  const [balance, totalDeposits, totalYield, depositorCount] = await Promise.all([
    vault.getVaultBalance(),
    vault.totalDeposits(),
    vault.totalYield(),
    vault.getDepositorCount(),
  ])
  return {
    balance: ethers.formatUnits(balance, 6),
    totalDeposits: ethers.formatUnits(totalDeposits, 6),
    totalYield: ethers.formatUnits(totalYield, 6),
    depositorCount: Number(depositorCount),
  }
}

export async function fetchAgentInfos(): Promise<AgentInfo[]> {
  const registry = getAgentRegistryContract()
  const agentAddresses = await registry.getAllAgents()
  const budgetManager = getBudgetManagerContract()

  const agents = await Promise.all(
    agentAddresses.map(async (addr: string) => {
      const info = await registry.getAgentInfo(addr)
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
    })
  )
  return agents
}

export async function fetchRiskMetrics(): Promise<RiskMetrics> {
  const oracle = getRiskOracleContract()
  const [healthResult, paused, metrics] = await Promise.all([
    oracle.checkHealth(),
    oracle.isPaused(),
    oracle.getMetrics(),
  ])
  return {
    healthy: healthResult.healthy,
    riskScore: healthResult.riskScore.toString(),
    totalExposure: ethers.formatUnits(metrics.totalExposure, 6),
    currentDrawdown: ethers.formatUnits(metrics.currentDrawdown, 6),
    paused,
  }
}

export async function fetchPaymentStats(): Promise<PaymentStats> {
  const router = getPaymentRouterContract()
  const [paymentCount, nanopaymentCount] = await Promise.all([
    router.getPaymentCount(),
    router.getNanopaymentCount(),
  ])
  return {
    paymentCount: Number(paymentCount),
    nanopaymentCount: Number(nanopaymentCount),
  }
}
