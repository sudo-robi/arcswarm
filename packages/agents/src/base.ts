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

export const AGENT_CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 5_000,
  IDEMPOTENCY_KEY_LIMIT: 1_000,
  IDEMPOTENCY_KEY_PRUNE_TARGET: 500,
  IDEMPOTENCY_KEY_MAX_AGE_MS: 3_600_000,
  AGENT_HEALTH_TIMEOUT_MS: 60_000,
  DLQ_MAX_SIZE: 500,
  DEFAULT_NANOPAYMENT: 1_000,
  MAX_MESSAGE_PAYLOAD_BYTES: 65_536,
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_RESET_MS: 30_000,
} as const;

export enum CircuitState {
  Closed = "closed",
  Open = "open",
  HalfOpen = "half-open",
}

export class CircuitBreaker {
  private state = CircuitState.Closed;
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly threshold: number;
  private readonly resetMs: number;

  constructor(
    threshold = AGENT_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD,
    resetMs = AGENT_CONSTANTS.CIRCUIT_BREAKER_RESET_MS
  ) {
    this.threshold = threshold;
    this.resetMs = resetMs;
  }

  getState(): CircuitState {
    if (this.state === CircuitState.Open) {
      if (Date.now() - this.lastFailureTime >= this.resetMs) {
        this.state = CircuitState.HalfOpen;
      }
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.Closed;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.threshold) {
      this.state = CircuitState.Open;
      logger.error(
        { failures: this.failureCount, threshold: this.threshold },
        "Circuit breaker OPEN"
      );
    }
  }

