import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage, ContractAddresses } from "./base";
import { YieldAgent } from "./yield";
import { LiquidityAgent } from "./liquidity";
import { FXAgent } from "./fx";
import { PaymentAgent } from "./payment";
import { RiskAgent } from "./risk";

interface AgentStatus {
  name: string;
  type: string;
  wallet: string;
  budget: number;
  spent: number;
  active: boolean;
  lastActivity: number;
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
  private agentStatuses: Map<string, AgentStatus> = new Map();
  private budgets: Map<string, number> = new Map();
  private lastAllocation = 0;
  private allocationInterval = 300_000; // 5 minutes
  private state: SwarmState = {
    agents: [],
    totalBudget: 0,
    totalSpent: 0,
    riskScore: 0,
    circuitBreakerActive: false,
  };

  constructor(
    config: AgentConfig,
    provider: ethers.JsonRpcProvider,
    contracts: ContractAddresses
  ) {
    super(config, provider);
    this.initializeAgents(contracts);
  }

  private initializeAgents(contracts: ContractAddresses) {
    const agentConfigs: AgentConfig[] = [
      {
        name: "Yield Agent",
        type: "yield",
        wallet: ethers.Wallet.createRandom().connect(this.provider),
        contracts,
        interval: 300_000,
      },
      {
        name: "Liquidity Agent",
        type: "liquidity",
        wallet: ethers.Wallet.createRandom().connect(this.provider),
        contracts,
        interval: 3_600_000,
      },
      {
        name: "FX Agent",
        type: "fx",
        wallet: ethers.Wallet.createRandom().connect(this.provider),
        contracts,
        interval: 600_000,
      },
      {
        name: "Payment Agent",
        type: "payment",
        wallet: ethers.Wallet.createRandom().connect(this.provider),
        contracts,
        interval: 60_000,
      },
      {
        name: "Risk Agent",
        type: "risk",
        wallet: ethers.Wallet.createRandom().connect(this.provider),
        contracts,
        interval: 60_000,
      },
    ];

    for (const cfg of agentConfigs) {
      let agent: BaseAgent;
      switch (cfg.type) {
        case "yield":
          agent = new YieldAgent(cfg, this.provider);
          break;
        case "liquidity":
          agent = new LiquidityAgent(cfg, this.provider);
          break;
        case "fx":
          agent = new FXAgent(cfg, this.provider);
          break;
        case "payment":
          agent = new PaymentAgent(cfg, this.provider);
          break;
        case "risk":
          agent = new RiskAgent(cfg, this.provider);
          break;
        default:
          continue;
      }
      this.agents.set(cfg.type, agent);
      this.agentStatuses.set(cfg.type, {
        name: cfg.name,
        type: cfg.type,
        wallet: cfg.wallet.address,
        budget: 0,
        spent: 0,
        active: true,
        lastActivity: Date.now(),
      });
    }
  }

  async execute(): Promise<void> {
    console.log(`[${this.config.name}] Orchestrating swarm...`);

    // 1. Check Risk Agent status
    const riskAgent = this.agents.get("risk");
    if (riskAgent) {
      await this.sendNanopayment(
        this.agentStatuses.get("risk")!.wallet,
        1000,
        "status-check"
      );
    }

    // 2. Allocate budgets if needed
    if (Date.now() - this.lastAllocation > this.allocationInterval) {
      await this.allocateBudgets();
      this.lastAllocation = Date.now();
    }

    // 3. Resolve conflicts between agents
    await this.resolveConflicts();

    // 4. Update state
    this.updateState();
  }

  private async allocateBudgets(): Promise<void> {
    const totalBudget = 100_000e6; // 100,000 USDC total
    const allocations: { [key: string]: number } = {
      yield: totalBudget * 0.3, // 30%
      liquidity: totalBudget * 0.15, // 15%
      fx: totalBudget * 0.2, // 20%
      payment: totalBudget * 0.25, // 25%
      risk: totalBudget * 0.1, // 10%
    };

    for (const [type, amount] of Object.entries(allocations)) {
      const agent = this.agents.get(type);
      if (agent) {
        console.log(
          `[${this.config.name}] Allocating ${amount / 1e6} USDC to ${type} agent`
        );

        // Send Nanopayment for budget allocation
        await this.sendNanopayment(
          this.agentStatuses.get(type)!.wallet,
          1000,
          `budget-allocation-${amount}`
        );

        // Update status
        const status = this.agentStatuses.get(type)!;
        status.budget = amount;
        this.budgets.set(type, amount);
      }
    }
  }

  private async resolveConflicts(): Promise<void> {
    // Check if Yield Agent and Liquidity Agent have conflicting strategies
    // In production: compare allocation plans and find equilibrium
    console.log(`[${this.config.name}] Checking for conflicts...`);
  }

  private updateState(): void {
    this.state.agents = Array.from(this.agentStatuses.values());
    this.state.totalBudget = Array.from(this.budgets.values()).reduce(
      (sum, b) => sum + b,
      0
    );
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "alert":
        console.log(`[${this.config.name}] Alert from ${msg.from}:`, msg.payload);

        // Handle critical alerts
        if (msg.payload.severity === "critical") {
          await this.handleCriticalAlert(msg);
        }
        break;
      case "response":
        console.log(`[${this.config.name}] Response from ${msg.from}:`, msg.payload);
        break;
      case "request":
        console.log(`[${this.config.name}] Request from ${msg.from}:`, msg.payload);
        break;
    }
  }

  private async handleCriticalAlert(msg: AgentMessage): Promise<void> {
    console.log(`[${this.config.name}] HANDLING CRITICAL ALERT:`, msg.payload);

    if (msg.payload.action === "circuitBreakerTriggered") {
      // Pause all agents
      console.log(`[${this.config.name}] Pausing all agents...`);
      for (const [type, agent] of this.agents) {
        agent.stop();
        const status = this.agentStatuses.get(type)!;
        status.active = false;
      }

      // Notify user
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
    console.log(`[${this.config.name}] Starting ArcSwarm...`);

    // Start all agents
    for (const [type, agent] of this.agents) {
      console.log(`[${this.config.name}] Starting ${type} agent...`);
      agent.start();
    }

    // Start coordinator loop
    this.start();
  }

  async stopSwarm(): Promise<void> {
    console.log(`[${this.config.name}] Stopping ArcSwarm...`);

    for (const [type, agent] of this.agents) {
      agent.stop();
    }

    this.stop();
  }
}
