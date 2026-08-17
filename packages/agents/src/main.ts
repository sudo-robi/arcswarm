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

  let shuttingDown = false;

  const gracefulShutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Received shutdown signal, stopping swarm...");
    try {
      await coordinator.stopSwarm();
      logger.info("Swarm stopped gracefully");
      process.exit(0);
    } catch (err) {
      logger.error({ err }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "Unhandled promise rejection");
  });

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