import { ethers } from "ethers";
import { CoordinatorAgent } from "./coordinator.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

async function main() {
  logger.info("Starting ArcSwarm Coordinator...");

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    logger.error("PRIVATE_KEY not set in environment");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network");
  const coordinatorWallet = new ethers.Wallet(privateKey, provider);

  logger.info({ address: coordinatorWallet.address }, "Coordinator wallet loaded");

  const config = {
    name: "Coordinator",
    type: "coordinator" as const,
    wallet: coordinatorWallet,
    contracts: CONTRACTS,
    interval: 60_000,
  };

  const coordinator = new CoordinatorAgent(config, provider);

  try {
    await coordinator.startSwarm();
  } catch (err) {
    logger.error({ err }, "Failed to start swarm");
    process.exit(1);
  }
}

main().catch((err) => {
  logger.error({ err }, "Unhandled error");
  process.exit(1);
});