import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage, AGENT_CONSTANTS } from "./base.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

const YIELD_CONSTANTS = {
  TOTAL_BUDGET: 15_000e6,
  SCAN_INTERVAL: 300_000,
  REBALANCE_DRIFT_THRESHOLD: 0.05,
} as const;

interface YieldSource {
  name: string;
  apy: number;
  tvl: number;
  riskScore: number;
  address: string;
  riskAdjustedReturn?: number;
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
  private scanInterval = YIELD_CONSTANTS.SCAN_INTERVAL;

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    super(config, provider);
    this.yieldSources = [
      { name: "Arc AAVE", apy: 4.2, tvl: 5_000_000, riskScore: 15, address: "0xAAVE" },
      { name: "Arc Compound", apy: 3.8, tvl: 8_000_000, riskScore: 10, address: "0xCOMP" },
      { name: "Arc Curve", apy: 5.1, tvl: 2_000_000, riskScore: 25, address: "0xCURVE" },
    ];
  }

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    logger.info({ agent: this.config.name }, "Scanning yield sources...");
    this.lastScan = Date.now();

    const scored = this.scoreYieldSources();
    const optimal = this.calculateOptimalAllocation(scored);
    const shouldRebalance = this.shouldRebalance(optimal);

    if (shouldRebalance) {
      logger.info({ agent: this.config.name }, "Rebalancing allocations...");
      await this.rebalance(optimal);

      await this.sendNanopayment("0xRISK_AGENT", AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, "validate-yield-sources");

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
        riskAdjustedReturn: source.apy * (1 - source.riskScore / 100),
      }))
      .sort((a, b) => b.riskAdjustedReturn - a.riskAdjustedReturn);
  }

  private calculateOptimalAllocation(scored: YieldSource[]): YieldAllocation[] {
    const totalBudget = YIELD_CONSTANTS.TOTAL_BUDGET;
    const allocations: YieldAllocation[] = [];

    let remaining = totalBudget;
    for (const source of scored) {
      if (remaining <= 0) break;
      const weight = (100 - source.riskScore) / 100;
      const amount = Math.min(remaining, totalBudget * weight);
      allocations.push({
        source: source.name,
        amount,
        apy: source.apy,
        riskAdjustedReturn: source.riskAdjustedReturn ?? 0,
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
      // Avoid division by zero: if opt.amount is 0, treat any difference as significant
      if (opt.amount === 0) return true;
      if (Math.abs(current.amount - opt.amount) / opt.amount > YIELD_CONSTANTS.REBALANCE_DRIFT_THRESHOLD) return true;
    }
    return false;
  }

  private async rebalance(allocations: YieldAllocation[]): Promise<void> {
    for (const alloc of allocations) {
      logger.info(
        { agent: this.config.name, source: alloc.source, amount: alloc.amount / 1e6, apy: alloc.apy },
        "Allocating to yield source via Circle App Kits"
      );
      // Circle App Kits integration for real USDC yield allocation:
      // await appKit.swap({
      //   fromToken: "USDC",
      //   toToken: alloc.source,
      //   amount: alloc.amount.toString(),
      //   walletAddress: this.config.wallet.address,
      // });
    }
    this.currentAllocations = allocations;
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "request":
        if (msg.payload.action === "getAllocations") {
          await this.sendNanopayment(msg.from, AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, "allocation-data");
          await this.broadcastMessage("response", { allocations: this.currentAllocations });
        }
        break;
      case "alert":
        logger.warn({ agent: this.config.name, payload: msg.payload }, "Alert received");
        break;
    }
  }
}