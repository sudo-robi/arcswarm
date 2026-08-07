# ArcSwarm — MVP Architecture & Wiring Plan

**Goal:** Ship a working demo for Build on Arc hackathon (deadline Aug 9) showing 6 agents autonomously managing a USDC treasury with 50+ on-chain nanopayments.

---

## 1. Target Architecture (What We Build)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            USER LAYER                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Frontend (Vercel) — Next.js + Tailwind + shadcn/ui                │   │
│  │  • Connect wallet (Circle Wallets)                                 │   │
│  │  • Create vault → deposit USDC → set risk → activate swarm         │   │
│  │  • Dashboard: Treasury, Agents, Live Nanopayments, Risk            │   │
│  │  • tRPC client → API                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │ HTTPS / WSS
┌─────────────────────────────────▼───────────────────────────────────────────┐
│                           API LAYER (Railway/Render)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Node.js + tRPC + PostgreSQL (Prisma)                               │   │
│  │  • Vault CRUD, Agent control, Tx history, Risk alerts              │   │
│  │  • Contract Event Indexer (background worker)                      │   │
│  │  • WebSocket server for live updates                               │   │
│  │  • Circle App Kits Client (Swap, Send, Balance, Gateway, CCTP)     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              ▼                   ▼                   ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │  AGENT WORKERS  │ │  ARC CONTRACTS  │ │  CIRCLE STACK   │
    │  (Background)   │ │  (Deployed)     │ │  (API/SDK)      │
    │                 │ │                 │ │                 │
    │ Coordinator     │ │ ArcSwarmVault   │ │ Agent Wallets   │
    │ Yield           │ │ AgentBudgetMgr  │ │ Nanopayments    │
    │ Liquidity       │ │ AgentRegistry   │ │ App Kits:       │
    │ FX              │ │ RiskOracle      │ │  - Unified Bal  │
    │ Payment         │ │ PaymentRouter   │ │  - Swap         │
    │ Risk            │ │                 │ │  - Send         │
    │                 │ │                 │ │  - Gateway      │
    │ Each agent:     │ │                 │ │  - CCTP         │
    │ • ethers.js     │ │                 │ │ ERC-8004/8183   │
    │ • Real tx signing                          │                 │
    │ • Event listeners                           │                 │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 2. Contract Addresses (Already Deployed)

| Contract | Address | Purpose |
|---|---|---|
| `ArcSwarmVault` | `0x86014c6473574F93d4BFc386541681f8c1200160` | Main treasury, holds USDC |
| `AgentBudgetManager` | `0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e` | Per-agent spend limits |
| `AgentRegistry` | `0x8007d0C9630f1AaB8A371702964AD2a5C07d7868` | ERC-8004 agent identity |
| `RiskOracle` | `0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd` | ERC-8183 risk metrics |
| `PaymentRouter` | `0x11d0b045Df255940de0dF6CfD0130d9D25204214` | x402 nanopayments + batches |
| **USDC (Arc)** | `0x3600000000000000000000000000000000000000` | Native gas + treasury asset |

---

## 3. Wiring Specification — Component by Component

### 3.1 Database Schema (Prisma)

```prisma
// src/api/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Vault {
  id              String   @id @default(cuid())
  address         String   @unique
  userId          String
  riskTolerance   RiskTolerance @default(MODERATE)
  totalDeposits   BigInt   @default(0)
  totalYield      BigInt   @default(0)
  isActive        Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  transactions    Transaction[]
  agents          Agent[]
}

enum RiskTolerance {
  CONSERVATIVE
  MODERATE
  AGGRESSIVE
}

model Agent {
  id            String   @id @default(cuid())
  vaultId       String
  type          AgentType
  walletAddress String   @unique
  budget        BigInt   @default(0)
  spent         BigInt   @default(0)
  active        Boolean  @default(true)
  reputation    Int      @default(50)
  lastActiveAt  DateTime @default(now())
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  vault         Vault    @relation(fields: [vaultId], references: [id], onDelete: Cascade)
  transactions  Transaction[]
}

enum AgentType {
  YIELD
  LIQUIDITY
  FX
  PAYMENT
  RISK
  COORDINATOR
}

model Transaction {
  id          String         @id @default(cuid())
  vaultId     String
  agentId     String?
  fromAddress String
  toAddress   String
  amount      BigInt
  type        TransactionType
  memo        String?
  txHash      String?        @unique
  blockNumber BigInt?
  createdAt   DateTime       @default(now())
  vault       Vault          @relation(fields: [vaultId], references: [id], onDelete: Cascade)
  agent       Agent?         @relation(fields: [agentId], references: [id], onDelete: SetNull)
}

enum TransactionType {
  DEPOSIT
  WITHDRAWAL
  NANOPAYMENT
  PAYMENT
  ALLOCATION
  YIELD_HARVEST
  REBALANCE
}

model RiskAlert {
  id          String      @id @default(cuid())
  vaultId     String
  severity    Severity
  type        String
  message     String
  agentId     String?
  resolved    Boolean     @default(false)
  createdAt   DateTime    @default(now())
  resolvedAt  DateTime?
  vault       Vault       @relation(fields: [vaultId], references: [id], onDelete: Cascade)
}

enum Severity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

model IndexerCursor {
  id          String @id @default("main")
  lastBlock   BigInt
  updatedAt   DateTime @updatedAt
}
```

