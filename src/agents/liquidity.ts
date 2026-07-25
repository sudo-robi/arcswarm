import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage } from "./base";

interface PaymentForecast {
  date: string;
  amount: number;
  recurring: boolean;
}

interface LiquidityState {
  currentBuffer: number;
  optimalBuffer: number;
  excessDeployed: number;
  deficitCovered: number;
}

export class LiquidityAgent extends BaseAgent {
  private state: LiquidityState = {
    currentBuffer: 0,
    optimalBuffer: 0,
    excessDeployed: 0,
    deficitCovered: 0,
  };
  private paymentForecast: PaymentForecast[] = [];
  private lastCheck = 0;
  private checkInterval = 3_600_000; // 1 hour

  async execute(): Promise<void> {
    if (Date.now() - this.lastCheck < this.checkInterval) return;

    console.log(`[${this.config.name}] Checking liquidity...`);
    this.lastCheck = Date.now();

    // 1. Query Payment Agent for 7-day forecast
    await this.sendNanopayment(
      "0xPAYMENT_AGENT",
      1000, // 0.001 USDC
      "payment-forecast-7d"
    );

    // 2. Calculate optimal buffer
    const forecast = this.estimatePayments();
    this.state.optimalBuffer = forecast * 1.2; // 20% safety margin

    // 3. Get current buffer
    this.state.currentBuffer = await this.getCurrentBuffer();

    // 4. Decision
    if (this.state.currentBuffer < this.state.optimalBuffer) {
      // Need more liquidity - pull from Yield Agent
      const deficit = this.state.optimalBuffer - this.state.currentBuffer;
      console.log(
        `[${this.config.name}] Liquidity deficit: ${deficit / 1e6} USDC. Requesting from Yield Agent...`
      );
      await this.sendNanopayment(
        "0xYIELD_AGENT",
        1000,
        "request-liquidity"
      );
      await this.broadcastMessage("request", {
        action: "pullFromYield",
        amount: deficit,
      });
      this.state.deficitCovered += deficit;
    } else if (this.state.currentBuffer > this.state.optimalBuffer * 1.5) {
      // Excess liquidity - deploy to Yield Agent
      const excess = this.state.currentBuffer - this.state.optimalBuffer * 1.2;
      console.log(
        `[${this.config.name}] Liquidity excess: ${excess / 1e6} USDC. Deploying to Yield...`
      );
      await this.sendNanopayment(
        "0xYIELD_AGENT",
        1000,
        "deploy-excess"
      );
      await this.broadcastMessage("request", {
        action: "deployToYield",
        amount: excess,
      });
      this.state.excessDeployed += excess;
    } else {
      console.log(`[${this.config.name}] Liquidity optimal. Buffer: ${this.state.currentBuffer / 1e6} USDC`);
    }

    // 5. Report to Coordinator
    await this.broadcastMessage("response", {
      action: "liquidityStatus",
      state: this.state,
    });
  }

  private estimatePayments(): number {
    // Simulate 7-day payment forecast
    // In production: query Payment Agent's scheduled payments
    return 5_000e6; // 5,000 USDC estimated
  }

  private async getCurrentBuffer(): Promise<number> {
    // In production: query vault balance allocated to this agent
    return 7_500e6; // 7,500 USDC current buffer
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "response":
        if (msg.payload.action === "paymentForecast") {
          this.paymentForecast = msg.payload.forecast;
        }
        break;
      case "alert":
        console.log(`[${this.config.name}] Alert:`, msg.payload);
        break;
    }
  }
}
