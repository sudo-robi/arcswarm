import { initTRPC } from "@trpc/server";
import { z } from "zod";
import express from "express";
import cors from "cors";
import { ethers } from "ethers";

const t = initTRPC.create();

const app = express();
app.use(cors());
app.use(express.json());

// Arc Testnet provider
const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");

// Contract ABIs (simplified)
const VAULT_ABI = [
  "function deposit(uint256 amount) external",
  "function withdraw(uint256 amount) external",
  "function getVaultBalance() external view returns (uint256)",
  "function userDeposits(address) external view returns (uint256)",
  "function totalDeposits() external view returns (uint256)",
  "function totalYield() external view returns (uint256)",
];

const ROUTER_ABI = [
  "function executePayment(address to, uint256 amount, string memo) external returns (uint256)",
  "function executeNanopayment(address payee, uint256 amount, string serviceId) external returns (uint256)",
  "function getPaymentCount() external view returns (uint256)",
  "function getNanopaymentCount() external view returns (uint256)",
];

// In-memory store (replace with PostgreSQL in production)
const store = {
  vaults: new Map<string, any>(),
  agents: new Map<string, any>(),
  transactions: [] as any[],
  riskAlerts: [] as any[],
};

// tRPC router
const appRouter = t.router({
  // Vault operations
  getVault: t.procedure
    .input(z.object({ address: z.string() }))
    .query(async ({ input }) => {
      const vault = store.vaults.get(input.address);
      if (!vault) return null;

      const contract = new ethers.Contract(input.address, VAULT_ABI, provider);
      const balance = await contract.getVaultBalance();
      const totalDeposits = await contract.totalDeposits();
      const totalYield = await contract.totalYield();

      return {
        ...vault,
        balance: balance.toString(),
        totalDeposits: totalDeposits.toString(),
        totalYield: totalYield.toString(),
      };
    }),

  getVaults: t.procedure.query(() => {
    return Array.from(store.vaults.values());
  }),

  createVault: t.procedure
    .input(
      z.object({
        address: z.string(),
        userId: z.string(),
        riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
      })
    )
    .mutation(({ input }) => {
      const vault = {
        id: crypto.randomUUID(),
        ...input,
        totalDeposits: "0",
        totalYield: "0",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      store.vaults.set(input.address, vault);
      return vault;
    }),

  // Agent operations
  getAgents: t.procedure.query(() => {
    return Array.from(store.agents.values());
  }),

  getAgent: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return store.agents.get(input.id) || null;
    }),

  updateAgent: t.procedure
    .input(
      z.object({
        id: z.string(),
        budget: z.string().optional(),
        spent: z.string().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input }) => {
      const agent = store.agents.get(input.id);
      if (!agent) throw new Error("Agent not found");

      Object.assign(agent, input, { updatedAt: new Date() });
      return agent;
    }),

  // Transaction operations
  getTransactions: t.procedure
    .input(
      z.object({
        limit: z.number().optional().default(50),
        offset: z.number().optional().default(0),
        agentId: z.string().optional(),
      })
    )
    .query(({ input }) => {
      let txs = store.transactions;
      if (input.agentId) {
        txs = txs.filter((t) => t.agentId === input.agentId);
      }
      return txs
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(input.offset, input.offset + input.limit);
    }),

  createTransaction: t.procedure
    .input(
      z.object({
        from: z.string(),
        to: z.string(),
        amount: z.string(),
        type: z.enum(["deposit", "withdrawal", "nanopayment", "payment", "allocation"]),
        agentId: z.string().optional(),
        memo: z.string().optional(),
        txHash: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const tx = {
        id: crypto.randomUUID(),
        ...input,
        createdAt: new Date(),
      };
      store.transactions.push(tx);
      return tx;
    }),

  // Risk operations
  getRiskAlerts: t.procedure
    .input(z.object({ resolved: z.boolean().optional() }))
    .query(({ input }) => {
      let alerts = store.riskAlerts;
      if (input.resolved !== undefined) {
        alerts = alerts.filter((a) => a.resolved === input.resolved);
      }
      return alerts.sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
      );
    }),

  createRiskAlert: t.procedure
    .input(
      z.object({
        severity: z.enum(["low", "medium", "high", "critical"]),
        type: z.string(),
        message: z.string(),
        agentId: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const alert = {
        id: crypto.randomUUID(),
        ...input,
        resolved: false,
        createdAt: new Date(),
      };
      store.riskAlerts.push(alert);
      return alert;
    }),

  resolveAlert: t.procedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      const alert = store.riskAlerts.find((a) => a.id === input.id);
      if (!alert) throw new Error("Alert not found");
      alert.resolved = true;
      return alert;
    }),

  // Stats
  getStats: t.procedure.query(() => {
    const agents = Array.from(store.agents.values());
    const totalBudget = agents.reduce(
      (sum, a) => sum + BigInt(a.budget || "0"),
      BigInt(0)
    );
    const totalSpent = agents.reduce(
      (sum, a) => sum + BigInt(a.spent || "0"),
      BigInt(0)
    );

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter((a) => a.active).length,
      totalBudget: totalBudget.toString(),
      totalSpent: totalSpent.toString(),
      totalTransactions: store.transactions.length,
      unresolvedAlerts: store.riskAlerts.filter((a) => !a.resolved).length,
    };
  }),
});

export type AppRouter = typeof appRouter;

// Express routes
app.use("/trpc", (req, res) => {
  // Simple tRPC over HTTP handler
  const { path, input } = req.body;
  res.json({ message: "tRPC endpoint", path });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/stats", (_req, res) => {
  const agents = Array.from(store.agents.values());
  res.json({
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.active).length,
    totalTransactions: store.transactions.length,
    unresolvedAlerts: store.riskAlerts.filter((a) => !a.resolved).length,
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ArcSwarm API running on port ${PORT}`);
});