---

### 3.2 Contract Event Indexer (Background Worker)

```typescript
// src/api/src/indexer.ts
import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import { CONTRACTS, VAULT_ABI, PAYMENT_ROUTER_ABI, RISK_ORACLE_ABI, AGENT_REGISTRY_ABI } from "../lib/contracts";

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");

const VAULT = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);
const PAYMENT_ROUTER = new ethers.Contract(CONTRACTS.paymentRouter, PAYMENT_ROUTER_ABI, provider);
const RISK_ORACLE = new ethers.Contract(CONTRACTS.riskOracle, RISK_ORACLE_ABI, provider);
const AGENT_REGISTRY = new ethers.Contract(CONTRACTS.agentRegistry, AGENT_REGISTRY_ABI, provider);

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

async function indexVaultEvents(fromBlock: bigint, toBlock: bigint) {
  const [deposits, withdrawals, yields, rebalances] = await Promise.all([
    VAULT.queryFilter("Deposited", Number(fromBlock), Number(toBlock)),
    VAULT.queryFilter("Withdrawn", Number(fromBlock), Number(toBlock)),
    VAULT.queryFilter("YieldHarvested", Number(fromBlock), Number(toBlock)),
    VAULT.queryFilter("Rebalanced", Number(fromBlock), Number(toBlock)),
  ]);

  for (const e of deposits) {
    await prisma.transaction.create({
      data: {
        vaultId: (await getVaultIdByAddress(CONTRACTS.vault))!,
        fromAddress: e.args.user,
        toAddress: CONTRACTS.vault,
        amount: e.args.amount,
        type: "DEPOSIT",
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt: new Date((await provider.getBlock(e.blockNumber))!.timestamp * 1000),
      },
    });
  }
  // ... similar for withdrawals, yields, rebalances
}

async function indexPaymentRouterEvents(fromBlock: bigint, toBlock: bigint) {
  const [payments, nanopayments, batches] = await Promise.all([
    PAYMENT_ROUTER.queryFilter("PaymentExecuted", Number(fromBlock), Number(toBlock)),
    PAYMENT_ROUTER.queryFilter("NanopaymentExecuted", Number(fromBlock), Number(toBlock)),
    PAYMENT_ROUTER.queryFilter("BatchPaymentExecuted", Number(fromBlock), Number(toBlock)),
  ]);

  for (const e of nanopayments) {
    await prisma.transaction.create({
      data: {
        vaultId: (await getVaultIdByAddress(CONTRACTS.vault))!,
        agentId: (await getAgentIdByWallet(e.args.payer))!,
        fromAddress: e.args.payer,
        toAddress: e.args.payee,
        amount: e.args.amount,
        type: "NANOPAYMENT",
        memo: e.args.serviceId,
        txHash: e.transactionHash,
        blockNumber: e.blockNumber,
        createdAt: new Date((await provider.getBlock(e.blockNumber))!.timestamp * 1000),
      },
    });
  }
  // ... similar for payments, batches
}

async function indexRiskOracleEvents(fromBlock: bigint, toBlock: bigint) {
  const checks = await RISK_ORACLE.queryFilter("RiskCheckCompleted", Number(fromBlock), Number(toBlock));
  for (const e of checks) {
    if (e.args.riskScore >= 70) {
      await prisma.riskAlert.create({
        data: {
          vaultId: (await getVaultIdByAddress(CONTRACTS.vault))!,
          severity: e.args.riskScore >= 80 ? "CRITICAL" : "HIGH",
          type: "RISK_THRESHOLD",
          message: `Risk score ${e.args.riskScore}/100`,
          createdAt: new Date((await provider.getBlock(e.blockNumber))!.timestamp * 1000),
        },
      });
    }
  }
}

async function runIndexer() {
  const lastBlock = await getLastIndexedBlock();
  const currentBlock = await provider.getBlockNumber();
  const CHUNK = 2000;

  for (let from = Number(lastBlock) + 1; from <= currentBlock; from += CHUNK) {
    const to = Math.min(from + CHUNK - 1, currentBlock);
    console.log(`Indexing blocks ${from} - ${to}`);

    await Promise.all([
      indexVaultEvents(BigInt(from), BigInt(to)),
      indexPaymentRouterEvents(BigInt(from), BigInt(to)),
      indexRiskOracleEvents(BigInt(from), BigInt(to)),
    ]);

    await setLastIndexedBlock(BigInt(to));
  }
}

// Run every 15 seconds
setInterval(runIndexer, 15_000);
runIndexer();
```

