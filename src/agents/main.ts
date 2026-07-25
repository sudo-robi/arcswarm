import { ethers } from "ethers";
import { CoordinatorAgent, ContractAddresses } from "./agents";

const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";

const CONTRACT_ADDRESSES: ContractAddresses = {
  vault: process.env.VAULT_ADDRESS || "0x...",
  budgetManager: process.env.BUDGET_MANAGER_ADDRESS || "0x...",
  agentRegistry: process.env.AGENT_REGISTRY_ADDRESS || "0x...",
  riskOracle: process.env.RISK_ORACLE_ADDRESS || "0x...",
  paymentRouter: process.env.PAYMENT_ROUTER_ADDRESS || "0x...",
  usdc: process.env.USDC_ADDRESS || "0x...",
};

async function main() {
  console.log("=== ArcSwarm Agent Swarm ===\n");

  const provider = new ethers.JsonRpcProvider(ARC_TESTNET_RPC);
  const coordinatorWallet = new ethers.Wallet(
    process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey,
    provider
  );

  console.log("Coordinator wallet:", coordinatorWallet.address);
  console.log("Network:", (await provider.getNetwork()).name);
  console.log("");

  const coordinator = new CoordinatorAgent(
    {
      name: "ArcSwarm Coordinator",
      type: "coordinator",
      wallet: coordinatorWallet,
      contracts: CONTRACT_ADDRESSES,
      interval: 60_000, // 1 minute
    },
    provider,
    CONTRACT_ADDRESSES
  );

  // Handle shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await coordinator.stopSwarm();
    process.exit(0);
  });

  // Start the swarm
  await coordinator.startSwarm();

  // Log status periodically
  setInterval(() => {
    const status = coordinator.getStatus();
    console.log("\n--- Swarm Status ---");
    console.log(`Agents: ${status.agents.length}`);
    console.log(`Total Budget: ${status.totalBudget / 1e6} USDC`);
    console.log(`Risk Score: ${status.riskScore}`);
    console.log(`Circuit Breaker: ${status.circuitBreakerActive}`);
    console.log("--------------------\n");
  }, 300_000); // Every 5 minutes
}

main().catch(console.error);
