import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { PrismaClient, Prisma } from "@prisma/client";
import { ethers } from "ethers";
import superjson from "superjson";
import pino from "pino";
import {
  CONTRACTS,
  VAULT_ABI,
  RISK_ORACLE_ABI,
  RPC_URL,
} from "./contracts.js";

const logger = pino({ transport: { target: "pino-pretty" } });

const prisma = new PrismaClient();
const provider = new ethers.JsonRpcProvider(RPC_URL);

type TransactionWhereInput = Prisma.TransactionWhereInput;
type RiskAlertWhereInput = Prisma.RiskAlertWhereInput;

type Context = {
  prisma: PrismaClient;
  walletAddress?: string;
  isAuthenticated: boolean;
};

const t = initTRPC.context<Context>().create({ transformer: superjson });

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.isAuthenticated || !ctx.walletAddress) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Wallet connection required. Please connect your wallet.",
    });
  }
  return next({ ctx: { ...ctx, walletAddress: ctx.walletAddress, isAuthenticated: true as const } });
});

const protectedProcedure = t.procedure.use(enforceAuth);

const vaultContract = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);
const riskOracleContract = new ethers.Contract(CONTRACTS.riskOracle, RISK_ORACLE_ABI, provider);

async function getVaultOnChainData() {
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
}

