import { BaseAgent, AgentConfig, AgentMessage, AGENT_CONSTANTS } from "./base.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import { ethers } from "ethers";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

const FX_CONSTANTS = {
  SCAN_INTERVAL: 600_000,
  SPREAD_THRESHOLD: 0.001,
} as const;

interface FXRate {
  pair: string;
  rate: number;
  spread: number;
  timestamp: number;
}

export class FXAgent extends BaseAgent {
  private rates: Map<string, FXRate> = new Map();
  private lastScan = 0;
  private scanInterval = FX_CONSTANTS.SCAN_INTERVAL;

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    logger.info({ agent: this.config.name }, "Scanning FX rates...");
    this.lastScan = Date.now();

    const eurcRate = await this.fetchEURCRate();
    const spread = Math.abs(eurcRate - 1.0);

    if (spread > FX_CONSTANTS.SPREAD_THRESHOLD) {
      logger.info({ agent: this.config.name, spread, rate: eurcRate }, "Arbitrage opportunity detected");
      
      await this.sendNanopayment("0xRISK_AGENT", AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, `fx-risk-check-eurc`);
      
      // Execute swap via Circle App Kits
      // In production: use @circle-fin/app-kit SwapKit for real EURC/USDC swaps
      logger.info({ agent: this.config.name }, "FX swap queued via Circle App Kits");
    }

    await this.broadcastMessage("response", { action: "fxScan", rates: Object.fromEntries(this.rates) });
  }

  private async fetchEURCRate(): Promise<number> {
    // Query on-chain EURC/USDC rate via Circle App Kits
    // For demo: simulate with realistic variance
    const baseRate = 1.0 + (Math.random() - 0.5) * 0.002;
    const rate: FXRate = {
      pair: "EURC/USDC",
      rate: baseRate,
      spread: Math.abs(baseRate - 1.0),
      timestamp: Date.now(),
    };
    this.rates.set("EURC/USDC", rate);
    return baseRate;
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    if (msg.type === "request" && msg.payload.action === "getRates") {
      await this.sendNanopayment(msg.from, AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, "fx-rates");
      await this.broadcastMessage("response", { rates: Object.fromEntries(this.rates) });
    }
  }
}
