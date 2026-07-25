import { z } from "zod";

export const VaultSchema = z.object({
  id: z.string().uuid(),
  address: z.string(),
  userId: z.string(),
  totalDeposits: z.string(),
  totalYield: z.string(),
  riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(["yield", "liquidity", "fx", "payment", "risk", "coordinator"]),
  walletAddress: z.string(),
  budget: z.string(),
  spent: z.string(),
  reputationScore: z.number(),
  active: z.boolean(),
  lastActivity: z.date(),
  createdAt: z.date(),
});

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  from: z.string(),
  to: z.string(),
  amount: z.string(),
  type: z.enum(["deposit", "withdrawal", "nanopayment", "payment", "allocation"]),
  agentId: z.string().uuid().optional(),
  memo: z.string().optional(),
  txHash: z.string().optional(),
  createdAt: z.date(),
});

export const RiskAlertSchema = z.object({
  id: z.string().uuid(),
  severity: z.enum(["low", "medium", "high", "critical"]),
  type: z.string(),
  message: z.string(),
  agentId: z.string().uuid().optional(),
  resolved: z.boolean(),
  createdAt: z.date(),
});

export type Vault = z.infer<typeof VaultSchema>;
export type Agent = z.infer<typeof AgentSchema>;
export type Transaction = z.infer<typeof TransactionSchema>;
export type RiskAlert = z.infer<typeof RiskAlertSchema>;
