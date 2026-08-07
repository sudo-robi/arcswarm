import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ---- Module-level mocks (router.ts instantiates PrismaClient + ethers at load) ----
const mocks = vi.hoisted(() => {
  const vaultContract = {
    getVaultBalance: vi.fn(),
    totalDeposits: vi.fn(),
    totalYield: vi.fn(),
  };
  const riskOracleContract = {
    checkHealth: vi.fn(),
    getRiskScore: vi.fn(),
  };
  const prisma = {
    vault: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    agent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    riskAlert: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  };
  return { vaultContract, riskOracleContract, prisma };
});

vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(() => mocks.prisma),
}));

vi.mock("ethers", () => {
  const JsonRpcProvider = vi.fn(() => ({}));
  const Contract = vi.fn((address: string) => {
    const a = address.toLowerCase();
    if (a === "0x86014c6473574f93d4bfc386541681f8c1200160") return mocks.vaultContract;
    if (a === "0xf36cb7f4c8d7e267fffeea33d0757e1a5a94c3cd") return mocks.riskOracleContract;
    return {};
  });
  return { ethers: { JsonRpcProvider, Contract }, JsonRpcProvider, Contract };
});

import { appRouter } from "../src/router.js";

type Caller = ReturnType<typeof appRouter.createCaller>;
let caller: Caller;

beforeEach(() => {
  vi.clearAllMocks();

  mocks.vaultContract.getVaultBalance.mockResolvedValue(1000000n);
  mocks.vaultContract.totalDeposits.mockResolvedValue(800000n);
  mocks.vaultContract.totalYield.mockResolvedValue(200000n);
  mocks.riskOracleContract.checkHealth.mockResolvedValue([true, 42n]);
  mocks.riskOracleContract.getRiskScore.mockResolvedValue(42n);

  caller = appRouter.createCaller({ prisma: mocks.prisma } as any);
});

afterEach(() => {
  vi.clearAllMocks();
});

