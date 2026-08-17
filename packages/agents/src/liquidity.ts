import { BaseAgent, AgentConfig, AgentMessage, AGENT_CONSTANTS } from "./base.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

const LIQUIDITY_CONSTANTS = {
  SCAN_INTERVAL: 3_600_000,
  BUFFER_MULTIPLIER: 1.2,
  EXCESS_THRESHOLD: 1.5,
  VAULT_USDC_PORTION: 0.15,
} as const;

export class LiquidityAgent extends BaseAgent {
  private lastScan = 0;
  private scanInterval = LIQUIDITY_CONSTANTS.SCAN_INTERVAL;

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    logger.info({ agent: this.config.name }, "Managing liquidity buffer...");
    this.lastScan = Date.now();

    const forecastUSDC = (await this.getPaymentForecast()) / 1e6;
    const optimalBuffer = Math.round(forecastUSDC * LIQUIDITY_CONSTANTS.BUFFER_MULTIPLIER);
    const currentBuffer = Number(await this.getVaultBalance()) / 1e6 * LIQUIDITY_CONSTANTS.VAULT_USDC_PORTION;

    if (currentBuffer < optimalBuffer) {
      logger.info({ agent: this.config.name, needed: optimalBuffer - currentBuffer }, "Buffer low, requesting from Yield");
      await this.sendNanopayment("0xYIELD_AGENT", AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, `need-liquidity-${optimalBuffer - currentBuffer}`);
    } else if (currentBuffer > optimalBuffer * LIQUIDITY_CONSTANTS.EXCESS_THRESHOLD) {
      logger.info({ agent: this.config.name, excess: currentBuffer - optimalBuffer }, "Excess buffer, deploying to Yield");
      await this.sendNanopayment("0xYIELD_AGENT", AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, `deploy-excess-${currentBuffer - optimalBuffer}`);
    }

    await this.sendNanopayment("0xCOORDINATOR", AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, "budget-confirmation");
  }

  private async getPaymentForecast(): Promise<number> {
    // Query Payment Agent for 7-day forecast
    // In production: call payment agent via message
    return 5_000e6; // 5,000 USDC forecast
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    if (msg.type === "request" && msg.payload.action === "getForecast") {
      const forecast = await this.getPaymentForecast();
      await this.sendNanopayment(msg.from, AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, "forecast-data");
      await this.broadcastMessage("response", { action: "paymentForecast", forecast });
    }
  }
}