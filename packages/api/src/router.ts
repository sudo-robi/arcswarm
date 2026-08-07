import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import superjson from "superjson";
import {
  CONTRACTS,
  VAULT_ABI,
  RISK_ORACLE_ABI,
} from "./contracts.js";

const t = initTRPC.context<{ prisma: PrismaClient }>().create({ transformer: superjson });

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");

const vaultContract = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);
const riskOracleContract = new ethers.Contract(CONTRACTS.riskOracle, RISK_ORACLE_ABI, provider);

const appRouter = t.router({
  vault: t.router({
    get: t.procedure
      .input(z.object({ address: z.string() }))
      .query(async ({ input, ctx }) => {
        const vault = await ctx.prisma.vault.findUnique({
          where: { address: input.address.toLowerCase() },
        });
        if (!vault) return null;

        const [balance, totalDeposits, totalYield] = await Promise.all([
          vaultContract.getVaultBalance(),
          vaultContract.totalDeposits(),
          vaultContract.totalYield(),
        ]);

        return {
          ...vault,
          balance: balance.toString(),
          totalDeposits: totalDeposits.toString(),
          totalYield: totalYield.toString(),
        };
      }),

    getAll: t.procedure.query(async ({ ctx }) => {
      return ctx.prisma.vault.findMany({ orderBy: { createdAt: "desc" } });
    }),

    create: t.procedure
      .input(
        z.object({
          userId: z.string(),
          riskTolerance: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]).default("MODERATE"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const vault = await ctx.prisma.vault.create({
          data: {
            address: CONTRACTS.vault,
            userId: input.userId,
            riskTolerance: input.riskTolerance,
          },
        });
        return vault;
      }),

    activate: t.procedure
      .input(z.object({ vaultId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        return ctx.prisma.vault.update({
          where: { id: input.vaultId },
          data: { isActive: true },
        });
      }),

    getLiveData: t.procedure
      .input(z.object({ vaultAddress: z.string() }))
      .query(async () => {
        const [balance, totalDeposits, totalYield] = await Promise.all([
          vaultContract.getVaultBalance(),
          vaultContract.totalDeposits(),
          vaultContract.totalYield(),
        ]);

        return {
          balance: balance.toString(),
          totalDeposits: totalDeposits.toString(),
          totalYield: totalYield.toString(),
        };
      }),
  }),

  agent: t.router({
    getAll: t.procedure
      .input(z.object({ vaultId: z.string().optional() }).optional())
      .query(async ({ input, ctx }) => {
        return ctx.prisma.agent.findMany({
          where: input?.vaultId ? { vaultId: input.vaultId } : {},
          orderBy: { createdAt: "asc" },
        });
      }),

    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input, ctx }) => {
        return ctx.prisma.agent.findUnique({ where: { id: input.id } });
      }),

    update: t.procedure
      .input(
        z.object({
          id: z.string(),
          budget: z.bigint().optional(),
          spent: z.bigint().optional(),
          active: z.boolean().optional(),
          reputation: z.number().optional(),
          lastActiveAt: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        return ctx.prisma.agent.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        });
      }),

    create: t.procedure
      .input(
        z.object({
          vaultId: z.string(),
          type: z.enum(["YIELD", "LIQUIDITY", "FX", "PAYMENT", "RISK", "COORDINATOR"]),
          walletAddress: z.string(),
          budget: z.bigint().default(0n),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return ctx.prisma.agent.create({ data: input });
      }),
  }),

  transaction: t.router({
    getAll: t.procedure
      .input(
        z.object({
          vaultId: z.string().optional(),
          agentId: z.string().optional(),
          type: z.enum(["DEPOSIT", "WITHDRAWAL", "NANOPAYMENT", "PAYMENT", "ALLOCATION", "YIELD_HARVEST", "REBALANCE"]).optional(),
          limit: z.number().default(50),
          offset: z.number().default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        const where: any = {};
        if (input.vaultId) where.vaultId = input.vaultId;
        if (input.agentId) where.agentId = input.agentId;
        if (input.type) where.type = input.type;

        const [transactions, total] = await Promise.all([
          ctx.prisma.transaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: input.limit,
            skip: input.offset,
          }),
          ctx.prisma.transaction.count({ where }),
        ]);

        return { transactions, total };
      }),

    create: t.procedure
      .input(
        z.object({
          vaultId: z.string(),
          agentId: z.string().optional(),
          fromAddress: z.string(),
          toAddress: z.string(),
          amount: z.bigint(),
          type: z.enum(["DEPOSIT", "WITHDRAWAL", "NANOPAYMENT", "PAYMENT", "ALLOCATION", "YIELD_HARVEST", "REBALANCE"]),
          memo: z.string().optional(),
          txHash: z.string().optional(),
          blockNumber: z.bigint().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return ctx.prisma.transaction.create({ data: input });
      }),
  }),

  risk: t.router({
    getAlerts: t.procedure
      .input(z.object({ vaultId: z.string().optional(), resolved: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        const where: any = {};
        if (input.vaultId) where.vaultId = input.vaultId;
        if (input.resolved !== undefined) where.resolved = input.resolved;

        return ctx.prisma.riskAlert.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });
      }),

    createAlert: t.procedure
      .input(
        z.object({
          vaultId: z.string(),
          severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          type: z.string(),
          message: z.string(),
          agentId: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return ctx.prisma.riskAlert.create({ data: input });
      }),

    resolveAlert: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        return ctx.prisma.riskAlert.update({
          where: { id: input.id },
          data: { resolved: true, resolvedAt: new Date() },
        });
      }),

    getLiveScore: t.procedure
      .input(z.object({ riskOracleAddress: z.string() }))
      .query(async () => {
        const [healthy, riskScore] = await riskOracleContract.checkHealth();
        return { healthy, riskScore: riskScore.toString() };
      }),
  }),

  stats: t.procedure
    .input(z.object({ vaultId: z.string().optional() }))
    .query(async ({ input, ctx }) => {
      const where = input.vaultId ? { vaultId: input.vaultId } : {};

      const [agents, transactions, alerts, vault] = await Promise.all([
        ctx.prisma.agent.findMany({ where }),
        ctx.prisma.transaction.count({ where }),
        ctx.prisma.riskAlert.count({ where: { ...where, resolved: false } }),
        input.vaultId ? ctx.prisma.vault.findUnique({ where: { id: input.vaultId } }) : Promise.resolve(null),
      ]);

      const totalBudget = agents.reduce((sum: bigint, a: { budget: bigint | null }) => sum + (a.budget || 0n), 0n);
      const totalSpent = agents.reduce((sum: bigint, a: { spent: bigint | null }) => sum + (a.spent || 0n), 0n);
      const riskScore = await riskOracleContract.getRiskScore();

      return {
        totalAgents: agents.length,
        activeAgents: agents.filter((a: { active: boolean }) => a.active).length,
        totalBudget: totalBudget.toString(),
        totalSpent: totalSpent.toString(),
        totalTransactions: transactions,
        unresolvedAlerts: alerts,
        totalYield: vault?.totalYield?.toString() || "0",
        riskScore: riskScore.toString(),
      };
    }),
});

export type AppRouter = typeof appRouter;

export { appRouter, prisma, provider };