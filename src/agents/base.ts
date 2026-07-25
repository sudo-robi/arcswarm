import { ethers } from "ethers";

export interface AgentConfig {
  name: string;
  type: "yield" | "liquidity" | "fx" | "payment" | "risk" | "coordinator";
  wallet: ethers.Wallet;
  contracts: ContractAddresses;
  interval: number; // ms
}

export interface ContractAddresses {
  vault: string;
  budgetManager: string;
  agentRegistry: string;
  riskOracle: string;
  paymentRouter: string;
  usdc: string;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: "request" | "response" | "alert" | "budget";
  payload: any;
  nanopayment: number; // USDC amount (6 decimals)
  timestamp: number;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected provider: ethers.JsonRpcProvider;
  protected running = false;
  protected messageQueue: AgentMessage[] = [];

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    this.config = config;
    this.provider = provider;
  }

  abstract execute(): Promise<void>;
  abstract handleMessage(msg: AgentMessage): Promise<void>;

  async start() {
    this.running = true;
    console.log(`[${this.config.name}] Starting...`);
    while (this.running) {
      try {
        await this.execute();
        await this.processMessages();
      } catch (err) {
        console.error(`[${this.config.name}] Error:`, err);
      }
      await new Promise((r) => setTimeout(r, this.config.interval));
    }
  }

  stop() {
    this.running = false;
    console.log(`[${this.config.name}] Stopped`);
  }

  protected async processMessages() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      await this.handleMessage(msg);
    }
  }

  protected async sendNanopayment(
    to: string,
    amount: number,
    serviceId: string
  ): Promise<string> {
    // Nanopayment via PaymentRouter contract
    console.log(
      `[${this.config.name}] Nanopayment: ${amount} USDC to ${to} for ${serviceId}`
    );
    return `nanopayment-${Date.now()}`;
  }

  protected async broadcastMessage(
    type: AgentMessage["type"],
    payload: any,
    nanopayment: number = 1000 // 0.001 USDC default
  ) {
    const msg: AgentMessage = {
      from: this.config.wallet.address,
      to: "broadcast",
      type,
      payload,
      nanopayment,
      timestamp: Date.now(),
    };
    console.log(
      `[${this.config.name}] Broadcasting:`,
      type,
      JSON.stringify(payload).slice(0, 100)
    );
    return msg;
  }

  receiveMessage(msg: AgentMessage) {
    this.messageQueue.push(msg);
  }
}
