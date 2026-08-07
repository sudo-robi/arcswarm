import { BaseAgent, AgentConfig, AgentMessage } from "./base.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

export class LiquidityAgent extends BaseAgent {
  private lastScan = 0;
  private scanInterval = 3_600_000; // 1 hour

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    logger.info({ agent: this.config.name }, "Managing liquidity buffer...");
    this.lastScan = Date.now();

    const forecastUSDC = (await this.getPaymentForecast()) / 1e6; // Convert from base units to USDC
    const optimalBuffer = Math.round(forecastUSDC * 1.2); // USDC
    const currentBuffer = Number(await this.getVaultBalance()) / 1e6 * 0.15; // 15% of vault in USDC

    if (currentBuffer < optimalBuffer) {
      logger.info({ agent: this.config.name, needed: optimalBuffer - currentBuffer }, "Buffer low, requesting from Yield");
      await this.sendNanopayment("0xYIELD_AGENT", 1000, `need-liquidity-${optimalBuffer - currentBuffer}`);
    } else if (currentBuffer > optimalBuffer * 1.5) {
      logger.info({ agent: this.config.name, excess: currentBuffer - optimalBuffer }, "Excess buffer, deploying to Yield");
      await this.sendNanopayment("0xYIELD_AGENT", 1000, `deploy-excess-${currentBuffer - optimalBuffer}`);
    }

    await this.sendNanopayment("0xCOORDINATOR", 1000, "budget-confirmation");
  }

  private async getPaymentForecast(): Promise<number> {
    // Query Payment Agent for 7-day forecast
    // In production: call payment agent via message
    return 5_000e6; // 5,000 USDC forecast
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    if (msg.type === "request" && msg.payload.action === "getForecast") {
      const forecast = await this.getPaymentForecast();
      await this.sendNanopayment(msg.from, 1000, "forecast-data");
      await this.broadcastMessage("response", { action: "paymentForecast", forecast });
    }
  }
}