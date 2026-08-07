import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

// Skip these tests if no database is available
const DATABASE_URL = process.env.DATABASE_URL;
const shouldSkip = !DATABASE_URL;

describe.skipIf(shouldSkip)("Database Integration", () => {
  const prisma = new PrismaClient();

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data
    await prisma.riskAlert.deleteMany();
    await prisma.transaction.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.vault.deleteMany();
    await prisma.indexerCursor.deleteMany();
  });

  describe("Vault CRUD", () => {
    it("creates a vault", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x1234567890abcdef1234567890abcdef12345678",
          userId: "user-1",
          riskTolerance: "MODERATE",
        },
      });

      expect(vault).toBeDefined();
      expect(vault.id).toBeDefined();
      expect(vault.address).toBe("0x1234567890abcdef1234567890abcdef12345678");
      expect(vault.riskTolerance).toBe("MODERATE");
    });

    it("reads a vault by address", async () => {
      const created = await prisma.vault.create({
        data: {
          address: "0xabcdef1234567890abcdef1234567890abcdef12",
          userId: "user-2",
        },
      });

      const found = await prisma.vault.findUnique({
        where: { address: "0xabcdef1234567890abcdef1234567890abcdef12" },
      });

      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    it("updates vault total deposits", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x1111111111111111111111111111111111111111",
          userId: "user-3",
        },
      });

      const updated = await prisma.vault.update({
        where: { id: vault.id },
        data: { totalDeposits: BigInt(1000000) },
      });

      expect(updated.totalDeposits).toBe(BigInt(1000000));
    });

    it("deletes a vault", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x2222222222222222222222222222222222222222",
          userId: "user-4",
        },
      });

      await prisma.vault.delete({ where: { id: vault.id } });

      const found = await prisma.vault.findUnique({ where: { id: vault.id } });
      expect(found).toBeNull();
    });
  });

  describe("Agent CRUD", () => {
    it("creates an agent with vault relation", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x3333333333333333333333333333333333333333",
          userId: "user-5",
        },
      });

      const agent = await prisma.agent.create({
        data: {
          vaultId: vault.id,
          type: "YIELD",
          walletAddress: "0x4444444444444444444444444444444444444444",
          budget: BigInt(500000),
        },
      });

      expect(agent).toBeDefined();
      expect(agent.type).toBe("YIELD");
      expect(agent.vaultId).toBe(vault.id);
    });

    it("reads agents by vault", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x5555555555555555555555555555555555555555",
          userId: "user-6",
        },
      });

      await prisma.agent.createMany({
        data: [
          { vaultId: vault.id, type: "YIELD", walletAddress: "0x6666666666666666666666666666666666666666" },
          { vaultId: vault.id, type: "LIQUIDITY", walletAddress: "0x7777777777777777777777777777777777777777" },
        ],
      });

      const agents = await prisma.agent.findMany({
        where: { vaultId: vault.id },
      });

      expect(agents).toHaveLength(2);
    });

    it("cascades delete from vault to agents", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x8888888888888888888888888888888888888888",
          userId: "user-7",
        },
      });

      await prisma.agent.create({
        data: {
          vaultId: vault.id,
          type: "FX",
          walletAddress: "0x9999999999999999999999999999999999999999",
        },
      });

      await prisma.vault.delete({ where: { id: vault.id } });

      const agents = await prisma.agent.findMany({
        where: { vaultId: vault.id },
      });
      expect(agents).toHaveLength(0);
    });
  });

  describe("Transaction CRUD", () => {
    it("creates a transaction", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          userId: "user-8",
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          vaultId: vault.id,
          fromAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          toAddress: "0xcccccccccccccccccccccccccccccccccccccccc",
          amount: BigInt(100000),
          type: "DEPOSIT",
        },
      });

      expect(tx).toBeDefined();
      expect(tx.amount).toBe(BigInt(100000));
      expect(tx.type).toBe("DEPOSIT");
    });

    it("creates transaction with agent relation", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0xdddddddddddddddddddddddddddddddddddddddd",
          userId: "user-9",
        },
      });

      const agent = await prisma.agent.create({
        data: {
          vaultId: vault.id,
          type: "PAYMENT",
          walletAddress: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        },
      });

      const tx = await prisma.transaction.create({
        data: {
          vaultId: vault.id,
          agentId: agent.id,
          fromAddress: "0xffffffffffffffffffffffffffffffffffffffff",
          toAddress: "0x1010101010101010101010101010101010101010",
          amount: BigInt(50000),
          type: "NANOPAYMENT",
          txHash: "0xabc123",
        },
      });

      expect(tx.agentId).toBe(agent.id);
    });
  });

  describe("RiskAlert CRUD", () => {
    it("creates a risk alert", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x1212121212121212121212121212121212121212",
          userId: "user-10",
        },
      });

      const alert = await prisma.riskAlert.create({
        data: {
          vaultId: vault.id,
          severity: "HIGH",
          type: "CIRCUIT_BREAKER",
          message: "Circuit breaker triggered",
        },
      });

      expect(alert).toBeDefined();
      expect(alert.severity).toBe("HIGH");
      expect(alert.resolved).toBe(false);
    });

    it("resolves a risk alert", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x1313131313131313131313131313131313131313",
          userId: "user-11",
        },
      });

      const alert = await prisma.riskAlert.create({
        data: {
          vaultId: vault.id,
          severity: "MEDIUM",
          type: "DRAWDOWN_WARNING",
          message: "Drawdown exceeded threshold",
        },
      });

      const resolved = await prisma.riskAlert.update({
        where: { id: alert.id },
        data: { resolved: true, resolvedAt: new Date() },
      });

      expect(resolved.resolved).toBe(true);
      expect(resolved.resolvedAt).toBeDefined();
    });
  });

  describe("IndexerCursor", () => {
    it("creates or updates indexer cursor", async () => {
      // First upsert creates the cursor
      const cursor = await prisma.indexerCursor.upsert({
        where: { id: "main" },
        update: { lastBlock: BigInt(12345) },
        create: { id: "main", lastBlock: BigInt(10000) },
      });

      expect(cursor.lastBlock).toBe(BigInt(10000));

      // Second upsert updates the cursor
      const updated = await prisma.indexerCursor.upsert({
        where: { id: "main" },
        update: { lastBlock: BigInt(15000) },
        create: { id: "main", lastBlock: BigInt(10000) },
      });

      expect(updated.lastBlock).toBe(BigInt(15000));
    });
  });

  describe("Complex Queries", () => {
    it("fetches vault with agents and recent transactions", async () => {
      const vault = await prisma.vault.create({
        data: {
          address: "0x1414141414141414141414141414141414141414",
          userId: "user-12",
          totalDeposits: BigInt(1000000),
        },
      });

      const agent = await prisma.agent.create({
        data: {
          vaultId: vault.id,
          type: "YIELD",
          walletAddress: "0x1515151515151515151515151515151515151515",
          budget: BigInt(100000),
          spent: BigInt(25000),
        },
      });

      await prisma.transaction.createMany({
        data: [
          {
            vaultId: vault.id,
            agentId: agent.id,
            fromAddress: "0x1616161616161616161616161616161616161616",
            toAddress: "0x1717171717171717171717171717171717171717",
            amount: BigInt(50000),
            type: "YIELD_HARVEST",
          },
          {
            vaultId: vault.id,
            fromAddress: "0x1818181818181818181818181818181818181818",
            toAddress: vault.address,
            amount: BigInt(100000),
            type: "DEPOSIT",
          },
        ],
      });

      const fullVault = await prisma.vault.findUnique({
        where: { id: vault.id },
        include: {
          agents: true,
          transactions: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });

      expect(fullVault?.agents).toHaveLength(1);
      expect(fullVault?.transactions).toHaveLength(2);
      expect(fullVault?.totalDeposits).toBe(BigInt(1000000));
    });

    it("counts agents by type across vaults", async () => {
      const vault1 = await prisma.vault.create({
        data: { address: "0x1919191919191919191919191919191919191919", userId: "u1" },
      });
      const vault2 = await prisma.vault.create({
        data: { address: "0x2020202020202020202020202020202020202020", userId: "u2" },
      });

      await prisma.agent.createMany({
        data: [
          { vaultId: vault1.id, type: "YIELD", walletAddress: "0x2121212121212121212121212121212121212121" },
          { vaultId: vault1.id, type: "YIELD", walletAddress: "0x2222222222222222222222222222222222222222" },
          { vaultId: vault2.id, type: "LIQUIDITY", walletAddress: "0x2323232323232323232323232323232323232323" },
        ],
      });

      const yieldCount = await prisma.agent.count({ where: { type: "YIELD" } });
      expect(yieldCount).toBe(2);
    });
  });
});
