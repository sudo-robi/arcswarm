import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";
import { BaseAgent, type AgentConfig, type AgentMessage } from "../src/base.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import { createConfig, createProvider } from "./helpers.js";

const TS = 1704067200000; // 2024-01-01T00:00:00Z

class ExposedAgent extends BaseAgent {
  received: AgentMessage[] = [];

  async execute(): Promise<void> {}
  async handleMessage(msg: AgentMessage): Promise<void> {
    this.received.push(msg);
  }

  get isRunning() {
    return this.running;
  }
  get queue() {
    return this.messageQueue;
  }
  get queueLength() {
    return this.messageQueue.length;
  }
  get vaultContract() {
    return this.vault;
  }
  get budgetContract() {
    return this.budgetManager;
  }
  get registryContract() {
    return this.agentRegistry;
  }
  get riskContract() {
    return this.riskOracle;
  }
  get routerContract() {
    return this.paymentRouter;
  }
  get configRef() {
    return this.config;
  }

  process() {
    return this.processMessages();
  }
  send(to: string, amount: number, serviceId: string) {
    return this.sendNanopayment(to, amount, serviceId);
  }
  broadcast(type: AgentMessage["type"], payload: any, nanopayment?: number) {
    return this.broadcastMessage(type, payload, nanopayment);
  }
  push(msg: AgentMessage) {
    this.receiveMessage(msg);
  }
  remaining() {
    return this.getRemainingBudget();
  }
  spend(amount: number) {
    return this.spendBudget(amount);
  }
  info(address: string) {
    return this.getAgentInfo(address);
  }
  paused() {
    return this.isSystemPaused();
  }
  balance() {
    return this.getVaultBalance();
  }
}

function makeAgent(): ExposedAgent {
  return new ExposedAgent(createConfig(), createProvider());
}

function makeMessage(partial: Partial<AgentMessage> = {}): AgentMessage {
  return {
    from: "0xfrom",
    to: "0xto",
    type: "request",
    payload: {},
    nanopayment: 1000,
    timestamp: TS,
    ...partial,
  };
}