---

### 3.3 Agent Base Class — Real Contract Integration

```typescript
// src/agents/base.ts (REPLACE)
import { ethers } from "ethers";
import {
  CONTRACTS,
  VAULT_ABI,
  AGENT_REGISTRY_ABI,
  BUDGET_MANAGER_ABI,
  RISK_ORACLE_ABI,
  PAYMENT_ROUTER_ABI,
} from "../lib/contracts";

export interface AgentConfig {
  name: string;
  type: "yield" | "liquidity" | "fx" | "payment" | "risk" | "coordinator";
  wallet: ethers.Wallet;
  contracts: typeof CONTRACTS;
  interval: number;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: "request" | "response" | "alert" | "budget";
  payload: any;
  nanopayment: number;
  timestamp: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected provider: ethers.JsonRpcProvider;
  protected running = false;
  protected messageQueue: AgentMessage[] = [];

  // Real contract instances
  protected vault: ethers.Contract;
  protected budgetManager: ethers.Contract;
  protected agentRegistry: ethers.Contract;
  protected riskOracle: ethers.Contract;
  protected paymentRouter: ethers.Contract;

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    this.config = config;
    this.provider = provider;

    // Initialize contract instances with agent's wallet as signer
    const signer = config.wallet.connect(provider);
    this.vault = new ethers.Contract(config.contracts.vault, VAULT_ABI, signer);
    this.budgetManager = new ethers.Contract(config.contracts.budgetManager, BUDGET_MANAGER_ABI, signer);
    this.agentRegistry = new ethers.Contract(config.contracts.agentRegistry, AGENT_REGISTRY_ABI, signer);
    this.riskOracle = new ethers.Contract(config.contracts.riskOracle, RISK_ORACLE_ABI, signer);
    this.paymentRouter = new ethers.Contract(config.contracts.paymentRouter, PAYMENT_ROUTER_ABI, signer);
  }

  abstract execute(): Promise<void>;
  abstract handleMessage(msg: AgentMessage): Promise<void>;

  async start() {
    this.running = true;
    console.log(`[${this.config.name}] Starting on ${this.config.wallet.address}...`);
    while (this.running) {
      try {
        await this.execute();
        await this.processMessages();
      } catch (err) {
        console.error(`[${this.config.name}] Error:`, err);
      }
      await new Promise((r) => setTimeout(r, this.config.interval));
    }
  }

  stop() {
    this.running = false;
    console.log(`[${this.config.name}] Stopped`);
  }

  protected async processMessages() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      await this.handleMessage(msg);
    }
  }

  // REAL nanopayment execution
  protected async sendNanopayment(
    to: string,
    amount: number,
    serviceId: string
  ): Promise<string> {
    try {
      const tx = await this.paymentRouter.executeNanopayment(to, amount, serviceId);
      const receipt = await tx.wait();
      console.log(`[${this.config.name}] Nanopayment sent: ${amount} USDC to ${to} (${serviceId}) — tx: ${receipt.hash}`);
      return receipt.hash;
    } catch (err) {
      console.error(`[${this.config.name}] Nanopayment failed:`, err);
      throw err;
    }
  }

  // REAL broadcast (for demo, logs; in prod: message queue / WebSocket)
  protected async broadcastMessage(
    type: AgentMessage["type"],
    payload: any,
    nanopayment: number = 1000
  ) {
    const msg: AgentMessage = {
      from: this.config.wallet.address,
      to: "broadcast",
      type,
      payload,
      nanopayment,
      timestamp: Date.now(),
    };
    console.log(`[${this.config.name}] Broadcast:`, type, JSON.stringify(payload).slice(0, 100));
    return msg;
  }

  receiveMessage(msg: AgentMessage) {
    this.messageQueue.push(msg);
  }

  // Helper: check remaining budget
  protected async getRemainingBudget(): Promise<bigint> {
    return await this.budgetManager.getRemaining(this.config.wallet.address);
  }

  // Helper: spend budget (called after successful operation)
  protected async spendBudget(amount: number): Promise<boolean> {
    const tx = await this.budgetManager.spend(this.config.wallet.address, amount);
    await tx.wait();
    return true;
  }
}
```

