import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage } from "./base.js";
import { YieldAgent } from "./yield.js";
import { LiquidityAgent } from "./liquidity.js";
import { FXAgent } from "./fx.js";
import { PaymentAgent } from "./payment.js";
import { RiskAgent } from "./risk.js";
import { CONTRACTS, AGENT_REGISTRY_ABI } from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

interface AgentStatus {
  name: string;
  type: string;
  wallet: string;
  budget: number;
  spent: number;
  active: boolean;
  lastActivity: number;
  healthy: boolean;
  lastSeen: number;
}

interface SwarmState {
  agents: AgentStatus[];
  totalBudget: number;
  totalSpent: number;
  riskScore: number;
  circuitBreakerActive: boolean;
}

export class CoordinatorAgent extends BaseAgent {
  private agents: Map<string, BaseAgent> = new Map();
  protected agentStatuses: Map<string, AgentStatus> = new Map();
  private budgets: Map<string, number> = new Map();
  private lastAllocation = 0;
  private allocationInterval = 300_000;
  private state: SwarmState = {
    agents: [],
    totalBudget: 0,
    totalSpent: 0,
    riskScore: 0,
    circuitBreakerActive: false,
  };

  constructor(config: AgentConfig, provider: ethers.JsonRpcProvider) {
    super(config, provider);
  }

  async initializeSwarm(): Promise<void> {
    logger.info({ agent: this.config.name }, "Initializing swarm...");

    const agentConfigs = [
      { name: "Yield Agent", type: "yield" as const, interval: 300_000 },
      { name: "Liquidity Agent", type: "liquidity" as const, interval: 3_600_000 },
      { name: "FX Agent", type: "fx" as const, interval: 600_000 },
      { name: "Payment Agent", type: "payment" as const, interval: 60_000 },
      { name: "Risk Agent", type: "risk" as const, interval: 60_000 },
    ];

    for (const cfg of agentConfigs) {
      const hdWallet = ethers.Wallet.createRandom();
      const wallet = new ethers.Wallet(hdWallet.privateKey, this.provider);
      logger.info({ agent: this.config.name, name: cfg.name, address: wallet.address }, "Created agent wallet");

      const agentId = ethers.keccak256(ethers.toUtf8Bytes(`${cfg.type.toUpperCase()}-${Date.now()}`));
      const registry = new ethers.Contract(CONTRACTS.agentRegistry, AGENT_REGISTRY_ABI, this.config.wallet);
      const regTx = await registry.registerAgent(wallet.address, agentId, this.getAgentTypeEnum(cfg.type), cfg.name);
      await regTx.wait();
      logger.info({ agent: this.config.name, name: cfg.name }, "Registered in AgentRegistry");

      const paymentRouter = new ethers.Contract(CONTRACTS.paymentRouter, ["function grantRole(bytes32,address)"], this.config.wallet);
      const agentRole = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
      await (await paymentRouter.grantRole(agentRole, wallet.address)).wait();

      const vault = new ethers.Contract(CONTRACTS.vault, ["function grantRole(bytes32,address)"], this.config.wallet);
      const vaultAgentRole = ethers.keccak256(ethers.toUtf8Bytes("AGENT_ROLE"));
      await (await vault.grantRole(vaultAgentRole, wallet.address)).wait();

      const agentConfig: AgentConfig = {
        name: cfg.name,
        type: cfg.type,
        wallet,
        contracts: this.config.contracts,
        interval: cfg.interval,
      };

      let agent: BaseAgent;
      switch (cfg.type) {
        case "yield": agent = new YieldAgent(agentConfig, this.provider); break;
        case "liquidity": agent = new LiquidityAgent(agentConfig, this.provider); break;
        case "fx": agent = new FXAgent(agentConfig, this.provider); break;
        case "payment": agent = new PaymentAgent(agentConfig, this.provider); break;
        case "risk": agent = new RiskAgent(agentConfig, this.provider); break;
      }

      this.agents.set(cfg.type, agent!);
      this.agentStatuses.set(cfg.type, {
        name: cfg.name,
        type: cfg.type,
        wallet: wallet.address,
        budget: 0,
        spent: 0,
        active: true,
        lastActivity: Date.now(),
        healthy: true,
        lastSeen: Date.now(),
      });
    }

    await this.allocateBudgets();
  }