  canExecute(): boolean {
    const state = this.getState();
    return state !== CircuitState.Open;
  }
}

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
  payload: Record<string, unknown>;
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
  protected idempotencyKeys: Map<string, number> = new Map();
  protected maxRetryAttempts = AGENT_CONSTANTS.MAX_RETRY_ATTEMPTS;
  protected retryDelay = AGENT_CONSTANTS.RETRY_DELAY_MS;
  protected rpcCircuitBreaker = new CircuitBreaker();

  protected vault: ethers.Contract;
  protected budgetManager: ethers.Contract;
  protected agentRegistry: ethers.Contract;
  protected riskOracle: ethers.Contract;
  protected paymentRouter: ethers.Contract;

  protected traceCounter = 0;

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

  protected nextTraceId(): string {
    this.traceCounter++;
    return `${this.config.name}-${this.traceCounter}`;
  }

  abstract execute(): Promise<void>;
  abstract handleMessage(msg: AgentMessage): Promise<void>;

  async start() {
    this.running = true;
    this.shuttingDown = false;
    logger.info({ agent: this.config.name, address: this.config.wallet.address }, "Starting agent");

    while (this.running) {
      const traceId = this.nextTraceId();
      try {
        if (!this.shuttingDown) {
          await this.execute();
          await this.processMessages();
          await this.processDeadLetterQueue();
        }
      } catch (err) {
        logger.error({ agent: this.config.name, traceId, err }, "Agent error");
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
          this.enqueueDeadLetter(msg, err);
        }
      }
    }

    logger.info({ agent: this.config.name, deadLetterCount: this.deadLetterQueue.length }, "Message queue drained");

    this.running = false;
    logger.info({ agent: this.config.name }, "Agent stopped");
  }

  protected enqueueDeadLetter(msg: AgentMessage, err: unknown): void {
    if (this.deadLetterQueue.length >= AGENT_CONSTANTS.DLQ_MAX_SIZE) {
      const discarded = this.deadLetterQueue.shift();
      if (discarded) {
        logger.warn(
          { agent: this.config.name, discardedMessage: discarded.message, error: discarded.error },
          "DLQ full, discarding oldest entry"
        );
      }
    }
    this.deadLetterQueue.push({
      message: msg,
      attempts: 1,
      lastAttempt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    });
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
      logger.warn(
        { agent: this.config.name, message: entry.message, error: entry.error, attempts: entry.attempts },
        "Discarding message after max retry attempts"
      );
      this.deadLetterQueue = this.deadLetterQueue.filter((e) => e !== entry);
    }

    for (const entry of entriesToRetry) {
      logger.info(
        { agent: this.config.name, message: entry.message, attempt: entry.attempts + 1 },
        "Retrying message from dead letter queue"
      );

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
    const idempotencyKey =
      msg.idempotencyKey || `${msg.from}-${msg.to}-${msg.type}-${msg.timestamp}`;

    if (this.idempotencyKeys.has(idempotencyKey)) {
      logger.warn({ agent: this.config.name, idempotencyKey }, "Duplicate message detected, ignoring");
      return;
    }

    const now = Date.now();
    this.idempotencyKeys.set(idempotencyKey, now);

    if (this.idempotencyKeys.size > AGENT_CONSTANTS.IDEMPOTENCY_KEY_LIMIT) {
      const cutoff = now - AGENT_CONSTANTS.IDEMPOTENCY_KEY_MAX_AGE_MS;
      const entries = Array.from(this.idempotencyKeys.entries());
      const pruned = entries
        .filter(([, ts]) => ts > cutoff)
        .slice(-AGENT_CONSTANTS.IDEMPOTENCY_KEY_PRUNE_TARGET);
      this.idempotencyKeys = new Map(pruned);
    }

    this.messageQueue.push(msg);
  }

  protected async processMessages() {
    while (this.messageQueue.length > 0) {
      const msg = this.messageQueue.shift()!;
      try {
        await this.handleMessage(msg);
      } catch (err) {
        logger.error({ agent: this.config.name, err, msg }, "Message processing failed");
        this.enqueueDeadLetter(msg, err);
      }
    }
  }

  protected async sendNanopayment(
    to: string,
    amount: number,
    serviceId: string,
    idempotencyKey?: string
  ): Promise<string> {
    const key =
      idempotencyKey ||
      `${this.config.wallet.address}-${to}-${amount}-${serviceId}-${Date.now()}`;

    if (this.idempotencyKeys.has(key)) {
      logger.warn({ agent: this.config.name, key }, "Duplicate nanopayment detected, skipping");
      return "already-sent";
    }

    if (!this.rpcCircuitBreaker.canExecute()) {
      logger.warn({ agent: this.config.name, key }, "Circuit breaker open, skipping nanopayment");
      return "circuit-open";
    }

    try {
      const tx = await this.paymentRouter.executeNanopayment(to, amount, serviceId);
      const receipt = await tx.wait();

      this.idempotencyKeys.set(key, Date.now());
      this.rpcCircuitBreaker.recordSuccess();

      logger.info({ agent: this.config.name, to, amount, serviceId, tx: receipt.hash, key }, "Nanopayment sent");
      return receipt.hash;
    } catch (err) {
      this.rpcCircuitBreaker.recordFailure();
      logger.error({ agent: this.config.name, to, amount, serviceId, err, key }, "Nanopayment failed");
      throw err;
    }
  }

  protected async broadcastMessage(
    type: AgentMessage["type"],
    payload: Record<string, unknown>,
    nanopayment: number = 1000
  ): Promise<AgentMessage> {
    const payloadStr =
      payload === undefined ? "undefined" : JSON.stringify(payload).slice(0, 100);

    if (payload !== undefined) {
      try {
        const size = JSON.stringify(payload).length;
        if (size > AGENT_CONSTANTS.MAX_MESSAGE_PAYLOAD_BYTES) {
          logger.warn(
            { agent: this.config.name, size, limit: AGENT_CONSTANTS.MAX_MESSAGE_PAYLOAD_BYTES },
            "Message payload exceeds size limit"
          );
        }
      } catch {
        // non-serializable payload, skip size check
      }
    }

    logger.debug({ agent: this.config.name, type, payload: payloadStr }, "Broadcast");
    return {
      from: this.config.wallet.address,
      to: "broadcast",
      type,
      payload,
      nanopayment,
      timestamp: Date.now(),
      idempotencyKey: `broadcast-${this.config.name}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
  }

  protected async getRemainingBudget(): Promise<bigint> {
    if (!this.rpcCircuitBreaker.canExecute()) {
      logger.warn({ agent: this.config.name }, "Circuit breaker open, returning 0 budget");
      return 0n;
    }
    try {
      const result = await this.budgetManager.getRemaining(this.config.wallet.address);
      this.rpcCircuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.rpcCircuitBreaker.recordFailure();
      logger.error({ agent: this.config.name, err }, "Failed to get remaining budget");
      return 0n;
    }
  }

  protected async spendBudget(amount: number): Promise<boolean> {
    if (!this.rpcCircuitBreaker.canExecute()) {
      logger.warn({ agent: this.config.name, amount }, "Circuit breaker open, skipping spend");
      return false;
    }
    try {
      const tx = await this.budgetManager.spend(this.config.wallet.address, amount);
      await tx.wait();
      this.rpcCircuitBreaker.recordSuccess();
      return true;
    } catch (err) {
      this.rpcCircuitBreaker.recordFailure();
      logger.error({ agent: this.config.name, amount, err }, "Budget spend failed");
      return false;
    }
  }

  protected async getAgentInfo(address: string) {
    if (!this.rpcCircuitBreaker.canExecute()) {
      logger.warn({ agent: this.config.name, address }, "Circuit breaker open, skipping getAgentInfo");
      return null;
    }
    try {
      const result = await this.agentRegistry.getAgentInfo(address);
      this.rpcCircuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.rpcCircuitBreaker.recordFailure();
      logger.error({ agent: this.config.name, address, err }, "Failed to get agent info");
      return null;
    }
  }

  protected async isSystemPaused(): Promise<boolean> {
    try {
      const result = await this.riskOracle.isPaused();
      this.rpcCircuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.rpcCircuitBreaker.recordFailure();
      logger.error({ agent: this.config.name, err }, "Failed to check system pause status");
      return true;
    }
  }

  protected async getVaultBalance(): Promise<bigint> {
    if (!this.rpcCircuitBreaker.canExecute()) {
      logger.warn({ agent: this.config.name }, "Circuit breaker open, returning 0 balance");
      return 0n;
    }
    try {
      const result = await this.vault.getVaultBalance();
      this.rpcCircuitBreaker.recordSuccess();
      return result;
    } catch (err) {
      this.rpcCircuitBreaker.recordFailure();
      logger.error({ agent: this.config.name, err }, "Failed to get vault balance");
      return 0n;
    }
  }

  protected updateAgentStatus(agentId: string, healthy: boolean, wallet?: string) {
    const existing = this.agentStatuses.get(agentId);
    this.agentStatuses.set(agentId, {
      wallet: wallet ?? existing?.wallet ?? "",
      healthy,
      lastSeen: Date.now(),
    });
  }

  protected getHealthyAgents(): string[] {
    const now = Date.now();
    const healthy: string[] = [];

    for (const [agentId, status] of this.agentStatuses.entries()) {
      if (status.healthy && now - status.lastSeen < AGENT_CONSTANTS.AGENT_HEALTH_TIMEOUT_MS) {
        healthy.push(agentId);
      }
    }

    return healthy;
  }
}