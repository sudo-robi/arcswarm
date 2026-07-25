export const ARC_TESTNET = {
  chainId: 5042002,
  rpcUrl: "https://rpc.testnet.arc.network",
  usdcAddress: "0x3600000000000000000000000000000000000000",
} as const;

export const CONTRACTS = {
  vault: "0x86014c6473574F93d4BFc386541681f8c1200160",
  budgetManager: "0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e",
  agentRegistry: "0x8007d0C9630f1AaB8A371702964AD2a5C07d7868",
  riskOracle: "0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd",
  paymentRouter: "0x11d0b045Df255940de0dF6CfD0130d9D25204214",
} as const;

export const VAULT_ABI = [
  "function totalDeposits() view returns (uint256)",
  "function totalYield() view returns (uint256)",
  "function getVaultBalance() view returns (uint256)",
  "function getDepositorCount() view returns (uint256)",
  "function getAllDepositors() view returns (address[])",
  "function userDeposits(address) view returns (uint256)",
  "function deposit(uint256) external",
  "function withdraw(uint256) external",
  "function allocateToAgent(address,uint256) external",
  "event Deposited(address indexed user, uint256 amount)",
  "event Withdrawn(address indexed user, uint256 amount)",
  "event YieldHarvested(uint256 amount, uint256 totalYield)",
  "event Rebalanced(uint256 yieldAmount, uint256 liquidityAmount)",
] as const;

export const AGENT_REGISTRY_ABI = [
  "function getAgentCount() view returns (uint256)",
  "function getAllAgents() view returns (address[])",
  "function isAgent(address) view returns (bool)",
  "function getAgentInfo(address) view returns (tuple(bytes32 agentId, uint8 agentType, string name, uint256 registeredAt, uint256 lastActiveAt, uint256 reputationScore, bool active, address wallet))",
] as const;

export const BUDGET_MANAGER_ABI = [
  "function getBudget(address) view returns (uint256)",
  "function getSpent(address) view returns (uint256)",
  "function getRemaining(address) view returns (uint256)",
  "function getActiveAgents() view returns (address[])",
  "function getAgentCount() view returns (uint256)",
] as const;

export const RISK_ORACLE_ABI = [
  "function checkHealth() view returns (bool healthy, uint256 riskScore)",
  "function isPaused() view returns (bool)",
  "function getRiskScore() view returns (uint256)",
  "function getMetrics() view returns (tuple(uint256 totalExposure, uint256 currentDrawdown, uint256 maxDrawdownReached, uint256 lastRiskCheck, uint256 riskScore, bool circuitBreakerActive))",
] as const;

export const PAYMENT_ROUTER_ABI = [
  "function getPaymentCount() view returns (uint256)",
  "function getNanopaymentCount() view returns (uint256)",
  "function getAgentPayments(address) view returns (uint256)",
  "function getAgentTotalPaid(address) view returns (uint256)",
] as const;

export const AGENT_TYPES = [
  { id: 0, name: "Yield Agent", type: "yield" },
  { id: 1, name: "Liquidity Agent", type: "liquidity" },
  { id: 2, name: "FX Agent", type: "fx" },
  { id: 3, name: "Payment Agent", type: "payment" },
  { id: 4, name: "Risk Agent", type: "risk" },
  { id: 5, name: "Coordinator", type: "coordinator" },
] as const;
