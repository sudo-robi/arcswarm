import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";
import { CoordinatorAgent } from "../src/coordinator.js";
import { BaseAgent, type AgentMessage } from "../src/base.js";
import { YieldAgent } from "../src/yield.js";
import { LiquidityAgent } from "../src/liquidity.js";
import { FXAgent } from "../src/fx.js";
import { PaymentAgent } from "../src/payment.js";
import { RiskAgent } from "../src/risk.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import { createConfig, createProvider } from "./helpers.js";

const TS = 1704067200000;

const mocks = vi.hoisted(() => ({ contractMock: vi.fn() }));

vi.mock("ethers", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    ethers: { ...actual.ethers, Contract: mocks.contractMock },
    Contract: mocks.contractMock,
  };
});

function fakeContract(address: string) {
  const tx = { wait: vi.fn().mockResolvedValue({ hash: "0xhash" }) };
  const c: any = {
    address,
    target: address,
    executeNanopayment: vi.fn().mockResolvedValue(tx),
    getRemaining: vi.fn().mockResolvedValue(100n),
    getVaultBalance: vi.fn().mockResolvedValue(1000n),
    spend: vi.fn().mockResolvedValue(tx),
    getAgentInfo: vi.fn().mockResolvedValue({ name: "x", active: true }),
    isPaused: vi.fn().mockResolvedValue(false),
    updateMetrics: vi.fn().mockResolvedValue(tx),
    allocateToAgent: vi.fn().mockResolvedValue(tx),
    registerAgent: vi.fn().mockResolvedValue(tx),
    grantRole: vi.fn().mockResolvedValue(tx),
    getAgentCount: vi.fn().mockResolvedValue(5),
    getActiveAgents: vi.fn().mockResolvedValue([]),
  };
  return c;
}

class TestCoordinatorAgent extends CoordinatorAgent {
  enumFor(t: string) {
    return (this as any).getAgentTypeEnum(t);
  }
  get agentMap() {
    return (this as any).agents;
  }
  get statusMap() {
    return (this as any).agentStatuses;
  }
  get budgetMap() {
    return (this as any).budgets;
  }
  get stateRef() {
    return (this as any).state;
  }
  set lastAllocationTime(v: number) {
    (this as any).lastAllocation = v;
  }
  get vaultContract() {
    return this.vault;
  }
  get routerContract() {
    return this.paymentRouter;
  }
  async allocBudgets() {
    return (this as any).allocateBudgets();
  }
  update() {
    return (this as any).updateState();
  }
  async critical(msg: AgentMessage) {
    return (this as any).handleCriticalAlert(msg);
  }
  async initSwarm() {
    return this.initializeSwarm();
  }
}

const created: any[] = [];

function makeCoordinator(): TestCoordinatorAgent {
  return new TestCoordinatorAgent(
    createConfig({ name: "Coordinator", type: "coordinator", interval: 60_000 }),
    createProvider()
  );
}

function msg(partial: Partial<AgentMessage> = {}): AgentMessage {
  return {
    from: "0xfrom",
    to: "broadcast",
    type: "alert",
    payload: {},
    nanopayment: 1000,
    timestamp: TS,
    ...partial,
  };
}