const appRouter = t.router({
  vault: t.router({
    get: t.procedure
      .input(z.object({ address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum address") }))
      .query(async ({ input, ctx }) => {
        const vault = await ctx.prisma.vault.findUnique({
          where: { address: input.address.toLowerCase() },
        });
        if (!vault) return null;

        try {
          const onChainData = await getVaultOnChainData();
          return { ...vault, ...onChainData };
        } catch (err) {
          logger.error({ err, address: input.address }, "Failed to fetch vault on-chain data");
          return { ...vault, balance: "0", totalDeposits: vault.totalDeposits.toString(), totalYield: vault.totalYield.toString() };
        }
      }),

    getAll: t.procedure.query(async ({ ctx }) => {
      return ctx.prisma.vault.findMany({ orderBy: { createdAt: "desc" } });
    }),

    create: protectedProcedure
      .input(
        z.object({
          riskTolerance: z.enum(["CONSERVATIVE", "MODERATE", "AGGRESSIVE"]).default("MODERATE"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return ctx.prisma.vault.create({
          data: {
            address: CONTRACTS.vault,
            userId: ctx.walletAddress!,
            riskTolerance: input.riskTolerance,
          },
        });
      }),

    activate: protectedProcedure
      .input(z.object({ vaultId: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const vault = await ctx.prisma.vault.findUnique({ where: { id: input.vaultId } });
        if (!vault) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Vault not found" });
        }
        if (vault.userId !== ctx.walletAddress) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only activate your own vault" });
        }
        return ctx.prisma.vault.update({
          where: { id: input.vaultId },
          data: { isActive: true },
        });
      }),

    getLiveData: t.procedure
      .input(z.object({ vaultAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid vault address") }))
      .query(async () => {
        try {
          return await getVaultOnChainData();
        } catch (err) {
          logger.error({ err }, "Failed to fetch live vault data");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch on-chain data" });
        }
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
        const agent = await ctx.prisma.agent.findUnique({ where: { id: input.id } });
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }
        return agent;
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.string(),
          budget: z.bigint().optional().refine((v) => v === undefined || v >= 0n, "Budget cannot be negative"),
          spent: z.bigint().optional().refine((v) => v === undefined || v >= 0n, "Spent cannot be negative"),
          active: z.boolean().optional(),
          reputation: z.number().min(0).max(100).optional(),
          lastActiveAt: z.date().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        const agent = await ctx.prisma.agent.findUnique({ where: { id }, include: { vault: true } });
        if (!agent) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agent not found" });
        }
        if (agent.vault.userId !== ctx.walletAddress) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only modify agents in your own vault" });
        }
        return ctx.prisma.agent.update({
          where: { id },
          data: { ...data, updatedAt: new Date() },
        });
      }),

    create: protectedProcedure
      .input(
        z.object({
          vaultId: z.string(),
          type: z.enum(["YIELD", "LIQUIDITY", "FX", "PAYMENT", "RISK", "COORDINATOR"]),
          walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid Ethereum wallet address"),
          budget: z.bigint().default(0n).refine((v) => v >= 0n, "Budget cannot be negative"),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const vault = await ctx.prisma.vault.findUnique({ where: { id: input.vaultId } });
        if (!vault) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Vault not found" });
        }
        if (vault.userId !== ctx.walletAddress) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only add agents to your own vault" });
        }
        return ctx.prisma.agent.create({ data: { ...input, walletAddress: input.walletAddress.toLowerCase() } });
      }),
  }),

  transaction: t.router({
    getAll: t.procedure
      .input(
        z.object({
          vaultId: z.string().optional(),
          agentId: z.string().optional(),
          type: z.enum(["DEPOSIT", "WITHDRAWAL", "NANOPAYMENT", "PAYMENT", "ALLOCATION", "YIELD_HARVEST", "REBALANCE"]).optional(),
          limit: z.number().min(1).max(200).default(50),
          offset: z.number().min(0).default(0),
        })
      )
      .query(async ({ input, ctx }) => {
        const where: TransactionWhereInput = {};
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

    create: protectedProcedure
      .input(
        z.object({
          vaultId: z.string(),
          agentId: z.string().optional(),
          fromAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid from address"),
          toAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid to address"),
          amount: z.bigint().positive(),
          type: z.enum(["DEPOSIT", "WITHDRAWAL", "NANOPAYMENT", "PAYMENT", "ALLOCATION", "YIELD_HARVEST", "REBALANCE"]),
          memo: z.string().max(500).optional(),
          txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).optional(),
          blockNumber: z.bigint().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const vault = await ctx.prisma.vault.findUnique({ where: { id: input.vaultId } });
        if (!vault) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Vault not found" });
        }
        if (vault.userId !== ctx.walletAddress) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only create transactions for your own vault" });
        }
        return ctx.prisma.transaction.create({ data: input });
      }),
  }),

  risk: t.router({
    getAlerts: t.procedure
      .input(z.object({ vaultId: z.string().optional(), resolved: z.boolean().optional() }))
      .query(async ({ input, ctx }) => {
        const where: RiskAlertWhereInput = {};
        if (input.vaultId) where.vaultId = input.vaultId;
        if (input.resolved !== undefined) where.resolved = input.resolved;

        return ctx.prisma.riskAlert.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });
      }),

    createAlert: protectedProcedure
      .input(
        z.object({
          vaultId: z.string(),
          severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
          type: z.string().max(100),
          message: z.string().max(1000),
          agentId: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const vault = await ctx.prisma.vault.findUnique({ where: { id: input.vaultId } });
        if (!vault) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Vault not found" });
        }
        if (vault.userId !== ctx.walletAddress) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only create alerts for your own vault" });
        }
        return ctx.prisma.riskAlert.create({ data: input });
      }),

    resolveAlert: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const alert = await ctx.prisma.riskAlert.findUnique({ where: { id: input.id }, include: { vault: true } });
        if (!alert) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Risk alert not found" });
        }
        if (alert.vault.userId !== ctx.walletAddress) {
          throw new TRPCError({ code: "FORBIDDEN", message: "You can only resolve alerts in your own vault" });
        }
        return ctx.prisma.riskAlert.update({
          where: { id: input.id },
          data: { resolved: true, resolvedAt: new Date() },
        });
      }),

    getLiveScore: t.procedure
      .input(z.object({ riskOracleAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Invalid oracle address") }))
      .query(async () => {
        try {
          const [healthy, riskScore] = await riskOracleContract.checkHealth();
          return { healthy, riskScore: riskScore.toString() };
        } catch (err) {
          logger.error({ err }, "Failed to fetch live risk score");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch risk score from oracle" });
        }
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

      const totalBudget = agents.reduce((sum, a) => sum + (a.budget || 0n), 0n);
      const totalSpent = agents.reduce((sum, a) => sum + (a.spent || 0n), 0n);

      let riskScore = "0";
      try {
        const score = await riskOracleContract.getRiskScore();
        riskScore = score.toString();
      } catch (err) {
        logger.error({ err }, "Failed to fetch risk score for stats");
      }

      return {
        totalAgents: agents.length,
        activeAgents: agents.filter((a) => a.active).length,
        totalBudget: totalBudget.toString(),
        totalSpent: totalSpent.toString(),
        totalTransactions: transactions,
        unresolvedAlerts: alerts,
        totalYield: vault?.totalYield?.toString() || "0",
        riskScore,
      };
    }),
});

export type AppRouter = typeof appRouter;

export { appRouter, prisma, provider };
