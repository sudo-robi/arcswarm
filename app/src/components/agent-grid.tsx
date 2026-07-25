"use client";

import { useEffect, useState } from "react";

interface Agent {
  name: string;
  type: string;
  wallet: string;
  budget: number;
  spent: number;
  active: boolean;
  reputation: number;
  lastActivity: string;
}

const AGENT_TYPES: Record<string, { color: string; icon: string }> = {
  yield: { color: "bg-emerald-500", icon: "TrendingUp" },
  liquidity: { color: "bg-blue-500", icon: "Droplets" },
  fx: { color: "bg-purple-500", icon: "ArrowLeftRight" },
  payment: { color: "bg-amber-500", icon: "CreditCard" },
  risk: { color: "bg-red-500", icon: "Shield" },
  coordinator: { color: "bg-cyan-500", icon: "Network" },
};

export function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    // In production: fetch from API
    setAgents([
      {
        name: "Yield Agent",
        type: "yield",
        wallet: "0x1234...5678",
        budget: 30_000e6,
        spent: 12_500e6,
        active: true,
        reputation: 72,
        lastActivity: "2 min ago",
      },
      {
        name: "Liquidity Agent",
        type: "liquidity",
        wallet: "0x2345...6789",
        budget: 15_000e6,
        spent: 8_200e6,
        active: true,
        reputation: 68,
        lastActivity: "5 min ago",
      },
      {
        name: "FX Agent",
        type: "fx",
        wallet: "0x3456...7890",
        budget: 20_000e6,
        spent: 5_300e6,
        active: true,
        reputation: 65,
        lastActivity: "8 min ago",
      },
      {
        name: "Payment Agent",
        type: "payment",
        wallet: "0x4567...8901",
        budget: 25_000e6,
        spent: 18_750e6,
        active: true,
        reputation: 80,
        lastActivity: "1 min ago",
      },
      {
        name: "Risk Agent",
        type: "risk",
        wallet: "0x5678...9012",
        budget: 10_000e6,
        spent: 2_100e6,
        active: true,
        reputation: 85,
        lastActivity: "30 sec ago",
      },
      {
        name: "Coordinator",
        type: "coordinator",
        wallet: "0x6789...0123",
        budget: 0,
        spent: 0,
        active: true,
        reputation: 90,
        lastActivity: "10 sec ago",
      },
    ]);
  }, []);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold mb-4">Agent Swarm</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const config = AGENT_TYPES[agent.type] || AGENT_TYPES.coordinator;
          const utilization =
            agent.budget > 0 ? (agent.spent / agent.budget) * 100 : 0;

          return (
            <div
              key={agent.type}
              className="rounded-lg border bg-background p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${config.color} ${
                      agent.active ? "animate-pulse" : "opacity-50"
                    }`}
                  />
                  <span className="font-medium">{agent.name}</span>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    agent.active
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {agent.active ? "Active" : "Idle"}
                </span>
              </div>

              <div className="text-xs text-muted-foreground font-mono">
                {agent.wallet}
              </div>

              {agent.budget > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>Budget: ${(agent.budget / 1e6).toLocaleString()}</span>
                    <span>Spent: ${(agent.spent / 1e6).toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${utilization}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Reputation: {agent.reputation}/100</span>
                <span>{agent.lastActivity}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
