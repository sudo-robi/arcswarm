"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  ARC_TESTNET,
  CONTRACTS,
  VAULT_ABI,
  AGENT_REGISTRY_ABI,
  BUDGET_MANAGER_ABI,
  RISK_ORACLE_ABI,
  PAYMENT_ROUTER_ABI,
} from "@/lib/contracts";

interface Stats {
  totalAgents: number;
  activeAgents: number;
  totalBalance: string;
  totalDeposits: string;
  totalTransactions: number;
  riskScore: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);

        const vault = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);
        const registry = new ethers.Contract(CONTRACTS.agentRegistry, AGENT_REGISTRY_ABI, provider);
        const budgetMgr = new ethers.Contract(CONTRACTS.budgetManager, BUDGET_MANAGER_ABI, provider);
        const riskOracle = new ethers.Contract(CONTRACTS.riskOracle, RISK_ORACLE_ABI, provider);
        const paymentRouter = new ethers.Contract(CONTRACTS.paymentRouter, PAYMENT_ROUTER_ABI, provider);

        const [totalBalance, totalDeposits, agentCount, activeCount, paymentCount, riskScore] = await Promise.all([
          vault.getVaultBalance(),
          vault.totalDeposits(),
          registry.getAgentCount(),
          budgetMgr.getAgentCount(),
          paymentRouter.getPaymentCount(),
          riskOracle.getRiskScore(),
        ]);

        setStats({
          totalAgents: Number(agentCount),
          activeAgents: Number(activeCount),
          totalBalance: totalBalance.toString(),
          totalDeposits: totalDeposits.toString(),
          totalTransactions: Number(paymentCount),
          riskScore: Number(riskScore),
        });
      } catch (e) {
        console.error("Failed to fetch stats:", e);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return <div className="animate-pulse h-24 bg-muted rounded-lg" />;

  const cards = [
    {
      label: "Total Agents",
      value: stats.activeAgents.toString(),
      sub: `${stats.totalAgents} registered`,
      icon: "robot",
    },
    {
      label: "Treasury Balance",
      value: `$${(Number(stats.totalBalance) / 1e6).toLocaleString()}`,
      sub: `${((Number(stats.totalDeposits) / 1e6)).toLocaleString()} deposited`,
      icon: "wallet",
    },
    {
      label: "Transactions",
      value: stats.totalTransactions.toLocaleString(),
      sub: "On-chain payments",
      icon: "activity",
    },
    {
      label: "Risk Score",
      value: `${stats.riskScore}/100`,
      sub: stats.riskScore < 30 ? "Low risk" : stats.riskScore < 70 ? "Medium risk" : "High risk",
      icon: "shield",
      alert: stats.riskScore >= 70,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border bg-card p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{card.label}</p>
            {card.alert && (
              <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            )}
          </div>
          <p className="text-2xl font-bold">{card.value}</p>
          <p className="text-xs text-muted-foreground">{card.sub}</p>
        </div>
      ))}
    </div>
  );
}
