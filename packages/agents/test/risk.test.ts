import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ethers } from "ethers";
import { RiskAgent } from "../src/risk.js";
import { type AgentMessage } from "../src/base.js";
import { createConfig, createProvider } from "./helpers.js";

const TS = 1704067200000;

class TestRiskAgent extends RiskAgent {
  get threatList() {
    return (this as any).threats;
  }
  set statuses(v: any) {
    (this as any).agentStatuses = v;
  }
  get alertList() {
    return (this as any).alerts;
  }
  get budgetContract() {
    return this.budgetManager;
  }
  get riskContract() {
    return this.riskOracle;
  }
  get routerContract() {
    return this.paymentRouter;
  }

  score(walletHealth: number, yieldHealth: any, anomalies: string[]) {
    return (this as any).calculateRiskScore(walletHealth, yieldHealth, anomalies);
  }
  async anomalies() {
    return (this as any).detectAnomalies();
  }
  makeAlert(severity: any, type: string, message: string) {
    return (this as any).createAlert(severity, type, message);
  }
  async walletHealth() {
    return (this as any).checkAgentWallets();
  }
  async yieldHealth() {
    return (this as any).checkYieldSources();
  }
  async cb(riskScore: number) {
    return (this as any).triggerCircuitBreaker(riskScore);
  }
}

function makeAgent(): TestRiskAgent {
  return new TestRiskAgent(createConfig({ name: "Risk Agent", type: "risk", interval: 60_000 }), createProvider());
}

function mockRiskOracle(agent: TestRiskAgent) {
  const risk = agent.riskContract as any;
  risk.updateMetrics = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
  return risk;
}

function msg(partial: Partial<AgentMessage> = {}): AgentMessage {
  return {
    from: "0xfrom",
    to: "broadcast",
    type: "request",
    payload: {},
    nanopayment: 1000,
    timestamp: TS,
    ...partial,
  };
}

