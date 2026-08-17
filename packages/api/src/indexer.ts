import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import pino from "pino";
import {
  CONTRACTS,
  VAULT_ABI,
  PAYMENT_ROUTER_ABI,
  RISK_ORACLE_ABI,
  AGENT_REGISTRY_ABI,
  RPC_URL,
} from "./contracts.js";

const logger = pino({ transport: { target: "pino-pretty" } });

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(RPC_URL);

const VAULT = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);
const PAYMENT_ROUTER = new ethers.Contract(CONTRACTS.paymentRouter, PAYMENT_ROUTER_ABI, provider);
const RISK_ORACLE = new ethers.Contract(CONTRACTS.riskOracle, RISK_ORACLE_ABI, provider);
const AGENT_REGISTRY = new ethers.Contract(CONTRACTS.agentRegistry, AGENT_REGISTRY_ABI, provider);

const VAULT_ADDRESS = CONTRACTS.vault.toLowerCase();

async function getLastIndexedBlock(): Promise<bigint> {
  const cursor = await prisma.indexerCursor.findUnique({ where: { id: "main" } });
  return cursor?.lastBlock ?? 0n;
}

async function setLastIndexedBlock(block: bigint) {
  await prisma.indexerCursor.upsert({
    where: { id: "main" },
    create: { id: "main", lastBlock: block },
    update: { lastBlock: block },
  });
}

async function getVaultId(): Promise<string | null> {
  const vault = await prisma.vault.findUnique({ where: { address: VAULT_ADDRESS } });
  return vault?.id ?? null;
}

async function getAgentIdByWallet(wallet: string): Promise<string | null> {
  const agent = await prisma.agent.findUnique({ where: { walletAddress: wallet.toLowerCase() } });
  return agent?.id ?? null;
}

async function getBlockTimestamp(blockNumber: number): Promise<Date> {
  const block = await provider.getBlock(blockNumber);
  if (!block) {
    logger.warn({ blockNumber }, "Block not found, using current time");
    return new Date();
  }
  return new Date(block.timestamp * 1000);
}

async function indexVaultEvents(fromBlock: bigint, toBlock: bigint) {
  const vaultId = await getVaultId();
  if (!vaultId) return;

  const [deposits, withdrawals, yields, rebalances] = await Promise.all([
    VAULT.queryFilter("Deposited", Number(fromBlock), Number(toBlock)),
    VAULT.queryFilter("Withdrawn", Number(fromBlock), Number(toBlock)),
    VAULT.queryFilter("YieldHarvested", Number(fromBlock), Number(toBlock)),
    VAULT.queryFilter("Rebalanced", Number(fromBlock), Number(toBlock)),
  ]);

  for (const e of deposits as ethers.EventLog[]) {
    const existing = await prisma.transaction.findUnique({ where: { txHash: e.transactionHash } });
    if (existing) continue;

    const createdAt = await getBlockTimestamp(e.blockNumber);
    await prisma.transaction.create({
      data: {
        vaultId,
        fromAddress: e.args.user,
        toAddress: VAULT_ADDRESS,
        amount: e.args.amount,
        type: "DEPOSIT",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt,
      },
    });
    await prisma.vault.update({ where: { id: vaultId }, data: { totalDeposits: { increment: e.args.amount } } });
  }

  for (const e of withdrawals as ethers.EventLog[]) {
    const existing = await prisma.transaction.findUnique({ where: { txHash: e.transactionHash } });
    if (existing) continue;

    const createdAt = await getBlockTimestamp(e.blockNumber);
    await prisma.transaction.create({
      data: {
        vaultId,
        fromAddress: VAULT_ADDRESS,
        toAddress: e.args.user,
        amount: e.args.amount,
        type: "WITHDRAWAL",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt,
      },
    });
    await prisma.vault.update({ where: { id: vaultId }, data: { totalDeposits: { decrement: e.args.amount } } });
  }

  for (const e of yields as ethers.EventLog[]) {
    const existing = await prisma.transaction.findUnique({ where: { txHash: e.transactionHash } });
    if (existing) continue;

    const createdAt = await getBlockTimestamp(e.blockNumber);
    await prisma.transaction.create({
      data: {
        vaultId,
        fromAddress: VAULT_ADDRESS,
        toAddress: VAULT_ADDRESS,
        amount: e.args.amount,
        type: "YIELD_HARVEST",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt,
      },
    });
    await prisma.vault.update({ where: { id: vaultId }, data: { totalYield: { increment: e.args.amount } } });
  }

  for (const e of rebalances as ethers.EventLog[]) {
    const existing = await prisma.transaction.findUnique({ where: { txHash: e.transactionHash } });
    if (existing) continue;

    const createdAt = await getBlockTimestamp(e.blockNumber);
    await prisma.transaction.create({
      data: {
        vaultId,
        fromAddress: VAULT_ADDRESS,
        toAddress: VAULT_ADDRESS,
        amount: e.args.yieldAmount + e.args.liquidityAmount,
        type: "REBALANCE",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt,
      },
    });
  }
}

