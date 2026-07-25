"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  ARC_TESTNET,
  CONTRACTS,
  AGENT_REGISTRY_ABI,
  BUDGET_MANAGER_ABI,
  PAYMENT_ROUTER_ABI,
  AGENT_TYPES,
} from "@/lib/contracts";

interface Agent {
  address: string;
  name: string;
  type: string;
  budget: number;
  spent: number;
  active: boolean;
  reputation: number;
  lastActiveAt: number;
}

const AGENT_COLORS: Record<string, { color: string }> = {
  yield: { color: "bg-emerald-500" },
  liquidity: { color: "bg-blue-500" },
  fx: { color: "bg-purple-500" },
  payment: { color: "bg-amber-500" },
  risk: { color: "bg-red-500" },
  coordinator: { color: "bg-cyan-500" },
};

export function AgentGrid() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
        const registry = new ethers.Contract(CONTRACTS.agentRegistry, AGENT_REGISTRY_ABI, provider);
        const budgetMgr = new ethers.Contract(CONTRACTS.budgetManager, BUDGET_MANAGER_ABI, provider);
        const paymentRouter = new ethers.Contract(CONTRACTS.paymentRouter, PAYMENT_ROUTER_ABI, provider);

        const agentAddresses: string[] = await registry.getAllAgents();
        const fetched: Agent[] = [];

        for (const addr of agentAddresses) {
          const [info, budget, spent] = await Promise.all([
            registry.getAgentInfo(addr),
            budgetMgr.getBudget(addr),
            budgetMgr.getSpent(addr),
          ]);

          const typeConfig = AGENT_TYPES[Number(info.agentType)] || AGENT_TYPES[5];

          fetched.push({
            address: addr,
            name: info.name || typeConfig.name,
            type: typeConfig.type,
            budget: Number(budget),
            spent: Number(spent),
            active: info.active,
            reputation: Number(info.reputationScore),
            lastActiveAt: Number(info.lastActiveAt),
          });
        }

        setAgents(fetched);
      } catch (e) {
        console.error("Failed to fetch agents:", e);
      }
    };

    fetchAgents();
    const interval = setInterval(fetchAgents, 15000);
    return () => clearInterval(interval);
  }, []);

  if (agents.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-4">Agent Swarm</h2>
        <div className="animate-pulse h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold mb-4">Agent Swarm</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {agents.map((agent) => {
          const config = AGENT_COLORS[agent.type] || AGENT_COLORS.coordinator;
          const utilization =
            agent.budget > 0 ? (agent.spent / agent.budget) * 100 : 0;
          const timeSince = Math.floor((Date.now() / 1000) - agent.lastActiveAt);
          const lastActivity =
            timeSince < 60 ? `${timeSince}s ago` :
            timeSince < 3600 ? `${Math.floor(timeSince / 60)}m ago` :
            `${Math.floor(timeSince / 3600)}h ago`;

          return (
            <div
              key={agent.address}
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
                {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
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
                <span>{lastActivity}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