describe("RiskAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("threat signatures", () => {
    it("initializes the three expected threat signatures", () => {
      const agent = makeAgent();
      const names = agent.threatList.map((t: any) => t.name);
      expect(names).toEqual(["rapid_drawdown", "concentration_risk", "unusual_outflow"]);
      const rapid = agent.threatList.find((t: any) => t.name === "rapid_drawdown");
      expect(rapid.threshold).toBe(5);
      expect(rapid.window).toBe(300_000);
      const concentration = agent.threatList.find((t: any) => t.name === "concentration_risk");
      expect(concentration.threshold).toBe(30);
      const outflow = agent.threatList.find((t: any) => t.name === "unusual_outflow");
      expect(outflow.threshold).toBe(10);
    });
  });

  describe("calculateRiskScore", () => {
    it.each([
      // [walletHealth, yieldHealth, anomalies, expected]
      [100, 0, [], 0],
      [0, 0, [], 30],
      [100, 5, [], 50],
      [100, 0, ["a", "b", "c"], 40],
      [0, 0, ["a", "b", "c"], 70],
      [0, 5, ["a", "b", "c"], 100], // 30 + 50 + 40 = 120 -> capped at 100
      [100, 0, ["a"], 20],
      [100, 0, ["a", "b", "c", "d"], 40], // anomaly term capped at 40
      [67, 0.25, [], 12], // (100-67)*0.3 + 2.5 = 12.4 -> rounds to 12
      [100, 0.333, [], 3], // 3.33 -> rounds to 3
    ])(
      "score(walletHealth=%i, drawdown=%i, anomalies=%j) = %i",
      (walletHealth, drawdown, anomalies, expected) => {
        const agent = makeAgent();
        expect(agent.score(walletHealth, { totalExposure: 0, drawdown }, anomalies)).toBe(expected);
      }
    );

    it("never exceeds 100", () => {
      const agent = makeAgent();
      expect(agent.score(0, { totalExposure: 0, drawdown: 10 }, ["a", "b", "c"])).toBeLessThanOrEqual(100);
    });

    it("is always a non-negative integer", () => {
      const agent = makeAgent();
      for (const wh of [0, 33, 67, 100]) {
        for (const dd of [0, 0.5, 1.5, 5]) {
          const s = agent.score(wh, { totalExposure: 0, drawdown: dd }, []);
          expect(Number.isInteger(s)).toBe(true);
          expect(s).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe("detectAnomalies", () => {
    it("resets counts when the detection window has elapsed", async () => {
      const agent = makeAgent();
      const rapid = agent.threatList.find((t: any) => t.name === "rapid_drawdown");
      rapid.lastSeen = TS - 400_000; // beyond 300s window
      rapid.count = 10;
      const anomalies = await agent.anomalies();
      expect(anomalies).toEqual([]);
      expect(rapid.count).toBe(0);
    });

    it("does not flag when count equals the threshold (strict >)", async () => {
      const agent = makeAgent();
      const rapid = agent.threatList.find((t: any) => t.name === "rapid_drawdown");
      rapid.lastSeen = TS;
      rapid.count = 5;
      const anomalies = await agent.anomalies();
      expect(anomalies).toEqual([]);
    });

    it("flags anomalies when count exceeds the threshold and creates a high alert", async () => {
      const agent = makeAgent();
      const rapid = agent.threatList.find((t: any) => t.name === "rapid_drawdown");
      rapid.lastSeen = TS;
      rapid.count = 6;
      const anomalies = await agent.anomalies();
      expect(anomalies).toEqual(["rapid_drawdown"]);
      expect(agent.alertList).toHaveLength(1);
      const alert = agent.alertList[0];
      expect(alert.severity).toBe("high");
      expect(alert.type).toBe("rapid_drawdown");
      expect(alert.resolved).toBe(false);
    });

    it("flags every signature whose count exceeds its threshold", async () => {
      const agent = makeAgent();
      const now = TS;
      for (const t of agent.threatList) {
        t.lastSeen = now;
        t.count = t.threshold + 1;
      }
      const anomalies = await agent.anomalies();
      expect(anomalies).toEqual(["rapid_drawdown", "concentration_risk", "unusual_outflow"]);
      expect(agent.alertList).toHaveLength(3);
    });
  });

  describe("createAlert", () => {
    it("assigns an id based on the timestamp and stores unresolved alerts", () => {
      const agent = makeAgent();
      agent.makeAlert("medium", "some_risk", "something");
      expect(agent.alertList).toHaveLength(1);
      expect(agent.alertList[0].id).toBe(`alert-${TS}`);
      expect(agent.alertList[0].severity).toBe("medium");
      expect(agent.alertList[0].type).toBe("some_risk");
      expect(agent.alertList[0].message).toBe("something");
      expect(agent.alertList[0].timestamp).toBe(TS);
      expect(agent.alertList[0].resolved).toBe(false);
    });

    it("broadcasts an alert message for high severity", () => {
      const agent = makeAgent();
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      agent.makeAlert("high", "concentration_risk", "concentration exceeded");
      expect(broadcastSpy).toHaveBeenCalledWith("alert", {
        alertId: `alert-${TS}`,
        severity: "high",
        type: "concentration_risk",
        message: "concentration exceeded",
      });
    });

    it("broadcasts an alert message for critical severity", () => {
      const agent = makeAgent();
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      agent.makeAlert("critical", "circuit_breaker", "danger");
      expect(broadcastSpy).toHaveBeenCalled();
    });

    it("does not broadcast for low/medium severity", () => {
      const agent = makeAgent();
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      agent.makeAlert("low", "minor", "nothing");
      agent.makeAlert("medium", "warning", "something");
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });

  describe("triggerCircuitBreaker", () => {
    it("creates a critical alert and broadcasts circuitBreakerTriggered", async () => {
      const agent = makeAgent();
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.cb(95);
      expect(agent.alertList).toHaveLength(1);
      expect(agent.alertList[0].severity).toBe("critical");
      expect(agent.alertList[0].type).toBe("circuit_breaker");
      expect(broadcastSpy).toHaveBeenCalledWith("alert", {
        action: "circuitBreakerTriggered",
        riskScore: 95,
        timestamp: TS,
      });
    });
  });

  describe("checkAgentWallets", () => {
    it("averages 100 per healthy wallet across the four agent types", async () => {
      const agent = makeAgent();
      agent.statuses = new Map([
        ["yield", { wallet: "0xa" }],
        ["liquidity", { wallet: "0xb" }],
        ["fx", { wallet: "0xc" }],
        ["payment", { wallet: "0xd" }],
      ]);
      const bm = agent.budgetContract as any;
      bm.getRemaining = vi.fn().mockImplementation((addr: string) => {
        if (addr === "0xa" || addr === "0xb") return Promise.resolve(100n);
        return Promise.resolve(0n);
      });
      await expect(agent.walletHealth()).resolves.toBe(50);
    });

    it("returns 0 when all wallets have no remaining budget", async () => {
      const agent = makeAgent();
      agent.statuses = new Map([
        ["yield", { wallet: "0xa" }],
        ["liquidity", { wallet: "0xb" }],
      ]);
      (agent.budgetContract as any).getRemaining = vi.fn().mockResolvedValue(0n);
      await expect(agent.walletHealth()).resolves.toBe(0);
    });

    it("returns 0 when no agent statuses are tracked", async () => {
      const agent = makeAgent();
      await expect(agent.walletHealth()).resolves.toBe(0);
    });

    it("treats a getRemaining rejection as an unhealthy wallet", async () => {
      const agent = makeAgent();
      agent.statuses = new Map([
        ["yield", { wallet: "0xa" }],
        ["fx", { wallet: "0xc" }],
      ]);
      (agent.budgetContract as any).getRemaining = vi.fn().mockRejectedValue(new Error("rpc"));
      await expect(agent.walletHealth()).resolves.toBe(0);
    });
  });

  describe("checkYieldSources", () => {
    it("returns the simulated exposure and drawdown", async () => {
      const agent = makeAgent();
      await expect(agent.yieldHealth()).resolves.toEqual({ totalExposure: 50_000e6, drawdown: 1.5 });
    });
  });

  describe("execute", () => {
    it("throttles scans by scanInterval", async () => {
      const agent = makeAgent();
      (agent as any).lastScan = TS;
      const risk = mockRiskOracle(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.execute();
      expect(risk.updateMetrics).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("updates RiskOracle metrics and broadcasts riskStatus", async () => {
      const agent = makeAgent();
      const risk = mockRiskOracle(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.execute();

      // walletHealth 0 (no statuses) + drawdown 1.5*10 = 45
      expect(risk.updateMetrics).toHaveBeenCalledWith(ethers.parseUnits("50000000000", 6), 15000);
      expect(broadcastSpy).toHaveBeenCalledWith("response", {
        action: "riskStatus",
        riskScore: 45,
        alerts: 0,
        walletHealth: 0,
        yieldHealth: { totalExposure: 50_000e6, drawdown: 1.5 },
      });
    });

    it("triggers the circuit breaker when riskScore >= 80", async () => {
      const agent = makeAgent();
      const risk = mockRiskOracle(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      // force two anomalies -> +40, so score = 30 + 15 + 40 = 85
      for (const t of agent.threatList) {
        t.lastSeen = TS;
        t.count = t.threshold + 1;
      }

      await agent.execute();

      expect(risk.updateMetrics).toHaveBeenCalled();
      // circuitBreakerTriggered broadcast
      expect(broadcastSpy).toHaveBeenCalledWith("alert", {
        action: "circuitBreakerTriggered",
        riskScore: 85,
        timestamp: TS,
      });
      expect(agent.alertList.some((a: any) => a.type === "circuit_breaker")).toBe(true);
      // riskStatus broadcast also emitted
      expect(broadcastSpy).toHaveBeenCalledWith(
        "response",
        expect.objectContaining({ action: "riskStatus", riskScore: 85 })
      );
    });

    it("does not trip the breaker below the threshold but still broadcasts status", async () => {
      const agent = makeAgent();
      const risk = mockRiskOracle(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      (agent as any).threats.forEach((t: any) => {
        t.lastSeen = TS;
        t.count = 0;
      });
      await agent.execute();
      expect(risk.updateMetrics).toHaveBeenCalled();
      expect(broadcastSpy).toHaveBeenCalledWith("response", expect.objectContaining({ action: "riskStatus" }));
      expect(broadcastSpy).not.toHaveBeenCalledWith("alert", expect.objectContaining({ action: "circuitBreakerTriggered" }));
    });

    it("continues when updateMetrics fails (error swallowed)", async () => {
      const agent = makeAgent();
      const risk = agent.riskContract as any;
      risk.updateMetrics = vi.fn().mockRejectedValue(new Error("rpc down"));
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await expect(agent.execute()).resolves.toBeUndefined();
      expect(broadcastSpy).toHaveBeenCalledWith("response", expect.objectContaining({ action: "riskStatus" }));
    });
  });

  describe("handleMessage", () => {
    it("validates yield sources and replies with a nanopayment", async () => {
      const agent = makeAgent();
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.handleMessage(
        msg({ type: "request", from: "0xcaller", payload: { action: "validateYieldSource", source: "Arc AAVE" } })
      );

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xcaller", 1000, "validation-result");
      expect(broadcastSpy).toHaveBeenCalledWith("response", {
        action: "validationResult",
        source: "Arc AAVE",
        valid: true,
      });
    });

    it("assesses FX risk and replies with a nanopayment", async () => {
      const agent = makeAgent();
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.handleMessage(msg({ type: "request", from: "0xcaller", payload: { action: "checkFxRisk", pair: "USDC/EURC" } }));

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xcaller", 1000, "fx-risk-assessment");
      expect(broadcastSpy).toHaveBeenCalledWith("response", {
        action: "fxRiskAssessment",
        pair: "USDC/EURC",
        risk: 25,
      });
    });

    it("ignores unknown request actions", async () => {
      const agent = makeAgent();
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn();
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.handleMessage(msg({ type: "request", payload: { action: "nope" } }));
      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("logs riskStatus responses without throwing", async () => {
      const agent = makeAgent();
      await expect(
        agent.handleMessage(msg({ type: "response", payload: { action: "riskStatus", riskScore: 12 } }))
      ).resolves.toBeUndefined();
    });
  });
});