  private getAgentTypeEnum(type: string): number {
    const types = { yield: 0, liquidity: 1, fx: 2, payment: 3, risk: 4, coordinator: 5 };
    return types[type as keyof typeof types] ?? 5;
  }

  async execute(): Promise<void> {
    logger.info({ agent: this.config.name }, "Orchestrating swarm...");

    const riskAgent = this.agents.get("risk");
    if (riskAgent) {
      const riskStatus = this.agentStatuses.get("risk");
      if (riskStatus) {
        await this.sendNanopayment(riskStatus.wallet, 1000, "status-check");
      }
    }

    if (Date.now() - this.lastAllocation > this.allocationInterval) {
      await this.allocateBudgets();
      this.lastAllocation = Date.now();
    }

    await this.resolveConflicts();
    this.updateState();
  }

  private async allocateBudgets(): Promise<void> {
    const totalBudget = 100_000e6;
    const allocations: Record<string, number> = {
      yield: totalBudget * 0.3,
      liquidity: totalBudget * 0.15,
      fx: totalBudget * 0.2,
      payment: totalBudget * 0.25,
      risk: totalBudget * 0.1,
    };

    for (const [type, amount] of Object.entries(allocations)) {
      const status = this.agentStatuses.get(type);
      if (!status) continue;

      const tx = await this.vault.allocateToAgent(status.wallet, BigInt(amount));
      await tx.wait();

      await this.sendNanopayment(status.wallet, 1000, `budget-allocation-${amount}`);

      status.budget = amount;
      this.budgets.set(type, amount);
      logger.info({ agent: this.config.name, type, amount: amount / 1e6 }, "Allocated budget");
    }
  }

  private async resolveConflicts(): Promise<void> {
    logger.debug({ agent: this.config.name }, "Checking for conflicts...");
  }

  private updateState(): void {
    this.state.agents = Array.from(this.agentStatuses.values());
    this.state.totalBudget = Array.from(this.budgets.values()).reduce((sum, b) => sum + b, 0);
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "alert":
        logger.warn({ agent: this.config.name, from: msg.from, payload: msg.payload }, "Alert received");
        if (msg.payload.severity === "critical") {
          await this.handleCriticalAlert(msg);
        }
        break;
      case "response":
        logger.info({ agent: this.config.name, from: msg.from, payload: msg.payload }, "Response received");
        break;
      case "request":
        logger.info({ agent: this.config.name, from: msg.from, payload: msg.payload }, "Request received");
        break;
    }
  }

  private async handleCriticalAlert(msg: AgentMessage): Promise<void> {
    logger.error({ agent: this.config.name, payload: msg.payload }, "HANDLING CRITICAL ALERT");

    if (msg.payload.action === "circuitBreakerTriggered") {
      logger.warn({ agent: this.config.name }, "Pausing all agents...");
      for (const [type, agent] of this.agents) {
        agent.stop();
        const status = this.agentStatuses.get(type);
        if (status) status.active = false;
      }

      await this.broadcastMessage("alert", {
        action: "swarmPaused",
        reason: msg.payload,
        timestamp: Date.now(),
      });
    }
  }

  getStatus(): SwarmState {
    return this.state;
  }

  async startSwarm(): Promise<void> {
    logger.info({ agent: this.config.name }, "Starting ArcSwarm...");
    await this.initializeSwarm();

    for (const [type, agent] of this.agents) {
      logger.info({ agent: this.config.name, type }, "Starting agent");
      agent.start();
    }

    this.start();
  }

  async stopSwarm(): Promise<void> {
    logger.info({ agent: this.config.name }, "Stopping ArcSwarm...");
    for (const [type, agent] of this.agents) {
      agent.stop();
    }
    this.stop();
  }
}