import { ethers } from "ethers";
import {
  CONTRACTS,
  VAULT_ABI,
  AGENT_REGISTRY_ABI,
  BUDGET_MANAGER_ABI,
  RISK_ORACLE_ABI,
  PAYMENT_ROUTER_ABI,
} from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

export interface AgentConfig {
  name: string;
  type: "yield" | "liquidity" | "fx" | "payment" | "risk" | "coordinator";
  wallet: ethers.Wallet;
  contracts: typeof CONTRACTS;
  interval: number;
}

export interface AgentMessage {
  from: string;
  to: string;
  type: "request" | "response" | "alert" | "budget";
  payload: any;
  nanopayment: number;
  timestamp: number;
  idempotencyKey?: string;
}

export interface DeadLetterEntry {
  message: AgentMessage;
  attempts: number;
  lastAttempt: number;
  error: string;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  protected provider: ethers.JsonRpcProvider;
  protected running = false;
  protected shuttingDown = false;
  protected messageQueue: AgentMessage[] = [];
  protected deadLetterQueue: DeadLetterEntry[] = [];
  protected agentStatuses: Map<string, { wallet: string; healthy: boolean; lastSeen: number }> = new Map();
  protected idempotencyKeys: Set<string> = new Set();
  protected maxRetryAttempts = 3;
  protected retryDelay = 5000;

  protected vault: ethers.Contract;
  protected budgetManager: ethers.Contract;
  protected agentRegistry: ethers.Contract;
  protected riskOracle: ethers.Contract;
  protected paymentRouter: ethers.Contract;

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    this.config = config;
    this.provider = provider;