---

### 3.4 Coordinator Agent — Bootstraps the Swarm

```typescript
// src/agents/coordinator.ts (KEY CHANGES)
import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage } from "./base";
import { YieldAgent } from "./yield";
import { LiquidityAgent } from "./liquidity";
import { FXAgent } from "./fx";
import { PaymentAgent } from "./payment";
import { RiskAgent } from "./risk";
import { CONTRACTS, AGENT_REGISTRY_ABI } from "../lib/contracts";

interface AgentStatus {
  name: string;
  type: string;
  wallet: string;
  budget: number;
  spent: number;
  active: boolean;
  lastActivity: number;
}

export class CoordinatorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent> = new Map();
  private agentStatuses: Map<string, AgentStatus> = new Map();

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    super(config, provider);
  }

  async initializeSwarm(): Promise<void> {
    console.log(`[${this.config.name}] Initializing swarm...`);

    // 1. Create agent wallets (in prod: use Circle Agent Stack)
    const agentConfigs = [
      { name: "Yield Agent", type: "yield" as const, interval: 300_000 },
      { name: "Liquidity Agent", type: "liquidity" as const, interval: 3_600_000 },
      { name: "FX Agent", type: "fx" as const, interval: 600_000 },
      { name: "Payment Agent", type: "payment" as const, interval: 60_000 },
      { name: "Risk Agent", type: "risk" as const, interval: 60_000 },
    ];

    for (const cfg of agentConfigs) {
      const wallet = ethers.Wallet.createRandom().connect(this.provider);
      console.log(`[${this.config.name}] Created ${cfg.name}: ${wallet.address}`);

      // 2. Register in AgentRegistry (ERC-8004)
      const agentId = ethers.keccak256(ethers.toUtf8Bytes(`${cfg.type.toUpperCase()}-${Date.now()}`));
      const registry = new ethers.Contract(CONTRACTS.agentRegistry, AGENT_REGISTRY_ABI, this.config.wallet);
      const regTx = await registry.registerAgent(wallet.address, agentId, this.getAgentTypeEnum(cfg.type), cfg.name);
      await regTx.wait();
      console.log(`[${this.config.name}] Registered ${cfg.name} in AgentRegistry`);

      // 3. Grant AGENT_ROLE on PaymentRouter
      const paymentRouter = new ethers.Contract(CONTRACTS.paymentRouter, ["function grantRole(bytes32,address)"], this.config.wallet);
      const agentRole = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
      await (await paymentRouter.grantRole(agentRole, wallet.address)).wait();

      // 4. Grant AGENT_ROLE on Vault (for allocations)
      const vault = new ethers.Contract(CONTRACTS.vault, ["function grantRole(bytes32,address)"], this.config.wallet);
      const vaultAgentRole = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
      await (await vault.grantRole(vaultAgentRole, wallet.address)).wait();

      // 5. Create agent instance
      const agentConfig: AgentConfig = {
        name: cfg.name,
        type: cfg.type,
        wallet,
        contracts: this.config.contracts,
        interval: cfg.interval,
      };

      let agent: BaseAgent;
      switch (cfg.type) {
        case "yield": agent = new YieldAgent(agentConfig, this.provider); break;
        case "liquidity": agent = new LiquidityAgent(agentConfig, this.provider); break;
        case "fx": agent = new FXAgent(agentConfig, this.provider); break;
        case "payment": agent = new PaymentAgent(agentConfig, this.provider); break;
        case "risk": agent = new RiskAgent(agentConfig, this.provider); break;
      }

      this.agents.set(cfg.type, agent);
      this.agentStatuses.set(cfg.type, {
        name: cfg.name,
        type: cfg.type,
        wallet: wallet.address,
        budget: 0,
        spent: 0,
        active: true,
        lastActivity: Date.now(),
      });
    }

    // 6. Initial budget allocation
    await this.allocateBudgets();
  }

  private getAgentTypeEnum(type: string): number {
    const types = { yield: 0, liquidity: 1, fx: 2, payment: 3, risk: 4, coordinator: 5 };
    return types[type as keyof typeof types] ?? 5;
  }

  async execute(): Promise<void> {
    // Periodic: reallocate budgets, check risk, resolve conflicts
    await this.allocateBudgets();
    await this.checkRiskStatus();
  }

  private async allocateBudgets(): Promise<void> {
    const totalBudget = 100_000e6; // 100k USDC
    const allocations = {
      yield: totalBudget * 0.3,
      liquidity: totalBudget * 0.15,
      fx: totalBudget * 0.2,
      payment: totalBudget * 0.25,
      risk: totalBudget * 0.1,
    };

    for (const [type, amount] of Object.entries(allocations)) {
      const status = this.agentStatuses.get(type);
      if (!status) continue;

      // On-chain allocation via Vault → BudgetManager → Agent wallet
      const tx = await this.vault.allocateToAgent(status.wallet, BigInt(amount));
      await tx.wait();

      // Nanopayment notification
      await this.sendNanopayment(status.wallet, 1000, `budget-allocation-${amount}`);

      status.budget = amount;
      console.log(`[${this.config.name}] Allocated ${amount / 1e6} USDC to ${type}`);
    }
  }

  private async checkRiskStatus(): Promise<void> {
    const [healthy, riskScore] = await this.riskOracle.checkHealth();
    if (!healthy) {
      console.log(`[${this.config.name}] RISK ALERT: Score ${riskScore}`);
      await this.broadcastMessage("alert", { action: "circuitBreakerTriggered", riskScore });
    }
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    // Handle alerts, budget requests, etc.
  }

  async startSwarm(): Promise<void> {
    await this.initializeSwarm();
    for (const [type, agent] of this.agents) {
      agent.start();
    }
    this.start();
  }
}
```

