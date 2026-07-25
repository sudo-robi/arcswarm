"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalAgents: number;
  activeAgents: number;
  totalBudget: string;
  totalSpent: string;
  totalTransactions: number;
  unresolvedAlerts: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    // In production: fetch from API
    setStats({
      totalAgents: 6,
      activeAgents: 6,
      totalBudget: "100000000000", // 100,000 USDC
      totalSpent: "23456789012", // 23,456 USDC
      totalTransactions: 847,
      unresolvedAlerts: 0,
    });
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
      value: `$${(Number(stats.totalBudget) / 1e6).toLocaleString()}`,
      sub: `${((Number(stats.totalSpent) / Number(stats.totalBudget)) * 100).toFixed(1)}% deployed`,
      icon: "wallet",
    },
    {
      label: "Transactions",
      value: stats.totalTransactions.toLocaleString(),
      sub: "Last 24h",
      icon: "activity",
    },
    {
      label: "Risk Alerts",
      value: stats.unresolvedAlerts.toString(),
      sub: stats.unresolvedAlerts === 0 ? "All clear" : "Needs attention",
      icon: "shield",
      alert: stats.unresolvedAlerts > 0,
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
