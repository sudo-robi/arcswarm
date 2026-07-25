import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage } from "./base";

interface FXPair {
  base: string;
  quote: string;
  rate: number;
  spread: number;
  lastUpdate: number;
}

interface FXOpportunity {
  pair: string;
  direction: "buy" | "sell";
  expectedProfit: number;
  riskScore: number;
  timestamp: number;
}

export class FXAgent extends BaseAgent {
  private pairs: FXPair[] = [
    { base: "USDC", quote: "EURC", rate: 0.92, spread: 0.001, lastUpdate: 0 },
    { base: "USDC", quote: "USDT", rate: 1.0001, spread: 0.0005, lastUpdate: 0 },
  ];
  private minSpread = 0.001; // 0.1% minimum for execution
  private lastScan = 0;
  private scanInterval = 600_000; // 10 minutes
  private totalProfit = 0;

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    console.log(`[${this.config.name}] Scanning FX rates...`);
    this.lastScan = Date.now();

    // 1. Fetch current rates
    await this.fetchRates();

    // 2. Find arbitrage opportunities
    const opportunities = this.findOpportunities();

    // 3. Execute profitable trades
    for (const opp of opportunities) {
      if (opp.expectedProfit > 10e6) { // Minimum 10 USDC profit
        console.log(
          `[${this.config.name}] Executing FX: ${opp.direction} ${opp.pair} (profit: ${opp.expectedProfit / 1e6} USDC)`
        );

        // Ask Risk Agent to check before execution
        await this.sendNanopayment(
          "0xRISK_AGENT",
          1000,
          `fx-risk-check-${opp.pair}`
        );

        // Execute via App Kits Swap
        await this.executeSwap(opp);
        this.totalProfit += opp.expectedProfit;
      }
    }

    // 4. Report
    await this.broadcastMessage("response", {
      action: "fxReport",
      totalProfit: this.totalProfit,
      opportunitiesFound: opportunities.length,
      executed: opportunities.filter((o) => o.expectedProfit > 10e6).length,
    });
  }

  private async fetchRates(): Promise<void> {
    // In production: fetch from Arc oracles or DEX pools
    for (const pair of this.pairs) {
      // Simulate rate fluctuation
      pair.rate += (Math.random() - 0.5) * 0.002;
      pair.spread = Math.abs(pair.rate - 1) * 0.001;
      pair.lastUpdate = Date.now();
    }
  }

  private findOpportunities(): FXOpportunity[] {
    const opportunities: FXOpportunity[] = [];

    for (const pair of this.pairs) {
      // Check if spread exceeds threshold
      if (pair.spread > this.minSpread) {
        const direction = pair.rate > 1 ? "sell" : "buy";
        const expectedProfit = Math.abs(pair.rate - 1) * 10_000e6; // On 10k USDC

        opportunities.push({
          pair: `${pair.base}/${pair.quote}`,
          direction,
          expectedProfit,
          riskScore: Math.min(pair.spread * 1000, 50),
          timestamp: Date.now(),
        });
      }
    }

    return opportunities.sort((a, b) => b.expectedProfit - a.expectedProfit);
  }

  private async executeSwap(opp: FXOpportunity): Promise<void> {
    // In production: call App Kits Swap
    console.log(
      `[${this.config.name}] Swap executed: ${opp.direction} ${opp.pair}`
    );
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "request":
        if (msg.payload.action === "getRates") {
          await this.sendNanopayment(msg.from, 1000, "fx-rates");
          await this.broadcastMessage("response", {
            pairs: this.pairs,
          });
        }
        break;
      case "alert":
        console.log(`[${this.config.name}] Alert:`, msg.payload);
        break;
    }
  }
}