---

### 3.5 Yield Agent — Circle App Kits Swap Integration

```typescript
// src/agents/yield.ts (KEY CHANGES)
import { BaseAgent, AgentConfig } from "./base";
import { CircleAppKits } from "@circle-fin/app-kits"; // npm install @circle-fin/app-kits

interface YieldSource {
  name: string;
  apy: number;
  tvl: number;
  riskScore: number;
  address: string;
  appKitPoolId: string; // Circle App Kits pool identifier
}

export class YieldAgent extends BaseAgent {
  private yieldSources: YieldSource[] = [
    { name: "Arc AAVE", apy: 4.2, tvl: 5_000_000, riskScore: 15, address: "0xAAVE", appKitPoolId: "aave-usdc" },
    { name: "Arc Compound", apy: 3.8, tvl: 8_000_000, riskScore: 10, address: "0xCOMP", appKitPoolId: "compound-usdc" },
    { name: "Arc Curve", apy: 5.1, tvl: 2_000_000, riskScore: 25, address: "0xCURVE", appKitPoolId: "curve-usdc" },
  ];

  private appKits: CircleAppKits;

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    super(config, provider);
    this.appKits = new CircleAppKits({ apiKey: process.env.CIRCLE_API_KEY! });
  }

  async execute(): Promise<void> {
    // ... existing scanning logic ...

    if (shouldRebalance) {
      for (const alloc of optimal) {
        // REAL: Use App Kits Swap to move USDC into yield source
        const swapResult = await this.appKits.swap({
          fromToken: "USDC",
          toToken: alloc.source, // e.g., "aUSDC" for AAVE
          amount: alloc.amount.toString(),
          walletAddress: this.config.wallet.address,
        });
        console.log(`[${this.config.name}] Swapped ${alloc.amount / 1e6} USDC → ${alloc.source}: ${swapResult.transactionHash}`);

        // Spend budget on-chain
        await this.spendBudget(alloc.amount);
      }
    }
  }

  // Risk validation via nanopayment
  private async validateWithRiskAgent(source: string): Promise<boolean> {
    await this.sendNanopayment("0xRISK_AGENT_ADDRESS", 1000, `validate-yield-${source}`);
    // In prod: wait for response message
    return true;
  }
}
```

