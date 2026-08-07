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
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getVaultBalance() external view returns (uint256)",
  "function userDeposits(address) external view returns (uint256)",
  "function totalDeposits() external view returns (uint256)",
  "function totalYield() external view returns (uint256)",
  "function getDepositorCount() external view returns (uint256)",
  "function allocateToAgent(address agent, uint256 amount) external",
  "function grantAgentRole(address agent) external",
  "function COORDINATOR_ROLE() external view returns (bytes32)",
  "function AGENT_ROLE() external view returns (bytes32)",
  "event Deposited(address indexed user, uint256 amount)",
  "event Withdrawn(address indexed user, uint256 amount)",
  "event YieldHarvested(uint256 amount, uint256 totalYield)",
  "event Rebalanced(uint256 yieldAmount, uint256 liquidityAmount)",
  "event AllocatedToAgent(address indexed agent, uint256 amount)",
] as const;

export const AGENT_REGISTRY_ABI = [
  "function getAgentCount() external view returns (uint256)",
  "function getAllAgents() external view returns (address[])",
  "function isAgent(address) external view returns (bool)",
  "function getAgentInfo(address) external view returns (tuple(bytes32 agentId, uint8 agentType, string name, uint256 registeredAt, uint256 lastActiveAt, uint256 reputationScore, bool active, address wallet))",
  "function registerAgent(address wallet, bytes32 agentId, uint8 agentType, string calldata name) external",
  "function updateReputation(address agent, int256 delta, string calldata reason) external",
  "function grantRole(bytes32 role, address account) external",
  "function REGISTRAR_ROLE() external view returns (bytes32)",
  "event AgentRegistered(address indexed wallet, bytes32 agentId, uint8 agentType, string name)",
  "event ReputationUpdated(address indexed agent, int256 delta, uint256 newScore, string reason)",
  "event AgentDeactivated(address indexed agent)",
] as const;

export const BUDGET_MANAGER_ABI = [
  "function getBudget(address agent) external view returns (uint256)",
  "function getSpent(address agent) external view returns (uint256)",
  "function getRemaining(address agent) external view returns (uint256)",
  "function getActiveAgents() external view returns (address[])",
  "function getAgentCount() external view returns (uint256)",
  "function createBudget(address agent, uint256 amount) external",
  "function allocate(address agent, uint256 amount) external",
  "function spend(address agent, uint256 amount) external returns (bool)",
  "function grantRole(bytes32 role, address account) external",
  "function COORDINATOR_ROLE() external view returns (bytes32)",
  "event AgentBudgetCreated(address indexed agent, uint256 amount)",
  "event BudgetAllocated(address indexed agent, uint256 amount, uint256 total)",
  "event BudgetSpent(address indexed agent, uint256 amount, uint256 remaining)",
  "event AgentDeactivated(address indexed agent)",
] as const;

export const RISK_ORACLE_ABI = [
  "function checkHealth() external view returns (bool healthy, uint256 riskScore)",
  "function isPaused() external view returns (bool)",
  "function getRiskScore() external view returns (uint256)",
  "function getMetrics() external view returns (tuple(uint256 totalExposure, uint256 currentDrawdown, uint256 maxDrawdownReached, uint256 lastRiskCheck, uint256 riskScore, bool circuitBreakerActive))",
  "function updateMetrics(uint256 _totalExposure, uint256 _currentDrawdown) external",
  "function addRiskAgent(address agent) external",
  "function grantRole(bytes32 role, address account) external",
  "function COORDINATOR_ROLE() external view returns (bytes32)",
  "function RISK_AGENT_ROLE() external view returns (bytes32)",
  "event RiskThresholdUpdated(uint256 maxDrawdown, uint256 maxConcentration, uint256 maxExposure)",
  "event CircuitBreakerTriggered(uint256 riskScore, uint256 timestamp)",
  "event CircuitBreakerReleased(uint256 timestamp)",
  "event RiskCheckCompleted(uint256 riskScore, bool healthy)",
] as const;

export const PAYMENT_ROUTER_ABI = [
  "function executePayment(address to, uint256 amount, string calldata memo) external returns (uint256)",
  "function executeNanopayment(address payee, uint256 amount, string calldata serviceId) external returns (uint256)",
  "function executeBatchPayments(address[] calldata recipients, uint256[] calldata amounts, string[] calldata memos) external returns (uint256)",
  "function grantAgentRole(address agent) external",
  "function grantRole(bytes32 role, address account) external",
  "function COORDINATOR_ROLE() external view returns (bytes32)",
  "function AGENT_ROLE() external view returns (bytes32)",
  "function getPaymentCount() external view returns (uint256)",
  "function getNanopaymentCount() external view returns (uint256)",
  "function getAgentPayments(address agent) external view returns (uint256)",
  "function getAgentTotalPaid(address agent) external view returns (uint256)",
  "event PaymentExecuted(uint256 indexed paymentId, address indexed from, address indexed to, uint256 amount)",
  "event NanopaymentExecuted(uint256 indexed nanopaymentId, address indexed payer, address indexed payee, uint256 amount, string serviceId)",
  "event BatchPaymentExecuted(uint256 count, uint256 totalAmount)",
] as const;

export const AGENT_TYPES = [
  { id: 0, name: "Yield Agent", type: "yield" },
  { id: 1, name: "Liquidity Agent", type: "liquidity" },
  { id: 2, name: "FX Agent", type: "fx" },
  { id: 3, name: "Payment Agent", type: "payment" },
  { id: 4, name: "Risk Agent", type: "risk" },
  { id: 5, name: "Coordinator", type: "coordinator" },
] as const;