    const signer = config.wallet.connect(provider);
    this.vault = new ethers.Contract(config.contracts.vault, VAULT_ABI, signer);
    this.budgetManager = new ethers.Contract(config.contracts.budgetManager, BUDGET_MANAGER_ABI, signer);
    this.agentRegistry = new ethers.Contract(config.contracts.agentRegistry, AGENT_REGISTRY_ABI, signer);
    this.riskOracle = new ethers.Contract(config.contracts.riskOracle, RISK_ORACLE_ABI, signer);
    this.paymentRouter = new ethers.Contract(config.contracts.paymentRouter, PAYMENT_ROUTER_ABI, signer);
  }

  abstract execute(): Promise<void>;
  abstract handleMessage(msg: AgentMessage): Promise<void>;

  async start() {
    this.running = true;
    this.shuttingDown = false;
    logger.info({ agent: this.config.name, address: this.config.wallet.address }, "Starting agent");
    
    while (this.running) {
      try {
        if (!this.shuttingDown) {
          await this.execute();
          await this.processMessages();
          await this.processDeadLetterQueue();
        }
      } catch (err) {
        logger.error({ agent: this.config.name, err }, "Agent error");
      }
      await new Promise((r) => setTimeout(r, this.config.interval));
    }
    
    logger.info({ agent: this.config.name }, "Agent stopped");
  }

  async stop() {
    this.shuttingDown = true;
    
    logger.info({ agent: this.config.name, queueLength: this.messageQueue.length }, "Graceful shutdown: draining message queue");
    
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift();
      if (msg) {
        try {
          await this.handleMessage(msg);
        } catch (err) {
          logger.error({ agent: this.config.name, err }, "Error processing message during shutdown");
          this.deadLetterQueue.push({
            message: msg,
            attempts: 1,
            lastAttempt: Date.now(),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    
    logger.info({ agent: this.config.name, deadLetterCount: this.deadLetterQueue.length }, "Message queue drained");
    
    this.running = false;
    logger.info({ agent: this.config.name }, "Agent stopped");
  }

  protected async processDeadLetterQueue() {
    if (this.deadLetterQueue.length === 0) return;
    
    const now = Date.now();
    const entriesToRetry: DeadLetterEntry[] = [];
    const entriesToDiscard: DeadLetterEntry[] = [];
    
    for (const entry of this.deadLetterQueue) {
      if (entry.attempts >= this.maxRetryAttempts) {
        entriesToDiscard.push(entry);
      } else if (now - entry.lastAttempt >= this.retryDelay) {
        entriesToRetry.push(entry);
      }
    }
    
    for (const entry of entriesToDiscard) {
      logger.warn({
        agent: this.config.name,
        message: entry.message,
        error: entry.error,
        attempts: entry.attempts,
      }, "Discarding message after max retry attempts");
      this.deadLetterQueue = this.deadLetterQueue.filter((e) => e !== entry);
    }
    
    for (const entry of entriesToRetry) {
      logger.info({
        agent: this.config.name,
        message: entry.message,
        attempt: entry.attempts + 1,
      }, "Retrying message from dead letter queue");
      
      try {
        await this.handleMessage(entry.message);
        this.deadLetterQueue = this.deadLetterQueue.filter((e) => e !== entry);
      } catch (err) {
        entry.attempts++;
        entry.lastAttempt = now;
        entry.error = err instanceof Error ? err.message : String(err);
        logger.error({ agent: this.config.name, err }, "Retry failed");
      }
    }
  }

  receiveMessage(msg: AgentMessage) {
    const idempotencyKey = msg.idempotencyKey || `${msg.from}-${msg.to}-${msg.type}-${msg.timestamp}`;
    
    if (this.idempotencyKeys.has(idempotencyKey)) {
      logger.warn({ agent: this.config.name, idempotencyKey }, "Duplicate message detected, ignoring");
      return;
    }
    
    this.idempotencyKeys.add(idempotencyKey);
    
    if (this.idempotencyKeys.size > 1000) {
      const keysArray = Array.from(this.idempotencyKeys);
      this.idempotencyKeys = new Set(keysArray.slice(-500));
    }
    
    if (this.shuttingDown) {
      this.messageQueue.push(msg);
    } else {
      this.messageQueue.push(msg);
    }
  }

  protected async processMessages() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      try {
        await this.handleMessage(msg);
      } catch (err) {
        logger.error({ agent: this.config.name, err, msg }, "Message processing failed");
        this.deadLetterQueue.push({
          message: msg,
          attempts: 1,
          lastAttempt: Date.now(),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  protected async sendNanopayment(
    to: string,
    amount: number,
    serviceId: string,
    idempotencyKey?: string
  ): Promise<string> {
    const key = idempotencyKey || `${this.config.wallet.address}-${to}-${amount}-${serviceId}-${Date.now()}`;
    
    if (this.idempotencyKeys.has(key)) {
      logger.warn({ agent: this.config.name, key }, "Duplicate nanopayment detected, skipping");
      return "already-sent";
    }
    
    try {
      const tx = await this.paymentRouter.executeNanopayment(to, amount, serviceId);
      const receipt = await tx.wait();
      
      this.idempotencyKeys.add(key);
      
      logger.info({ agent: this.config.name, to, amount, serviceId, tx: receipt.hash, key }, "Nanopayment sent");
      return receipt.hash;
    } catch (err) {
      logger.error({ agent: this.config.name, to, amount, serviceId, err, key }, "Nanopayment failed");
      throw err;
    }
  }

  protected async broadcastMessage(
    type: AgentMessage["type"],
    payload: any,
    nanopayment: number = 1000
  ): Promise<AgentMessage> {
    const msg: AgentMessage = {
      from: this.config.wallet.address,
      to: "broadcast",
      type,
      payload,
      nanopayment,
      timestamp: Date.now(),
      idempotencyKey: `broadcast-${this.config.name}-${type}-${Date.now()}`,
    };
    
    const payloadStr = payload === undefined ? "undefined" : JSON.stringify(payload).slice(0, 100);
    logger.debug({ agent: this.config.name, type, payload: payloadStr }, "Broadcast");
    return msg;
  }

  protected async getRemainingBudget(): Promise<bigint> {
    return await this.budgetManager.getRemaining(this.config.wallet.address);
  }

  protected async spendBudget(amount: number): Promise<boolean> {
    try {
      const tx = await this.budgetManager.spend(this.config.wallet.address, amount);
      await tx.wait();
      return true;
    } catch (err) {
      logger.error({ agent: this.config.name, amount, err }, "Budget spend failed");
      return false;
    }
  }

  protected async getAgentInfo(address: string) {
    try {
      return await this.agentRegistry.getAgentInfo(address);
    } catch (err) {
      logger.error({ agent: this.config.name, address, err }, "Failed to get agent info");
      return null;
    }
  }

  protected async isSystemPaused(): Promise<boolean> {
    try {
      return await this.riskOracle.isPaused();
    } catch (err) {
      logger.error({ agent: this.config.name, err }, "Failed to check system pause status");
      return true;
    }
  }

  protected async getVaultBalance(): Promise<bigint> {
    try {
      return await this.vault.getVaultBalance();
    } catch (err) {
      logger.error({ agent: this.config.name, err }, "Failed to get vault balance");
      return 0n;
    }
  }

  protected updateAgentStatus(agentId: string, healthy: boolean) {
    this.agentStatuses.set(agentId, {
      wallet: "",
      healthy,
      lastSeen: Date.now(),
    });
  }

  protected getHealthyAgents(): string[] {
    const now = Date.now();
    const timeout = 60000;
    const healthy: string[] = [];
    
    for (const [agentId, status] of this.agentStatuses.entries()) {
      if (status.healthy && now - status.lastSeen < timeout) {
        healthy.push(agentId);
      }
    }
    
    return healthy;
  }
}