describe("BaseAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("wires all five contracts to CONTRACTS addresses", () => {
      const agent = makeAgent();
      expect(agent.vaultContract.target).toBe(CONTRACTS.vault);
      expect(agent.budgetContract.target).toBe(CONTRACTS.budgetManager);
      expect(agent.registryContract.target).toBe(CONTRACTS.agentRegistry);
      expect(agent.riskContract.target).toBe(CONTRACTS.riskOracle);
      expect(agent.routerContract.target).toBe(CONTRACTS.paymentRouter);
    });

    it("connects wallet to the provider and uses it as signer", () => {
      const provider = createProvider();
      const agent = new ExposedAgent(createConfig(), provider);
      const signer = (agent.vaultContract as any).runner;
      expect(signer.address).toBe(agent.configRef.wallet.address);
      expect(signer.provider).toBe(provider);
    });

    it("starts with empty message queue and not running", () => {
      const agent = makeAgent();
      expect(agent.isRunning).toBe(false);
      expect(agent.queueLength).toBe(0);
    });
  });

  describe("start/stop loop", () => {
    it("sets running true and invokes execute in a loop", async () => {
      const agent = makeAgent();
      const executeSpy = vi.spyOn(agent, "execute").mockResolvedValue(undefined);
      const p = agent.start();
      await vi.advanceTimersByTimeAsync(1);
      expect(agent.isRunning).toBe(true);
      expect(executeSpy).toHaveBeenCalled();
      agent.stop();
      await vi.advanceTimersByTimeAsync(agent.configRef.interval * 5);
      await p;
      expect(agent.isRunning).toBe(false);
    });

    it("continues the loop after execute throws (error is swallowed)", async () => {
      const agent = makeAgent();
      const executeSpy = vi.spyOn(agent, "execute").mockRejectedValue(new Error("boom"));
      const p = agent.start();
      await vi.advanceTimersByTimeAsync(1);
      await vi.advanceTimersByTimeAsync(agent.configRef.interval * 3);
      expect(executeSpy.mock.calls.length).toBeGreaterThan(1);
      agent.stop();
      await vi.advanceTimersByTimeAsync(agent.configRef.interval);
      await p;
    });

    it("stop() sets running false immediately", async () => {
      const agent = makeAgent();
      const p = agent.start();
      await vi.advanceTimersByTimeAsync(1);
      agent.stop();
      expect(agent.isRunning).toBe(false);
      await vi.advanceTimersByTimeAsync(agent.configRef.interval);
      await p;
    });
  });

  describe("processMessages", () => {
    it("drains the queue in FIFO order", async () => {
      const agent = makeAgent();
      const m1 = makeMessage({ type: "request", payload: { n: 1 } });
      const m2 = makeMessage({ type: "alert", payload: { n: 2 } });
      const m3 = makeMessage({ type: "response", payload: { n: 3 } });
      agent.push(m1);
      agent.push(m2);
      agent.push(m3);
      expect(agent.queueLength).toBe(3);
      await agent.process();
      expect(agent.received).toEqual([m1, m2, m3]);
      expect(agent.queueLength).toBe(0);
    });

    it("is a no-op on an empty queue", async () => {
      const agent = makeAgent();
      const handleSpy = vi.spyOn(agent as any, "handleMessage");
      await agent.process();
      expect(handleSpy).not.toHaveBeenCalled();
    });
  });

  describe("receiveMessage", () => {
    it("appends messages to the queue", () => {
      const agent = makeAgent();
      const msg = makeMessage();
      agent.push(msg);
      expect(agent.queueLength).toBe(1);
      expect(agent.queue[0]).toBe(msg);
    });
  });

  describe("broadcastMessage", () => {
    it("returns a correctly-shaped AgentMessage with defaults", async () => {
      const agent = makeAgent();
      const msg = await agent.broadcast("alert", { foo: "bar" });
      expect(msg.from).toBe(agent.configRef.wallet.address);
      expect(msg.to).toBe("broadcast");
      expect(msg.type).toBe("alert");
      expect(msg.payload).toEqual({ foo: "bar" });
      expect(msg.nanopayment).toBe(1000);
      expect(msg.timestamp).toBe(TS);
    });

    it("honors an explicit nanopayment amount", async () => {
      const agent = makeAgent();
      const msg = await agent.broadcast("response", {}, 42);
      expect(msg.nanopayment).toBe(42);
    });

    it("supports all message types", async () => {
      const agent = makeAgent();
      for (const type of ["request", "response", "alert", "budget"] as const) {
        const msg = await agent.broadcast(type, {});
        expect(msg.type).toBe(type);
      }
    });

    it("handles undefined payload gracefully (no JSON.stringify crash)", async () => {
      const agent = makeAgent();
      const msg = await agent.broadcast("request", undefined as any);
      expect(msg.payload).toBeUndefined();
      expect(msg.type).toBe("request");
    });
  });

  describe("sendNanopayment", () => {
    it("returns the receipt hash on success", async () => {
      const agent = makeAgent();
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn().mockResolvedValue({
        wait: vi.fn().mockResolvedValue({ hash: "0xabc123" }),
      });
      await expect(agent.send("0xtarget", 500, "svc-id")).resolves.toBe("0xabc123");
      expect(router.executeNanopayment).toHaveBeenCalledWith("0xtarget", 500, "svc-id");
    });

    it("propagates rejection from executeNanopayment", async () => {
      const agent = makeAgent();
      (agent.routerContract as any).executeNanopayment = vi.fn().mockRejectedValue(new Error("insufficient funds"));
      await expect(agent.send("0xtarget", 500, "svc-id")).rejects.toThrow("insufficient funds");
    });

    it("propagates rejection from tx.wait()", async () => {
      const agent = makeAgent();
      (agent.routerContract as any).executeNanopayment = vi.fn().mockResolvedValue({
        wait: vi.fn().mockRejectedValue(new Error("tx reverted")),
      });
      await expect(agent.send("0xtarget", 500, "svc-id")).rejects.toThrow("tx reverted");
    });
  });

  describe("getRemainingBudget", () => {
    it("returns bigint and queries budgetManager with wallet address", async () => {
      const agent = makeAgent();
      const bm = agent.budgetContract as any;
      bm.getRemaining = vi.fn().mockResolvedValue(123456n);
      await expect(agent.remaining()).resolves.toBe(123456n);
      expect(bm.getRemaining).toHaveBeenCalledWith(agent.configRef.wallet.address);
    });
  });

  describe("spendBudget", () => {
    it("returns true and spends from budgetManager", async () => {
      const agent = makeAgent();
      const bm = agent.budgetContract as any;
      bm.spend = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) });
      await expect(agent.spend(9000)).resolves.toBe(true);
      expect(bm.spend).toHaveBeenCalledWith(agent.configRef.wallet.address, 9000);
    });
  });

  describe("getAgentInfo", () => {
    it("returns registry info for an address", async () => {
      const agent = makeAgent();
      const registry = agent.registryContract as any;
      registry.getAgentInfo = vi.fn().mockResolvedValue({ name: "Bob", active: true });
      await expect(agent.info("0xaddr")).resolves.toEqual({ name: "Bob", active: true });
      expect(registry.getAgentInfo).toHaveBeenCalledWith("0xaddr");
    });
  });

  describe("isSystemPaused", () => {
    it("delegates to riskOracle.isPaused", async () => {
      const agent = makeAgent();
      const risk = agent.riskContract as any;
      risk.isPaused = vi.fn().mockResolvedValue(true);
      await expect(agent.paused()).resolves.toBe(true);
      risk.isPaused = vi.fn().mockResolvedValue(false);
      await expect(agent.paused()).resolves.toBe(false);
    });
  });

  describe("getVaultBalance", () => {
    it("returns bigint vault balance", async () => {
      const agent = makeAgent();
      const vault = agent.vaultContract as any;
      vault.getVaultBalance = vi.fn().mockResolvedValue(999n);
      await expect(agent.balance()).resolves.toBe(999n);
    });
  });
});