describe("CoordinatorAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
    mocks.contractMock.mockReset();
    mocks.contractMock.mockImplementation((address: string) => {
      const c = fakeContract(address);
      created.push(c);
      return c;
    });
  });
  afterEach(() => {
    created.length = 0;
    vi.useRealTimers();
  });

  describe("getAgentTypeEnum", () => {
    it.each([
      ["yield", 0],
      ["liquidity", 1],
      ["fx", 2],
      ["payment", 3],
      ["risk", 4],
      ["coordinator", 5],
    ])("maps %s to %i", (type, expected) => {
      const c = makeCoordinator();
      expect(c.enumFor(type)).toBe(expected);
    });

    it("defaults unknown types to coordinator (5)", () => {
      const c = makeCoordinator();
      expect(c.enumFor("nope")).toBe(5);
    });
  });

  describe("getStatus", () => {
    it("returns the current SwarmState", () => {
      const c = makeCoordinator();
      expect(c.getStatus()).toEqual({
        agents: [],
        totalBudget: 0,
        totalSpent: 0,
        riskScore: 0,
        circuitBreakerActive: false,
      });
      expect(c.getStatus()).toBe(c.stateRef);
    });
  });

  describe("initializeSwarm", () => {
    it("creates five specialist agents with registered wallets and budgets", async () => {
      const c = makeCoordinator();
      await c.initSwarm();

      expect([...c.agentMap.keys()]).toEqual(["yield", "liquidity", "fx", "payment", "risk"]);
      expect(c.agentMap.get("yield")).toBeInstanceOf(YieldAgent);
      expect(c.agentMap.get("liquidity")).toBeInstanceOf(LiquidityAgent);
      expect(c.agentMap.get("fx")).toBeInstanceOf(FXAgent);
      expect(c.agentMap.get("payment")).toBeInstanceOf(PaymentAgent);
      expect(c.agentMap.get("risk")).toBeInstanceOf(RiskAgent);

      expect(c.statusMap.size).toBe(5);
      for (const [type, status] of c.statusMap) {
        expect(status.active).toBe(true);
        expect(status.wallet).toMatch(/^0x/);
        expect(status.name).toBeTruthy();
      }

      // budget allocation: 30/15/20/25/10 % of 100,000 USDC
      expect(c.statusMap.get("yield").budget).toBe(100_000e6 * 0.3);
      expect(c.statusMap.get("liquidity").budget).toBe(100_000e6 * 0.15);
      expect(c.statusMap.get("fx").budget).toBe(100_000e6 * 0.2);
      expect(c.statusMap.get("payment").budget).toBe(100_000e6 * 0.25);
      expect(c.statusMap.get("risk").budget).toBe(100_000e6 * 0.1);
      expect(c.budgetMap.size).toBe(5);
    });

    it("registers each agent in the AgentRegistry with the right enum", async () => {
      const c = makeCoordinator();
      await c.initSwarm();

      const regContracts = created.filter((cc) => cc.address === CONTRACTS.agentRegistry);
      const calls = regContracts.flatMap((cc) => cc.registerAgent.mock.calls as any[]);
      expect(calls).toHaveLength(5);
      const typeEnums = calls.map((call) => call[2]).sort();
      expect(typeEnums).toEqual([0, 1, 2, 3, 4]);
    });

    it("grants AGENT_ROLE on the payment router and vault for each wallet", async () => {
      const c = makeCoordinator();
      await c.initSwarm();

      const roleCalls = created
        .filter((cc) => cc.address === CONTRACTS.paymentRouter || cc.address === CONTRACTS.vault)
        .flatMap((cc) => cc.grantRole.mock.calls as any[]);
      expect(roleCalls).toHaveLength(10); // 5 agents * 2 contracts
      for (const call of roleCalls) {
        expect(call[0]).toMatch(/^0x/); // keccak AGENT_ROLE
        expect(call[1]).toMatch(/^0x/); // wallet address
      }
    });

    it("allocates budgets to each agent's wallet on the vault", async () => {
      const c = makeCoordinator();
      await c.initSwarm();

      const vault = c.vaultContract;
      expect(vault.allocateToAgent).toHaveBeenCalledTimes(5);
      const wallets = c.statusMap.get("yield").wallet;
      expect(vault.allocateToAgent).toHaveBeenCalledWith(wallets, BigInt(100_000e6 * 0.3));
    });

    it("sends a budget-allocation nanopayment to each agent", async () => {
      const c = makeCoordinator();
      await c.initSwarm();

      const router = c.routerContract;
      expect(router.executeNanopayment).toHaveBeenCalledTimes(5);
      for (const [type, status] of c.statusMap) {
        expect(router.executeNanopayment).toHaveBeenCalledWith(
          status.wallet,
          1000,
          `budget-allocation-${c.budgetMap.get(type)}`
        );
      }
    });
  });

  describe("allocateBudgets", () => {
    it("skips agent types without a status", async () => {
      const c = makeCoordinator();
      c.statusMap.set("yield", { name: "y", type: "yield", wallet: "0x1", budget: 0, spent: 0, active: true, lastActivity: TS });
      await c.allocBudgets();
      expect(c.vaultContract.allocateToAgent).toHaveBeenCalledTimes(1);
      expect(c.routerContract.executeNanopayment).toHaveBeenCalledTimes(1);
      expect(c.statusMap.get("yield").budget).toBe(100_000e6 * 0.3);
      expect(c.budgetMap.get("yield")).toBe(100_000e6 * 0.3);
    });
  });

  describe("updateState", () => {
    it("syncs agents and totalBudget from statuses and budgets", () => {
      const c = makeCoordinator();
      c.statusMap.set("yield", { name: "y", type: "yield", wallet: "0x1", budget: 10, spent: 0, active: true, lastActivity: TS });
      c.statusMap.set("risk", { name: "r", type: "risk", wallet: "0x2", budget: 20, spent: 0, active: true, lastActivity: TS });
      (c as any).budgets.set("yield", 10);
      (c as any).budgets.set("risk", 20);
      c.update();
      expect(c.stateRef.agents).toHaveLength(2);
      expect(c.stateRef.totalBudget).toBe(30);
    });
  });

  describe("execute", () => {
    it("pings the risk agent and refreshes state", async () => {
      const c = makeCoordinator();
      c.agentMap.set("risk", { start: vi.fn(), stop: vi.fn() } as any);
      c.statusMap.set("risk", { name: "Risk Agent", type: "risk", wallet: "0xrisk", budget: 0, spent: 0, active: true, lastActivity: TS });
      c.lastAllocationTime = TS; // fresh -> skip allocateBudgets

      await c.execute();

      expect(c.routerContract.executeNanopayment).toHaveBeenCalledWith("0xrisk", 1000, "status-check");
      expect(c.stateRef.agents).toHaveLength(1);
      expect(c.stateRef.totalBudget).toBe(0);
    });

    it("allocates budgets when the allocation interval has elapsed", async () => {
      const c = makeCoordinator();
      c.agentMap.set("risk", {} as any);
      c.statusMap.set("risk", { name: "Risk Agent", type: "risk", wallet: "0xrisk", budget: 0, spent: 0, active: true, lastActivity: TS });
      c.lastAllocationTime = 0; // stale -> allocate

      await c.execute();

      expect(c.vaultContract.allocateToAgent).toHaveBeenCalledTimes(1);
      // status-check + budget-allocation
      expect(c.routerContract.executeNanopayment).toHaveBeenCalledTimes(2);
    });

    it("does not crash when the risk agent is absent", async () => {
      const c = makeCoordinator();
      c.lastAllocationTime = TS;
      await expect(c.execute()).resolves.toBeUndefined();
    });
  });

  describe("handleMessage / handleCriticalAlert", () => {
    it("stops every agent and pauses the swarm on a critical circuitBreakerTriggered alert", async () => {
      const c = makeCoordinator();
      const stopSpy = vi.fn();
      c.agentMap.set("yield", { stop: stopSpy } as any);
      c.agentMap.set("fx", { stop: stopSpy } as any);
      c.statusMap.set("yield", { name: "y", type: "yield", wallet: "0x1", budget: 0, spent: 0, active: true, lastActivity: TS });
      c.statusMap.set("fx", { name: "f", type: "fx", wallet: "0x2", budget: 0, spent: 0, active: true, lastActivity: TS });
      const broadcastSpy = vi.spyOn(c as any, "broadcastMessage").mockResolvedValue({} as any);

      await c.handleMessage(
        msg({ type: "alert", from: "0xrisk", payload: { severity: "critical", action: "circuitBreakerTriggered", riskScore: 95 } })
      );

      expect(stopSpy).toHaveBeenCalledTimes(2);
      expect(c.statusMap.get("yield").active).toBe(false);
      expect(c.statusMap.get("fx").active).toBe(false);
      expect(broadcastSpy).toHaveBeenCalledWith(
        "alert",
        expect.objectContaining({ action: "swarmPaused", reason: expect.objectContaining({ action: "circuitBreakerTriggered" }) })
      );
    });

    it("does not pause the swarm for non-critical alerts", async () => {
      const c = makeCoordinator();
      const stopSpy = vi.fn();
      c.agentMap.set("yield", { stop: stopSpy } as any);
      c.statusMap.set("yield", { name: "y", type: "yield", wallet: "0x1", budget: 0, spent: 0, active: true, lastActivity: TS });
      const broadcastSpy = vi.spyOn(c as any, "broadcastMessage").mockResolvedValue({} as any);

      await c.handleMessage(msg({ type: "alert", payload: { severity: "high", action: "circuitBreakerTriggered" } }));

      expect(stopSpy).not.toHaveBeenCalled();
      expect(c.statusMap.get("yield").active).toBe(true);
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("does not stop agents for a critical alert with a different action", async () => {
      const c = makeCoordinator();
      const stopSpy = vi.fn();
      c.agentMap.set("yield", { stop: stopSpy } as any);
      const broadcastSpy = vi.spyOn(c as any, "broadcastMessage").mockResolvedValue({} as any);
      await c.handleMessage(msg({ type: "alert", payload: { severity: "critical", action: "somethingElse" } }));
      expect(stopSpy).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("handles response and request messages without throwing", async () => {
      const c = makeCoordinator();
      await expect(c.handleMessage(msg({ type: "response", payload: {} }))).resolves.toBeUndefined();
      await expect(c.handleMessage(msg({ type: "request", payload: {} }))).resolves.toBeUndefined();
    });
  });

  describe("startSwarm / stopSwarm", () => {
    it("initializes, starts each agent, then starts the coordinator", async () => {
      const c = makeCoordinator();
      const baseStartSpy = vi.spyOn(BaseAgent.prototype, "start").mockResolvedValue(undefined as any);

      await c.startSwarm();

      expect(baseStartSpy).toHaveBeenCalledTimes(6); // 5 agents + coordinator
      expect(c.agentMap.size).toBe(5);
      baseStartSpy.mockRestore();
    });

    it("stops each agent then the coordinator", async () => {
      const c = makeCoordinator();
      const baseStartSpy = vi.spyOn(BaseAgent.prototype, "start").mockResolvedValue(undefined as any);
      const baseStopSpy = vi.spyOn(BaseAgent.prototype, "stop").mockImplementation(() => {});
      await c.startSwarm();
      baseStartSpy.mockClear();

      await c.stopSwarm();

      expect(baseStopSpy).toHaveBeenCalledTimes(6); // 5 agents + coordinator
      baseStartSpy.mockRestore();
      baseStopSpy.mockRestore();
    });
  });
});