const sampleVault = {
  id: "vault-1",
  address: "0x86014c6473574f93d4bfc386541681f8c1200160",
  userId: "user-1",
  riskTolerance: "MODERATE",
  totalDeposits: 800000n,
  totalYield: 200000n,
  isActive: true,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

describe("appRouter", () => {
  describe("vault.get", () => {
    it("returns the vault enriched with on-chain balance data", async () => {
      mocks.prisma.vault.findUnique.mockResolvedValue(sampleVault);

      const result = await caller.vault.get({ address: "0x86014C6473574F93d4BFc386541681f8c1200160" });

      expect(mocks.prisma.vault.findUnique).toHaveBeenCalledWith({
        where: { address: "0x86014c6473574f93d4bfc386541681f8c1200160" },
      });
      expect(result).toEqual({
        ...sampleVault,
        balance: "1000000",
        totalDeposits: "800000",
        totalYield: "200000",
      });
    });

    it("returns null when the vault does not exist", async () => {
      mocks.prisma.vault.findUnique.mockResolvedValue(null);
      const result = await caller.vault.get({ address: "0xabc" });
      expect(result).toBeNull();
      expect(mocks.vaultContract.getVaultBalance).not.toHaveBeenCalled();
    });
  });

  describe("vault.getAll", () => {
    it("lists all vaults ordered by createdAt desc", async () => {
      mocks.prisma.vault.findMany.mockResolvedValue([sampleVault]);
      const result = await caller.vault.getAll();
      expect(mocks.prisma.vault.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: "desc" } });
      expect(result).toHaveLength(1);
    });

    it("returns an empty array when no vaults exist", async () => {
      mocks.prisma.vault.findMany.mockResolvedValue([]);
      expect(await caller.vault.getAll()).toEqual([]);
    });
  });

  describe("vault.create", () => {
    it("defaults riskTolerance to MODERATE", async () => {
      mocks.prisma.vault.create.mockResolvedValue(sampleVault);
      await caller.vault.create({ userId: "user-1" });
      expect(mocks.prisma.vault.create).toHaveBeenCalledWith({
        data: {
          address: "0x86014c6473574F93d4BFc386541681f8c1200160",
          userId: "user-1",
          riskTolerance: "MODERATE",
        },
      });
    });

    it("persists an explicit riskTolerance", async () => {
      mocks.prisma.vault.create.mockResolvedValue(sampleVault);
      await caller.vault.create({ userId: "user-1", riskTolerance: "AGGRESSIVE" });
      expect(mocks.prisma.vault.create).toHaveBeenCalledWith({
        data: { address: expect.any(String), userId: "user-1", riskTolerance: "AGGRESSIVE" },
      });
    });

    it("rejects an invalid riskTolerance enum value", async () => {
      await expect(caller.vault.create({ userId: "u", riskTolerance: "WILD" as any })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("requires userId", async () => {
      await expect(caller.vault.create({} as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("returns the created vault", async () => {
      mocks.prisma.vault.create.mockResolvedValue(sampleVault);
      const result = await caller.vault.create({ userId: "user-1" });
      expect(result).toEqual(sampleVault);
    });
  });

  describe("vault.activate", () => {
    it("sets isActive true for the given vault id", async () => {
      mocks.prisma.vault.update.mockResolvedValue({ ...sampleVault, isActive: true });
      await caller.vault.activate({ vaultId: "vault-1" });
      expect(mocks.prisma.vault.update).toHaveBeenCalledWith({
        where: { id: "vault-1" },
        data: { isActive: true },
      });
    });

    it("requires a vaultId", async () => {
      await expect(caller.vault.activate({} as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("vault.getLiveData", () => {
    it("returns live on-chain numbers as strings", async () => {
      const result = await caller.vault.getLiveData({ vaultAddress: "0xanything" });
      expect(result).toEqual({ balance: "1000000", totalDeposits: "800000", totalYield: "200000" });
    });

    it("requires a vaultAddress input", async () => {
      await expect(caller.vault.getLiveData({} as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("agent.getAll", () => {
    it("returns all agents when no vaultId is given", async () => {
      mocks.prisma.agent.findMany.mockResolvedValue([]);
      await caller.agent.getAll({});
      expect(mocks.prisma.agent.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "asc" },
      });
    });

    it("filters by vaultId when provided", async () => {
      mocks.prisma.agent.findMany.mockResolvedValue([]);
      await caller.agent.getAll({ vaultId: "vault-1" });
      expect(mocks.prisma.agent.findMany).toHaveBeenCalledWith({
        where: { vaultId: "vault-1" },
        orderBy: { createdAt: "asc" },
      });
    });

    it("accepts omitted input (schema allows optional object)", async () => {
      // The input schema is `z.object({ vaultId: z.string().optional() }).optional()`,
      // so calling with no arguments passes zod validation and defaults to empty filter.
      const result = await caller.agent.getAll(undefined as any);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("agent.get", () => {
    it("returns the agent by id", async () => {
      const agent = { id: "agent-1", type: "YIELD" };
      mocks.prisma.agent.findUnique.mockResolvedValue(agent);
      const result = await caller.agent.get({ id: "agent-1" });
      expect(result).toEqual(agent);
      expect(mocks.prisma.agent.findUnique).toHaveBeenCalledWith({ where: { id: "agent-1" } });
    });

    it("returns null when not found", async () => {
      mocks.prisma.agent.findUnique.mockResolvedValue(null);
      expect(await caller.agent.get({ id: "missing" })).toBeNull();
    });

    it("requires an id", async () => {
      await expect(caller.agent.get({} as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("agent.update", () => {
    const agent = { id: "agent-1", budget: 5n, spent: 1n, active: true };

    it("updates only the provided fields and stamps updatedAt", async () => {
      mocks.prisma.agent.update.mockResolvedValue(agent);
      await caller.agent.update({ id: "agent-1", budget: 5000n });
      const payload = mocks.prisma.agent.update.mock.calls[0][0] as any;
      expect(payload).toEqual({
        where: { id: "agent-1" },
        data: expect.objectContaining({
          budget: 5000n,
          updatedAt: expect.any(Date),
        }),
      });
      expect(payload.data).not.toHaveProperty("id");
    });

    it("accepts every optional field", async () => {
      mocks.prisma.agent.update.mockResolvedValue(agent);
      const input = {
        id: "agent-1",
        budget: 1n,
        spent: 2n,
        active: false,
        reputation: 90,
        lastActiveAt: new Date("2024-05-05"),
      };
      await caller.agent.update(input);
      const payload = mocks.prisma.agent.update.mock.calls[0][0] as any;
      expect(payload.data).toMatchObject({
        budget: 1n,
        spent: 2n,
        active: false,
        reputation: 90,
        lastActiveAt: input.lastActiveAt,
      });
    });

    it("rejects a wrong type for budget (number instead of bigint)", async () => {
      await expect(caller.agent.update({ id: "a", budget: 5000 as any })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("requires an id", async () => {
      await expect(caller.agent.update({} as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("agent.create", () => {
    it("defaults budget to 0n", async () => {
      mocks.prisma.agent.create.mockResolvedValue({});
      await caller.agent.create({
        vaultId: "vault-1",
        type: "YIELD",
        walletAddress: "0xabc",
      });
      expect(mocks.prisma.agent.create).toHaveBeenCalledWith({
        data: { vaultId: "vault-1", type: "YIELD", walletAddress: "0xabc", budget: 0n },
      });
    });

    it("persists an explicit budget", async () => {
      mocks.prisma.agent.create.mockResolvedValue({});
      await caller.agent.create({
        vaultId: "vault-1",
        type: "COORDINATOR",
        walletAddress: "0xabc",
        budget: 999n,
      });
      expect(mocks.prisma.agent.create).toHaveBeenCalledWith({
        data: { vaultId: "vault-1", type: "COORDINATOR", walletAddress: "0xabc", budget: 999n },
      });
    });

    it("rejects an invalid agent type enum", async () => {
      await expect(
        caller.agent.create({ vaultId: "v", type: "MAGIC" as any, walletAddress: "0x1" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("requires vaultId, type and walletAddress", async () => {
      await expect(caller.agent.create({} as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("transaction.getAll", () => {
    const tx = { id: "tx-1", type: "DEPOSIT", amount: 10n };

    it("uses default limit 50 and offset 0 with an empty where when no filters", async () => {
      mocks.prisma.transaction.findMany.mockResolvedValue([tx]);
      mocks.prisma.transaction.count.mockResolvedValue(1);
      const result = await caller.transaction.getAll({});

      expect(mocks.prisma.transaction.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
        take: 50,
        skip: 0,
      });
      expect(mocks.prisma.transaction.count).toHaveBeenCalledWith({ where: {} });
      expect(result).toEqual({ transactions: [tx], total: 1 });
    });

    it("builds a where clause from vaultId/agentId/type filters", async () => {
      mocks.prisma.transaction.findMany.mockResolvedValue([]);
      mocks.prisma.transaction.count.mockResolvedValue(0);
      await caller.transaction.getAll({ vaultId: "v-1", agentId: "a-1", type: "NANOPAYMENT" });
      const where = { vaultId: "v-1", agentId: "a-1", type: "NANOPAYMENT" };
      expect(mocks.prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where })
      );
      expect(mocks.prisma.transaction.count).toHaveBeenCalledWith({ where });
    });

    it("passes through pagination parameters", async () => {
      mocks.prisma.transaction.findMany.mockResolvedValue([]);
      mocks.prisma.transaction.count.mockResolvedValue(0);
      await caller.transaction.getAll({ limit: 10, offset: 20 });
      expect(mocks.prisma.transaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      );
    });

    it("rejects an invalid transaction type", async () => {
      await expect(caller.transaction.getAll({ type: "BOGUS" as any })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });
  });

  describe("transaction.create", () => {
    const input = {
      vaultId: "v-1",
      fromAddress: "0xa",
      toAddress: "0xb",
      amount: 1000n,
      type: "PAYMENT" as const,
    };

    it("creates a transaction with the given data", async () => {
      mocks.prisma.transaction.create.mockResolvedValue({ id: "tx-1" });
      await caller.transaction.create(input);
      expect(mocks.prisma.transaction.create).toHaveBeenCalledWith({ data: input });
    });

    it("rejects an invalid type enum", async () => {
      await expect(caller.transaction.create({ ...input, type: "NOPE" as any })).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
    });

    it("rejects a missing amount", async () => {
      await expect(
        caller.transaction.create({ ...input, amount: undefined as any })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("risk.getAlerts", () => {
    const alert = { id: "alert-1", severity: "HIGH" };

    it("returns all alerts when no filters are given", async () => {
      mocks.prisma.riskAlert.findMany.mockResolvedValue([alert]);
      const result = await caller.risk.getAlerts({});
      expect(mocks.prisma.riskAlert.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual([alert]);
    });

    it("filters by vaultId and resolved", async () => {
      mocks.prisma.riskAlert.findMany.mockResolvedValue([]);
      await caller.risk.getAlerts({ vaultId: "v-1", resolved: true });
      expect(mocks.prisma.riskAlert.findMany).toHaveBeenCalledWith({
        where: { vaultId: "v-1", resolved: true },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("risk.createAlert", () => {
    it("creates an alert with severity/type/message", async () => {
      const alert = { id: "a-1" };
      mocks.prisma.riskAlert.create.mockResolvedValue(alert);
      const result = await caller.risk.createAlert({
        vaultId: "v-1",
        severity: "CRITICAL",
        type: "RISK_THRESHOLD",
        message: "Score 90/100",
      });
      expect(mocks.prisma.riskAlert.create).toHaveBeenCalledWith({
        data: {
          vaultId: "v-1",
          severity: "CRITICAL",
          type: "RISK_THRESHOLD",
          message: "Score 90/100",
        },
      });
      expect(result).toEqual(alert);
    });

    it("rejects an invalid severity", async () => {
      await expect(
        caller.risk.createAlert({ vaultId: "v", severity: "MEH" as any, type: "t", message: "m" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("risk.resolveAlert", () => {
    it("marks the alert resolved with a resolvedAt timestamp", async () => {
      const resolved = { id: "a-1", resolved: true, resolvedAt: new Date() };
      mocks.prisma.riskAlert.update.mockResolvedValue(resolved);
      await caller.risk.resolveAlert({ id: "a-1" });
      const payload = mocks.prisma.riskAlert.update.mock.calls[0][0] as any;
      expect(payload).toEqual({
        where: { id: "a-1" },
        data: { resolved: true, resolvedAt: expect.any(Date) },
      });
    });
  });

  describe("risk.getLiveScore", () => {
    it("returns health and risk score from the oracle", async () => {
      mocks.riskOracleContract.checkHealth.mockResolvedValue([true, 12n]);
      const result = await caller.risk.getLiveScore({ riskOracleAddress: "0xabc" });
      expect(result).toEqual({ healthy: true, riskScore: "12" });
      expect(mocks.riskOracleContract.checkHealth).toHaveBeenCalled();
    });
  });

  describe("stats", () => {
    const agents = [
      { id: "a-1", budget: 1000n, spent: 300n, active: true },
      { id: "a-2", budget: 2000n, spent: 500n, active: false },
      { id: "a-3", budget: null, spent: null, active: true },
    ];

    it("computes aggregation math across all vaults when no vaultId", async () => {
      mocks.prisma.agent.findMany.mockResolvedValue(agents);
      mocks.prisma.transaction.count.mockResolvedValue(7);
      mocks.prisma.riskAlert.count.mockResolvedValue(3);
      mocks.riskOracleContract.getRiskScore.mockResolvedValue(55n);

      const result = await caller.stats({});

      expect(mocks.prisma.agent.findMany).toHaveBeenCalledWith({ where: {} });
      expect(mocks.prisma.transaction.count).toHaveBeenCalledWith({ where: {} });
      expect(mocks.prisma.riskAlert.count).toHaveBeenCalledWith({ where: { resolved: false } });

      expect(result).toEqual({
        totalAgents: 3,
        activeAgents: 2,
        totalBudget: "3000",
        totalSpent: "800",
        totalTransactions: 7,
        unresolvedAlerts: 3,
        totalYield: "0",
        riskScore: "55",
      });
    });

    it("filters by vaultId and reports vault totalYield when present", async () => {
      mocks.prisma.agent.findMany.mockResolvedValue([agents[0]]);
      mocks.prisma.transaction.count.mockResolvedValue(1);
      mocks.prisma.riskAlert.count.mockResolvedValue(0);
      mocks.prisma.vault.findUnique.mockResolvedValue({ id: "v-1", totalYield: 123n });
      mocks.riskOracleContract.getRiskScore.mockResolvedValue(1n);

      const result = await caller.stats({ vaultId: "v-1" });

      expect(mocks.prisma.agent.findMany).toHaveBeenCalledWith({ where: { vaultId: "v-1" } });
      expect(mocks.prisma.transaction.count).toHaveBeenCalledWith({ where: { vaultId: "v-1" } });
      expect(mocks.prisma.riskAlert.count).toHaveBeenCalledWith({
        where: { vaultId: "v-1", resolved: false },
      });
      expect(mocks.prisma.vault.findUnique).toHaveBeenCalledWith({ where: { id: "v-1" } });
      expect(result.totalYield).toBe("123");
      expect(result.totalBudget).toBe("1000");
      expect(result.activeAgents).toBe(1);
    });

    it("handles a vault with null totalYield", async () => {
      mocks.prisma.agent.findMany.mockResolvedValue([]);
      mocks.prisma.transaction.count.mockResolvedValue(0);
      mocks.prisma.riskAlert.count.mockResolvedValue(0);
      mocks.prisma.vault.findUnique.mockResolvedValue({ id: "v-1", totalYield: null });
      mocks.riskOracleContract.getRiskScore.mockResolvedValue(0n);

      const result = await caller.stats({ vaultId: "v-1" });
      expect(result.totalYield).toBe("0");
    });
  });

  describe("router exports", () => {
    it("exports the appRouter", () => {
      expect(appRouter).toBeDefined();
      expect(appRouter.vault).toBeDefined();
      expect(appRouter.agent).toBeDefined();
      expect(appRouter.transaction).toBeDefined();
      expect(appRouter.risk).toBeDefined();
      expect(appRouter.stats).toBeDefined();
    });
  });
});
