import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";

// indexer.ts instantiates PrismaClient, a JsonRpcProvider and 4 ethers.Contract
// instances, then calls `setInterval(runIndexer, 15000)` and `runIndexer()` at
// module load. We mock every external boundary so importing it is side-effect free,
// and we use fake timers so the interval can be driven deterministically.

const mocks = vi.hoisted(() => {
  const provider = {
    getBlockNumber: vi.fn(),
    getBlock: vi.fn(),
  };
  const vaultContract = { queryFilter: vi.fn() };
  const paymentRouterContract = { queryFilter: vi.fn() };
  const riskOracleContract = { queryFilter: vi.fn() };
  const agentRegistryContract = { queryFilter: vi.fn() };

  const prisma = {
    indexerCursor: { findUnique: vi.fn(), upsert: vi.fn() },
    vault: { findUnique: vi.fn(), update: vi.fn() },
    transaction: { create: vi.fn(), findUnique: vi.fn() },
    agent: { findUnique: vi.fn(), upsert: vi.fn() },
    riskAlert: { create: vi.fn() },
  };

  return {
    provider,
    vaultContract,
    paymentRouterContract,
    riskOracleContract,
    agentRegistryContract,
    prisma,
  };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => mocks.prisma),
  AgentType: {},
}));

vi.mock("pino", () => {
  const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const pino = vi.fn(() => logger);
  return { default: pino };
});

vi.mock("ethers", () => {
  const JsonRpcProvider = vi.fn(() => mocks.provider);
  const Contract = vi.fn((address: string) => {
    const a = address.toLowerCase();
    if (a === "0x86014c6473574f93d4bfc386541681f8c1200160") return mocks.vaultContract;
    if (a === "0x11d0b045df255940de0df6cfd0130d9d25204214") return mocks.paymentRouterContract;
    if (a === "0xf36cb7f4c8d7e267fffeea33d0757e1a5a94c3cd") return mocks.riskOracleContract;
    if (a === "0x8007d0c9630f1aab8a371702964ad2a5c07d7868") return mocks.agentRegistryContract;
    return {};
  });
  return { ethers: { JsonRpcProvider, Contract }, JsonRpcProvider, Contract };
});

const CONTRACTS = {
  vault: "0x86014c6473574f93d4bfc386541681f8c1200160",
  paymentRouter: "0x11d0b045df255940de0df6cfd0130d9d25204214",
  riskOracle: "0xf36cb7f4c8d7e267fffeea33d0757e1a5a94c3cd",
  agentRegistry: "0x8007d0c9630f1aab8a371702964ad2a5c07d7868",
};

const TS = 1_700_000_000;

function makeEvent(args: Record<string, unknown>, blockNumber = 1, transactionHash = "0xtx") {
  return { args, transactionHash, blockNumber };
}

function resetIndexerMocks() {
  vi.clearAllMocks();

  mocks.provider.getBlockNumber.mockResolvedValue(10);
  mocks.provider.getBlock.mockResolvedValue({ timestamp: TS });

  mocks.prisma.indexerCursor.findUnique.mockResolvedValue({ id: "main", lastBlock: 0n });
  mocks.prisma.indexerCursor.upsert.mockResolvedValue({});
  mocks.prisma.vault.findUnique.mockResolvedValue({ id: "vault-1" });
  mocks.prisma.vault.update.mockResolvedValue({});
  mocks.prisma.transaction.create.mockResolvedValue({ id: "tx" });
  mocks.prisma.transaction.findUnique.mockResolvedValue(null);
  mocks.prisma.agent.findUnique.mockResolvedValue(null);
  mocks.prisma.agent.upsert.mockResolvedValue({});
  mocks.prisma.riskAlert.create.mockResolvedValue({ id: "alert" });

  for (const c of [
    mocks.vaultContract,
    mocks.paymentRouterContract,
    mocks.riskOracleContract,
    mocks.agentRegistryContract,
  ]) {
    c.queryFilter.mockResolvedValue([]);
  }
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
}

/** Fire one 15s indexer tick and flush the async chain it spawns. */
async function runOnce() {
  await vi.advanceTimersByTimeAsync(15_000);
  await flush();
}