async function indexPaymentRouterEvents(fromBlock: bigint, toBlock: bigint) {
  const vaultId = await getVaultId();
  if (!vaultId) return;

  const [payments, nanopayments, batches] = await Promise.all([
    PAYMENT_ROUTER.queryFilter("PaymentExecuted", Number(fromBlock), Number(toBlock)),
    PAYMENT_ROUTER.queryFilter("NanopaymentExecuted", Number(fromBlock), Number(toBlock)),
    PAYMENT_ROUTER.queryFilter("BatchPaymentExecuted", Number(fromBlock), Number(toBlock)),
  ]);

  for (const e of nanopayments as ethers.EventLog[]) {
    const existing = await prisma.transaction.findUnique({ where: { txHash: e.transactionHash } });
    if (existing) continue;

    const agentId = await getAgentIdByWallet(e.args.payer);
    const createdAt = await getBlockTimestamp(e.blockNumber);
    await prisma.transaction.create({
      data: {
        vaultId,
        agentId: agentId ?? undefined,
        fromAddress: e.args.payer,
        toAddress: e.args.payee,
        amount: e.args.amount,
        type: "NANOPAYMENT",
        memo: e.args.serviceId,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt,
      },
    });
  }

  for (const e of payments as ethers.EventLog[]) {
    const existing = await prisma.transaction.findUnique({ where: { txHash: e.transactionHash } });
    if (existing) continue;

    const agentId = await getAgentIdByWallet(e.args.from);
    const createdAt = await getBlockTimestamp(e.blockNumber);
    await prisma.transaction.create({
      data: {
        vaultId,
        agentId: agentId ?? undefined,
        fromAddress: e.args.from,
        toAddress: e.args.to,
        amount: e.args.amount,
        type: "PAYMENT",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt,
      },
    });
  }

  for (const e of batches as ethers.EventLog[]) {
    logger.info({ count: e.args.count, totalAmount: e.args.totalAmount.toString() }, "Indexed batch payment event");
  }
}

async function indexRiskOracleEvents(fromBlock: bigint, toBlock: bigint) {
  const vaultId = await getVaultId();
  if (!vaultId) return;

  const checks = await RISK_ORACLE.queryFilter("RiskCheckCompleted", Number(fromBlock), Number(toBlock));
  for (const e of checks as ethers.EventLog[]) {
    if (e.args.riskScore >= 70n) {
      const createdAt = await getBlockTimestamp(e.blockNumber);
      await prisma.riskAlert.create({
        data: {
          vaultId,
          severity: e.args.riskScore >= 80n ? "CRITICAL" : "HIGH",
          type: "RISK_THRESHOLD",
          message: `Risk score ${e.args.riskScore}/100`,
          createdAt,
        },
      });
    }
  }

  const circuitBreakers = await RISK_ORACLE.queryFilter("CircuitBreakerTriggered", Number(fromBlock), Number(toBlock));
  for (const e of circuitBreakers as ethers.EventLog[]) {
    const createdAt = await getBlockTimestamp(e.blockNumber);
    await prisma.riskAlert.create({
      data: {
        vaultId,
        severity: "CRITICAL",
        type: "CIRCUIT_BREAKER",
        message: `Circuit breaker triggered at risk score ${e.args.riskScore}`,
        createdAt,
      },
    });
  }
}

const AGENT_TYPE_NAMES = ["YIELD", "LIQUIDITY", "FX", "PAYMENT", "RISK", "COORDINATOR"] as const;

async function indexAgentRegistryEvents(fromBlock: bigint, toBlock: bigint) {
  const registered = await AGENT_REGISTRY.queryFilter("AgentRegistered", Number(fromBlock), Number(toBlock));
  const vaultId = await getVaultId();
  if (!vaultId) return;

  for (const e of registered as ethers.EventLog[]) {
    const agentType = AGENT_TYPE_NAMES[Number(e.args.agentType)] ?? "COORDINATOR";
    await prisma.agent.upsert({
      where: { walletAddress: e.args.wallet.toLowerCase() },
      create: {
        vaultId,
        type: agentType,
        walletAddress: e.args.wallet.toLowerCase(),
        budget: 0n,
        spent: 0n,
      },
      update: { active: true },
    });
  }
}

async function runIndexer() {
  const lastBlock = await getLastIndexedBlock();
  const currentBlock = await provider.getBlockNumber();
  const CONFIRMATIONS = 5;
  const safeBlock = currentBlock - CONFIRMATIONS;
  const CHUNK = 2000;

  if (safeBlock <= Number(lastBlock)) {
    return;
  }

  logger.info({ from: lastBlock.toString(), to: safeBlock, confirmed: currentBlock }, "Indexing blocks");

  for (let from = Number(lastBlock) + 1; from <= safeBlock; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, safeBlock);
    logger.debug({ from, to }, "Indexing chunk");

    await Promise.all([
      indexVaultEvents(BigInt(from), BigInt(to)),
      indexPaymentRouterEvents(BigInt(from), BigInt(to)),
      indexRiskOracleEvents(BigInt(from), BigInt(to)),
      indexAgentRegistryEvents(BigInt(from), BigInt(to)),
    ]);

    await setLastIndexedBlock(BigInt(to));
  }
}

let isRunning = false;

async function safeRunIndexer() {
  if (isRunning) {
    logger.debug("Indexer already running, skipping");
    return;
  }
  isRunning = true;
  try {
    await runIndexer();
  } catch (err) {
    logger.error({ err }, "Indexer run failed");
  } finally {
    isRunning = false;
  }
}

setInterval(safeRunIndexer, 15_000);
safeRunIndexer();