---

### 3.6 Payment Agent — Real Payment Execution

```typescript
// src/agents/payment.ts (KEY CHANGES)
import { BaseAgent, AgentConfig, AgentMessage } from "./base";
import { CircleAppKits } from "@circle-fin/app-kits";

interface ScheduledPayment {
  id: string;
  recipient: string;
  amount: number;
  memo: string;
  scheduledTime: number;
  recurring: boolean;
  interval?: number;
  executed: boolean;
}

export class PaymentAgent extends BaseAgent {
  private scheduledPayments: ScheduledPayment[] = [];
  private appKits: CircleAppKits;

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    super(config, provider);
    this.appKits = new CircleAppKits({ apiKey: process.env.CIRCLE_API_KEY! });
  }

  async execute(): Promise<void> {
    const now = Date.now();
    const due = this.scheduledPayments.filter((p) => !p.executed && p.scheduledTime <= now);

    for (const payment of due) {
      if (payment.amount <= 10_000) { // ≤0.01 USDC = nanopayment
        await this.sendNanopayment(payment.recipient, payment.amount, payment.memo);
      } else {
        // Large payment: App Kits Send
        const result = await this.appKits.send({
          to: payment.recipient,
          amount: (payment.amount / 1e6).toFixed(6),
          token: "USDC",
          walletAddress: this.config.wallet.address,
        });
        console.log(`[${this.config.name}] Sent ${payment.amount / 1e6} USDC to ${payment.recipient}: ${result.transactionHash}`);
      }

      payment.executed = true;
      await this.spendBudget(payment.amount);
    }
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    if (msg.type === "request" && msg.payload.action === "schedulePayment") {
      this.scheduledPayments.push({
        id: `pay-${Date.now()}`,
        ...msg.payload.payment,
        executed: false,
      });
      await this.sendNanopayment(msg.from, 1000, "payment-scheduled");
    }
  }
}
```

---

### 3.7 Risk Agent — Real RiskOracle Updates

```typescript
// src/agents/risk.ts (KEY CHANGES)
import { BaseAgent, AgentConfig, AgentMessage } from "./base";

export class RiskAgent extends BaseAgent {
  async execute(): Promise<void> {
    // 1. Check all agent wallet balances
    const walletHealth = await this.checkAgentWallets();

    // 2. Check yield source health (via App Kits or on-chain)
    const yieldHealth = await this.checkYieldSources();

    // 3. Detect anomalies
    const anomalies = await this.detectAnomalies();

    // 4. Calculate risk score
    const riskScore = this.calculateRiskScore(walletHealth, yieldHealth, anomalies);

    // 5. UPDATE ON-CHAIN RiskOracle
    const tx = await this.riskOracle.updateMetrics(
      ethers.parseUnits(yieldHealth.totalExposure.toString(), 6),
      Math.round(yieldHealth.drawdown * 10000) // basis points
    );
    await tx.wait();
    console.log(`[${this.config.name}] Updated RiskOracle: score=${riskScore}`);

    // 6. Check circuit breaker
    if (riskScore >= 80) {
      await this.triggerCircuitBreaker(riskScore);
    }

    // 7. Report to Coordinator
    await this.broadcastMessage("response", { action: "riskStatus", riskScore, walletHealth, yieldHealth });
  }

  private async checkAgentWallets(): Promise<number> {
    // Query BudgetManager for each agent's remaining budget
    const agents = ["yield", "liquidity", "fx", "payment"];
    let totalHealth = 0;
    for (const type of agents) {
      const status = this.agentStatuses.get(type);
      if (status) {
        const remaining = await this.budgetManager.getRemaining(status.wallet);
        totalHealth += Number(remaining) > 0 ? 100 : 0;
      }
    }
    return totalHealth / agents.length;
  }
}
```

---

### 3.8 Frontend — tRPC Client + Wallet Connect

