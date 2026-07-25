import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage, ContractAddresses } from "./base";

interface YieldSource {
  name: string;
  apy: number;
  tvl: number;
  riskScore: number;
  address: string;
}

interface YieldAllocation {
  source: string;
  amount: number;
  apy: number;
  riskAdjustedReturn: number;
}

export class YieldAgent extends BaseAgent {
  private yieldSources: YieldSource[] = [];
  private currentAllocations: YieldAllocation[] = [];
  private lastScan = 0;
  private scanInterval = 300_000; // 5 minutes

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    super(config, provider);
    this.yieldSources = [
      { name: "Arc AAVE", apy: 4.2, tvl: 5_000_000, riskScore: 15, address: "0xAAAA" },
      { name: "Arc Compound", apy: 3.8, tvl: 8_000_000, riskScore: 10, address: "0xBBBB" },
      { name: "Arc Curve", apy: 5.1, tvl: 2_000_000, riskScore: 25, address: "0xCCCC" },
    ];
  }

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    console.log(`[${this.config.name}] Scanning yield sources...`);
    this.lastScan = Date.now();

    // 1. Scan and score yield sources
    const scored = this.scoreYieldSources();

    // 2. Calculate optimal allocation
    const optimal = this.calculateOptimalAllocation(scored);

    // 3. Compare with current and rebalance if needed
    const shouldRebalance = this.shouldRebalance(optimal);

    if (shouldRebalance) {
      console.log(`[${this.config.name}] Rebalancing allocations...`);
      await this.rebalance(optimal);

      // 4. Ask Risk Agent to validate
      await this.sendNanopayment(
        "0xRISK_AGENT",
        1000, // 0.001 USDC
        "validate-yield-sources"
      );

      // 5. Report to Coordinator
      await this.broadcastMessage("response", {
        action: "rebalance_complete",
        allocations: optimal,
        totalDeployed: optimal.reduce((sum, a) => sum + a.amount, 0),
      });
    }
  }

  private scoreYieldSources(): YieldSource[] {
    return this.yieldSources
      .map((source) => ({
        ...source,
        // Risk-adjusted APY: penalize high risk
        riskAdjustedReturn: source.apy * (1 - source.riskScore / 100),
      }))
      .sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);
  }

  private calculateOptimalAllocation(scored: YieldSource[]): YieldAllocation[] {
    // Simple mean-variance allocation
    const totalBudget = 15_000e6; // 15,000 USDC from budget
    const allocations: YieldAllocation[] = [];

    let remaining = totalBudget;
    for (const source of scored) {
      if (remaining <= 0) break;
      // Allocate inversely proportional to risk
      const weight = (100 - source.riskScore) / 100;
      const amount = Math.min(remaining, totalBudget * weight);
      allocations.push({
        source: source.name,
        amount,
        apy: source.apy,
        riskAdjustedReturn: source.riskAdjustedReturn,
      });
      remaining -= amount;
    }

    return allocations;
  }

  private shouldRebalance(optimal: YieldAllocation[]): boolean {
    if (this.currentAllocations.length === 0) return true;

    for (const opt of optimal) {
      const current = this.currentAllocations.find((a) => a.source === opt.source);
      if (!current) return true;
      // Rebalance if allocation differs by more than 5%
      if (Math.abs(current.amount - opt.amount) / opt.amount > 0.05) return true;
    }

    return false;
  }

  private async rebalance(allocations: YieldAllocation[]): Promise<void> {
    for (const alloc of allocations) {
      console.log(
        `[${this.config.name}] Allocating ${alloc.amount / 1e6} USDC to ${alloc.source} (${alloc.apy}% APY)`
      );
      // In production: call App Kits Swap to move USDC into yield source
    }
    this.currentAllocations = allocations;
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "request":
        if (msg.payload.action === "getAllocations") {
          await this.sendNanopayment(msg.from, 1000, "allocation-data");
          await this.broadcastMessage("response", {
            allocations: this.currentAllocations,
          });
        }
        break;
      case "alert":
        console.log(`[${this.config.name}] Alert received:`, msg.payload);
        break;
    }
  }
}