describe("indexer (packages/api/src/indexer.ts)", () => {
  beforeAll(async () => {
    vi.useFakeTimers();
    // Importing the module triggers the initial runIndexer() + setInterval.
    await import("../src/indexer.js");
    await flush();
  });

  afterAll(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    resetIndexerMocks();
  });

  it("indexes vault Deposit events as transactions and increments totalDeposits", async () => {
    mocks.vaultContract.queryFilter.mockImplementation(async (name: string) => {
      if (name === "Deposited") {
        return [makeEvent({ user: "0xUSER", amount: 100n }, 5, "0xdep1")];
      }
      return [];
    });

    await runOnce();

    expect(mocks.prisma.transaction.create).toHaveBeenCalledWith({
      data: {
        vaultId: "vault-1",
        fromAddress: "0xUSER",
        toAddress: CONTRACTS.vault,
        amount: 100n,
        type: "DEPOSIT",
        txHash: "0xdep1",
        blockNumber: 5,
        createdAt: new Date(TS * 1000),
      },
    });
    expect(mocks.prisma.vault.update).toHaveBeenCalledWith({
      where: { id: "vault-1" },
      data: { totalDeposits: { increment: 100n } },
    });
  });

  it("indexes Withdraw / YieldHarvest / Rebalance events with the right types and totals", async () => {
    mocks.vaultContract.queryFilter.mockImplementation(async (name: string) => {
      if (name === "Withdrawn") return [makeEvent({ user: "0xU", amount: 25n })];
      if (name === "YieldHarvested") return [makeEvent({ amount: 7n })];
      if (name === "Rebalanced") return [makeEvent({ yieldAmount: 3n, liquidityAmount: 4n })];
      return [];
    });

    await runOnce();

    const created = mocks.prisma.transaction.create.mock.calls.map((c: any[]) => c[0].data);
    expect(created.map((d: any) => d.type).sort()).toEqual([
      "REBALANCE",
      "WITHDRAWAL",
      "YIELD_HARVEST",
    ]);
    expect(created.find((d: any) => d.type === "WITHDRAWAL")).toMatchObject({
      fromAddress: CONTRACTS.vault,
      toAddress: "0xU",
      amount: 25n,
    });
    expect(created.find((d: any) => d.type === "REBALANCE")).toMatchObject({ amount: 7n });

    expect(mocks.prisma.vault.update).toHaveBeenCalledWith({
      where: { id: "vault-1" },
      data: { totalDeposits: { decrement: 25n } },
    });
    expect(mocks.prisma.vault.update).toHaveBeenCalledWith({
      where: { id: "vault-1" },
      data: { totalYield: { increment: 7n } },
    });
  });

  it("indexes nothing when no vault is registered on-chain", async () => {
    mocks.prisma.vault.findUnique.mockResolvedValue(null);

    await runOnce();

    expect(mocks.prisma.transaction.create).not.toHaveBeenCalled();
    expect(mocks.vaultContract.queryFilter).not.toHaveBeenCalled();
  });

  it("indexes NanopaymentExecuted + PaymentExecuted events and resolves agent ids from payer wallet", async () => {
    mocks.prisma.agent.findUnique.mockImplementation(async ({ where }: any) =>
      where.walletAddress === "0xpayer" ? { id: "agent-9" } : null
    );

    mocks.paymentRouterContract.queryFilter.mockImplementation(async (name: string) => {
      if (name === "NanopaymentExecuted") {
        return [makeEvent({ payer: "0xpayer", payee: "0xpayee", amount: 5n, serviceId: "svc-1" })];
      }
      if (name === "PaymentExecuted") {
        return [makeEvent({ from: "0xunlisted", to: "0xto", amount: 9n })];
      }
      return [];
    });

    await runOnce();

    const created = mocks.prisma.transaction.create.mock.calls.map((c: any[]) => c[0].data);
    expect(created).toHaveLength(2);

    const nano = created.find((d: any) => d.type === "NANOPAYMENT");
    expect(nano).toMatchObject({
      vaultId: "vault-1",
      agentId: "agent-9",
      fromAddress: "0xpayer",
      toAddress: "0xpayee",
      amount: 5n,
      memo: "svc-1",
    });

    const payment = created.find((d: any) => d.type === "PAYMENT");
    expect(payment).toMatchObject({ agentId: undefined, fromAddress: "0xunlisted", toAddress: "0xto" });
    expect(payment).not.toHaveProperty("memo");
  });

  it("creates risk alerts above the threshold and for circuit breakers", async () => {
    mocks.riskOracleContract.queryFilter.mockImplementation(async (name: string) => {
      if (name === "RiskCheckCompleted") {
        return [
          makeEvent({ riskScore: 75n }),
          makeEvent({ riskScore: 85n }),
          makeEvent({ riskScore: 40n }),
        ];
      }
      if (name === "CircuitBreakerTriggered") {
        return [makeEvent({ riskScore: 95n, timestamp: TS })];
      }
      return [];
    });

    await runOnce();

    const created = mocks.prisma.riskAlert.create.mock.calls.map((c: any[]) => c[0].data);
    expect(created).toHaveLength(3);

    expect(created[0]).toMatchObject({ severity: "HIGH", type: "RISK_THRESHOLD", message: "Risk score 75/100" });
    expect(created[1]).toMatchObject({ severity: "CRITICAL", type: "RISK_THRESHOLD", message: "Risk score 85/100" });
    expect(created[2]).toMatchObject({ severity: "CRITICAL", type: "CIRCUIT_BREAKER" });
  });

  it("upserts agents from AgentRegistered events with the numeric type cast", async () => {
    mocks.agentRegistryContract.queryFilter.mockImplementation(async (name: string) => {
      if (name === "AgentRegistered") {
        return [
          makeEvent({ wallet: "0xWALLETA", agentType: 0 }),
          makeEvent({ wallet: "0xWalletB", agentType: 5 }),
        ];
      }
      return [];
    });

    await runOnce();

    expect(mocks.prisma.agent.upsert).toHaveBeenCalledTimes(2);
    const calls = mocks.prisma.agent.upsert.mock.calls.map((c: any[]) => c[0]);

    expect(calls[0]).toMatchObject({
      where: { walletAddress: "0xwalleta" },
      create: {
        vaultId: "vault-1",
        type: "YIELD",
        walletAddress: "0xwalleta",
        budget: 0n,
        spent: 0n,
      },
      update: { active: true },
    });
    expect(calls[1].create.type).toBe("COORDINATOR");
    expect(calls[1].where).toEqual({ walletAddress: "0xwalletb" });
  });

  it("chunks a large block range and advances the cursor per chunk", async () => {
    mocks.provider.getBlockNumber.mockResolvedValue(4500);

    await runOnce();

    // safeBlock = 4500 - 5 = 4495, Chunks: [1..2000], [2001..4000], [4001..4495]
    expect(mocks.prisma.indexerCursor.upsert).toHaveBeenCalledTimes(3);
    const upserts = mocks.prisma.indexerCursor.upsert.mock.calls.map((c: any[]) => c[0]);
    expect(upserts[0].update.lastBlock).toBe(2000n);
    expect(upserts[1].update.lastBlock).toBe(4000n);
    expect(upserts[2].update.lastBlock).toBe(4495n);
  });

  it("starts indexing from the last indexed block + 1", async () => {
    mocks.prisma.indexerCursor.findUnique.mockResolvedValue({ id: "main", lastBlock: 100n });
    mocks.provider.getBlockNumber.mockResolvedValue(120);
    mocks.vaultContract.queryFilter.mockImplementation(async (name: string) =>
      name === "Deposited" ? [makeEvent({ user: "0xU", amount: 1n }, 110, "0xlate")] : []
    );

    await runOnce();

    // safeBlock = 120 - 5 = 115
    const depositCalls = mocks.vaultContract.queryFilter.mock.calls.filter((c: any[]) => c[0] === "Deposited");
    expect(depositCalls[0].slice(1)).toEqual([101, 115]);
    expect(mocks.prisma.transaction.create).toHaveBeenCalled();
    expect(mocks.prisma.indexerCursor.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { lastBlock: 115n } })
    );
  });

  it("does not fire another run until 15 seconds elapse", async () => {
    const before = mocks.prisma.indexerCursor.upsert.mock.calls.length;
    await vi.advanceTimersByTimeAsync(14_999);
    await flush();
    expect(mocks.prisma.indexerCursor.upsert.mock.calls.length).toBe(before);
  });
});