```typescript
// app/src/lib/api.ts (NEW)
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "../../../src/api/src/index";

export const trpc = createTRPCReact<AppRouter>();

// app/src/lib/contracts.ts — ADD: API fallback
export async function getVaultStats(): Promise<VaultStats> {
  const res = await fetch("/api/vault/stats");
  return res.json();
}

// app/src/app/page.tsx — REPLACE direct RPC with API calls
import { trpc } from "@/lib/api";
import { StatsCards } from "@/components/stats-cards";
// ... use trpc.vault.getVault.useQuery() instead of ethers provider
```

---

## 4. Environment Variables

```bash
# .env (root)
# Blockchain
ARC_RPC_URL=https://rpc.testnet.arc.network
PRIVATE_KEY=0x... # Coordinator deployer key
VAULT_ADDRESS=0x86014c6473574F93d4BFc386541681f8c1200160
BUDGET_MANAGER_ADDRESS=0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e
AGENT_REGISTRY_ADDRESS=0x8007d0C9630f1AaB8A371702964AD2a5C07d7868
RISK_ORACLE_ADDRESS=0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd
PAYMENT_ROUTER_ADDRESS=0x11d0b045Df255940de0dF6CfD0130d9D25204214
USDC_ADDRESS=0x3600000000000000000000000000000000000000

# Circle
CIRCLE_API_KEY=...
CIRCLE_ENTITY_SECRET=...

# Database
DATABASE_URL=postgresql://user:pass@host:5432/arcswarm

# Frontend
NEXT_PUBLIC_API_URL=https://api.arcswarm.xyz
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
```

---

## 5. Implementation Task List (In Order)

| # | Task | File(s) | Est. |
|---|------|---------|------|
| 1 | Prisma schema + migration | `src/api/prisma/schema.prisma` | 1h |
| 2 | Contract event indexer | `src/api/src/indexer.ts` | 4h |
| 3 | tRPC routers wired to Prisma | `src/api/src/routers/*.ts` | 3h |
| 4 | WebSocket server for live updates | `src/api/src/ws.ts` | 2h |
| 5 | BaseAgent real contract integration | `src/agents/base.ts` | 2h |
| 6 | Coordinator swarm bootstrap | `src/agents/coordinator.ts` | 3h |
| 7 | Yield Agent + App Kits Swap | `src/agents/yield.ts` | 3h |
| 8 | Payment Agent + App Kits Send | `src/agents/payment.ts` | 2h |
| 9 | Risk Agent + RiskOracle updates | `src/agents/risk.ts` | 2h |
| 10 | Liquidity Agent (budget mgmt) | `src/agents/liquidity.ts` | 2h |
| 11 | FX Agent (swap execution) | `src/agents/fx.ts` | 2h |
| 12 | Frontend tRPC client + wallet connect | `app/src/lib/api.ts`, `app/src/app/page.tsx` | 4h |
| 13 | Vault creation flow (UI) | `app/src/components/vault-form.tsx` | 3h |
| 14 | Deploy API to Railway | `railway.json`, Dockerfile | 1h |
| 15 | Run agents as PM2 workers | `ecosystem.config.js` | 1h |
| 16 | End-to-end test + 50 nanopayments | — | 2h |

**Total: ~38h focused work**

---

## 6. Demo Script (for 3-min Video)

1. **Connect wallet** → Circle Wallets (email) → lands on dashboard
2. **Create vault** → "Conservative" risk → deposits 10,000 USDC (show tx on ArcScan)
3. **Activate swarm** → Coordinator registers 5 agents → budget allocation nanopayments fire
4. **Live dashboard** → Yield Agent scans → App Kits Swap into AAVE → nanopayment to Risk Agent for validation
5. **Payment Agent** → batches 3 payments → executes via PaymentRouter
6. **Risk Agent** → updates RiskOracle every minute → circuit breaker demo (pause all)
7. **ArcScan** → show 50+ nanopayment transactions in PaymentRouter

---

## 7. What We Cut for Hackathon MVP

| Feature | Reason |
|---|---|
| FX Agent arbitrage execution | Complexity; show FX rate monitoring instead |
| CCTP / Gateway cross-chain | Time; single-chain demo is sufficient |
| Circle Agent Stack managed wallets | Use local ethers.Wallet; mention in deck |
| ERC-8183 job settlement contracts | RiskOracle already covers; skip job creation |
| Multi-vault support | Single vault per user for demo |
| Historical charts | Show current state; add "yield earned" counter |

---

**Ready to start implementation.** Confirm decision points D1-D4 from Engineering Review, then I'll begin with Task 1 (Prisma schema).