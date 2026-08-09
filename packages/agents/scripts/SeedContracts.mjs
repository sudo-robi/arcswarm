import { ethers } from 'ethers';

const RPC_URL = 'https://rpc.testnet.arc.network';
const CHAIN_ID = 5042002;
const PRIVATE_KEY = '0x7bf603e53c0028c4a8bd0844e6ecb32ac9ee90fae5cb6c9f44398f656055aa25';

const VAULT = '0x68c104C39B8f8B0a0C7FA8Dec094b5eFD655AB3C';
const BUDGET_MANAGER = '0x61dAF0E077555362ea135C1C56c808aA8b0e71F8';
const AGENT_REGISTRY = '0xD168D3185E1A972b32719169e42Bb949De61B6d9';
const RISK_ORACLE = '0x255C053490060Df61D374A42D95Fd570D25418a7';
const PAYMENT_ROUTER = '0x5CEed60c98b7F98e79016295AAdaCC5166D2e0Ab';
const USDC = '0x3600000000000000000000000000000000000000';

const AGENTS = [
  { name: 'YieldAgent', type: 1, addr: '0x1111111111111111111111111111111111111111' },
  { name: 'LiquidityAgent', type: 2, addr: '0x2222222222222222222222222222222222222222' },
  { name: 'FXAgent', type: 3, addr: '0x3333333333333333333333333333333333333333' },
  { name: 'PaymentAgent', type: 4, addr: '0x4444444444444444444444444444444444444444' },
  { name: 'RiskAgent', type: 5, addr: '0x5555555555555555555555555555555555555555' },
  { name: 'CoordinatorAgent', type: 0, addr: '0x6666666666666666666666666666666666666666' },
];

const VAULT_ABI = [
  'function deposit(uint256 amount) external',
  'function getVaultBalance() external view returns (uint256)',
  'function totalDeposits() view returns (uint256)',
];
const USDC_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
];
const AGENT_REGISTRY_ABI = [
  'function registerAgent(address wallet, bytes32 agentId, uint8 agentType, string name) returns (address)',
  'function getAgentCount() view returns (uint256)',
  'function isAgent(address wallet) view returns (bool)',
];
const BUDGET_MANAGER_ABI = [
  'function allocate(address agent, uint256 amount) external',
  'function getBudget(address agent) view returns (uint256)',
];
const RISK_ORACLE_ABI = [
  'function getRiskScore() view returns (uint256)',
  'function updateMetrics(uint256 totalExposure, uint256 currentDrawdown) external',
  'function getMetrics() view returns (tuple(uint256 totalExposure, uint256 currentDrawdown, uint256 maxDrawdownReached, uint256 lastRiskCheck, uint256 riskScore, bool circuitBreakerActive))',
];
const PAYMENT_ROUTER_ABI = [
  'function executePayment(address to, uint256 amount, string memo) returns (uint256)',
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC_URL, { chainId: CHAIN_ID, name: 'arc-testnet' });
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  console.log('Wallet:', wallet.address);
  
  await sleep(3000);
  const usdc = new ethers.Contract(USDC, USDC_ABI, wallet);
  console.log('ETH:', ethers.formatEther(await provider.getBalance(wallet.address)));
  await sleep(3000);
  console.log('USDC:', ethers.formatUnits(await usdc.balanceOf(wallet.address), 6));
  console.log('---');
  await sleep(3000);

  // 1. Approve vault to spend USDC
  const approveAmount = ethers.parseUnits('15', 6);
  console.log('Approving vault to spend 15 USDC...');
  const approveTx = await usdc.approve(VAULT, approveAmount);
  await approveTx.wait();
  console.log('Approved:', approveTx.hash);
  await sleep(5000);

  // 2. Deposit 10 USDC into vault
  const vault = new ethers.Contract(VAULT, VAULT_ABI, wallet);
  console.log('Depositing 10 USDC into vault...');
  const depositTx = await vault.deposit(ethers.parseUnits('10', 6));
  await depositTx.wait();
  console.log('Deposited:', depositTx.hash);
  await sleep(5000);

  // 3. Register 6 agents
  const registry = new ethers.Contract(AGENT_REGISTRY, AGENT_REGISTRY_ABI, wallet);
  for (const agent of AGENTS) {
    const agentId = ethers.keccak256(ethers.toUtf8Bytes(agent.name));
    console.log(`Registering ${agent.name}...`);
    const tx = await registry.registerAgent(agent.addr, agentId, agent.type, agent.name);
    await tx.wait();
    console.log('  tx:', tx.hash);
    await sleep(3000);
  }

  // 4. Allocate budgets (1 USDC each)
  const budgetMgr = new ethers.Contract(BUDGET_MANAGER, BUDGET_MANAGER_ABI, wallet);
  for (const agent of AGENTS) {
    console.log(`Allocating budget to ${agent.name}...`);
    const tx = await budgetMgr.allocate(agent.addr, ethers.parseUnits('1', 6));
    await tx.wait();
    console.log('  tx:', tx.hash);
    await sleep(3000);
  }

  // 5. Update risk metrics
  try {
    const risk = new ethers.Contract(RISK_ORACLE, RISK_ORACLE_ABI, wallet);
    console.log('Updating risk metrics...');
    const tx = await risk.updateMetrics(ethers.parseUnits('10', 6), ethers.parseUnits('0.5', 6));
    await tx.wait();
    console.log('  tx:', tx.hash);
  } catch (e) {
    console.log('Risk oracle update failed:', e.message?.slice(0, 150));
  }

  // 6. Execute a nanopayment between agents
  try {
    const paymentRouter = new ethers.Contract(PAYMENT_ROUTER, PAYMENT_ROUTER_ABI, wallet);
    console.log('Executing payment to YieldAgent...');
    const tx = await paymentRouter.executePayment(AGENTS[0].addr, ethers.parseUnits('0.5', 6), 'Yield optimization fee');
    await tx.wait();
    console.log('  tx:', tx.hash);
  } catch (e) {
    console.log('Payment failed:', e.message?.slice(0, 150));
  }

  // Verify
  console.log('\n--- Verification ---');
  const vaultBal = await vault.getVaultBalance();
  console.log('Vault balance:', ethers.formatUnits(vaultBal, 6), 'USDC');
  const agentCount = await registry.getAgentCount();
  console.log('Registered agents:', agentCount.toString());
  const usdcBal = await usdc.balanceOf(wallet.address);
  console.log('Remaining USDC:', ethers.formatUnits(usdcBal, 6));
  const risk = new ethers.Contract(RISK_ORACLE, RISK_ORACLE_ABI, provider);
  const riskScore = await risk.getRiskScore();
  console.log('Risk score:', riskScore.toString());
  const paymentCount = await new ethers.Contract(PAYMENT_ROUTER, ['function getPaymentCount() view returns (uint256)'], provider).getPaymentCount();
  console.log('Payments:', paymentCount.toString());
}

main().catch(e => { console.error(e); process.exit(1); });
