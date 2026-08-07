import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { YieldAgent } from "../src/yield.js";
import { type AgentMessage } from "../src/base.js";
import { createConfig, createProvider } from "./helpers.js";

const TS = 1704067200000;

class TestYieldAgent extends YieldAgent {
  get sources() {
    return (this as any).yieldSources;
  }
  get allocations() {
    return (this as any).currentAllocations;
  }
  set allocations(v: any) {
    (this as any).currentAllocations = v;
  }
  get lastScanValue() {
    return (this as any).lastScan;
  }
  set lastScanValue(v: number) {
    (this as any).lastScan = v;
  }
  get routerContract() {
    return this.paymentRouter;
  }

  score() {
    return (this as any).scoreYieldSources();
  }
  optimal(scored: any[]) {
    return (this as any).calculateOptimalAllocation(scored);
  }
  rebalanceDecision(optimal: any[]) {
    return (this as any).shouldRebalance(optimal);
  }
  async rebalanceNow(allocations: any[]) {
    return (this as any).rebalance(allocations);
  }
}

function makeAgent(): TestYieldAgent {
  return new TestYieldAgent(createConfig({ name: "Yield Agent", type: "yield", interval: 300_000 }), createProvider());
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

const TOTAL_BUDGET = 15_000e6;

describe("YieldAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("seeds three default yield sources", () => {
      const agent = makeAgent();
      expect(agent.sources).toHaveLength(3);
      expect(agent.sources.map((s: any) => s.name)).toEqual(["Arc AAVE", "Arc Compound", "Arc Curve"]);
      for (const s of agent.sources as any[]) {
        expect(typeof s.apy).toBe("number");
        expect(typeof s.riskScore).toBe("number");
        expect(typeof s.tvl).toBe("number");
        expect(s.address).toMatch(/^0x/);
      }
    });
  });

  describe("scoreYieldSources", () => {
    it("computes riskAdjustedReturn = apy * (1 - riskScore/100)", () => {
      const agent = makeAgent();
      const scored = agent.score();
      for (const s of scored) {
        expect(s.riskAdjustedReturn).toBeCloseTo(s.apy * (1 - s.riskScore / 100), 10);
      }
    });

    it("sorts sources by riskAdjustedReturn descending", () => {
      const agent = makeAgent();
      const scored = agent.score();
      const names = scored.map((s: any) => s.name);
      // Curve 5.1*0.75=3.825 > AAVE 4.2*0.85=3.57 > Compound 3.8*0.9=3.42
      expect(names).toEqual(["Arc Curve", "Arc AAVE", "Arc Compound"]);
      const values = scored.map((s: any) => s.riskAdjustedReturn);
      expect([...values].sort((a, b) => b - a)).toEqual(values);
    });

    it("does not mutate the input sources", () => {
      const agent = makeAgent();
      const before = agent.sources.map((s: any) => ({ ...s }));
      agent.score();
      expect(agent.sources).toEqual(before);
    });
  });

  describe("calculateOptimalAllocation", () => {
    it("returns empty array for empty input", () => {
      const agent = makeAgent();
      expect(agent.optimal([])).toEqual([]);
    });

    it("allocates by remaining budget weighted by (100-riskScore)/100", () => {
      const agent = makeAgent();
      const scored = agent.score();
      const allocs = agent.optimal(scored);

      expect(allocs).toHaveLength(2); // Curve fully funds, then AAVE; Compound skipped (budget exhausted)
      const curve = allocs[0];
      expect(curve.source).toBe("Arc Curve");
      expect(curve.amount).toBe(TOTAL_BUDGET * 0.75); // 11,250,000,000
      const aave = allocs[1];
      expect(aave.source).toBe("Arc AAVE");
      expect(aave.amount).toBe(TOTAL_BUDGET * 0.25); // 3,750,000,000
      expect(allocs.reduce((s, a) => s + a.amount, 0)).toBe(TOTAL_BUDGET);
    });

    it("never allocates more than the total budget", () => {
      const agent = makeAgent();
      const scored = Array.from({ length: 50 }, (_, i) => ({
        name: `s${i}`,
        apy: 10,
        tvl: 1,
        riskScore: 1,
        address: `0x${i}`,
        riskAdjustedReturn: 9.9,
      }));
      const allocs = agent.optimal(scored);
      const total = allocs.reduce((s, a) => s + a.amount, 0);
      expect(total).toBe(TOTAL_BUDGET);
      expect(allocs.length).toBeLessThanOrEqual(50);
    });

    it("assigns zero amount for riskScore 100 sources", () => {
      const agent = makeAgent();
      const scored = [
        { name: "safe", apy: 5, tvl: 1, riskScore: 10, address: "0x1", riskAdjustedReturn: 4.5 },
        { name: "toxic", apy: 50, tvl: 1, riskScore: 100, address: "0x2", riskAdjustedReturn: 0 },
      ];
      const allocs = agent.optimal(scored);
      const toxic = allocs.find((a) => a.source === "toxic");
      expect(toxic.amount).toBe(0);
    });

    it("carries riskAdjustedReturn into the allocation", () => {
      const agent = makeAgent();
      const allocs = agent.optimal(agent.score());
      expect(allocs[0].riskAdjustedReturn).toBeCloseTo(3.825, 10);
    });
  });

  describe("shouldRebalance", () => {
    const opt = [{ source: "a", amount: 1000, apy: 5, riskAdjustedReturn: 4 }];

    it("returns true when there are no current allocations", () => {
      const agent = makeAgent();
      expect(agent.rebalanceDecision(opt)).toBe(true);
    });

    it("returns true when a target source is missing from current allocations", () => {
      const agent = makeAgent();
      agent.allocations = [{ source: "other", amount: 500, apy: 5, riskAdjustedReturn: 4 }];
      expect(agent.rebalanceDecision(opt)).toBe(true);
    });

    it("returns true when drift exceeds 5%", () => {
      const agent = makeAgent();
      agent.allocations = [{ source: "a", amount: 1051, apy: 5, riskAdjustedReturn: 4 }];
      expect(agent.rebalanceDecision(opt)).toBe(true);
    });

    it("returns false when drift is exactly 5% (boundary)", () => {
      const agent = makeAgent();
      agent.allocations = [{ source: "a", amount: 1050, apy: 5, riskAdjustedReturn: 4 }];
      expect(agent.rebalanceDecision(opt)).toBe(false);
    });

    it("returns false when current matches optimal", () => {
      const agent = makeAgent();
      agent.allocations = [{ source: "a", amount: 1000, apy: 5, riskAdjustedReturn: 4 }];
      expect(agent.rebalanceDecision(opt)).toBe(false);
    });

    it("handles zero optimal amount (division by zero) by triggering rebalance", () => {
      const agent = makeAgent();
      agent.allocations = [{ source: "a", amount: 500, apy: 5, riskAdjustedReturn: 4 }];
      expect(agent.rebalanceDecision([{ source: "a", amount: 0, apy: 5, riskAdjustedReturn: 4 }])).toBe(true);
      agent.allocations = [{ source: "a", amount: 0, apy: 5, riskAdjustedReturn: 4 }];
      // When optimal amount is 0, we treat it as a signal to rebalance (avoid division by zero)
      expect(agent.rebalanceDecision([{ source: "a", amount: 0, apy: 5, riskAdjustedReturn: 4 }])).toBe(true);
    });
  });

  describe("rebalance", () => {
    it("sets currentAllocations to the new allocations", async () => {
      const agent = makeAgent();
      const allocs = agent.optimal(agent.score());
      await agent.rebalanceNow(allocs);
      expect(agent.allocations).toEqual(allocs);
    });
  });

  describe("execute", () => {
    it("throttles scans by scanInterval", async () => {
      const agent = makeAgent();
      agent.lastScanValue = TS;
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
    });

    it("runs a scan, rebalances, pays risk agent, and broadcasts completion", async () => {
      const agent = makeAgent();
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.execute();

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xRISK_AGENT", 1000, "validate-yield-sources");
      expect(broadcastSpy).toHaveBeenCalledWith("response", {
        action: "rebalance_complete",
        allocations: agent.allocations,
        totalDeployed: agent.allocations.reduce((s: number, a: any) => s + a.amount, 0),
      });
      expect(agent.allocations.length).toBeGreaterThan(0);
    });

    it("does not rebalance when allocations are already optimal", async () => {
      const agent = makeAgent();
      agent.allocations = agent.optimal(agent.score());
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.execute();

      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });

  describe("handleMessage", () => {
    it("responds to getAllocations request with current allocations", async () => {
      const agent = makeAgent();
      agent.allocations = [{ source: "a", amount: 1000, apy: 5, riskAdjustedReturn: 4 }];
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.handleMessage(msg({ type: "request", from: "0xother", payload: { action: "getAllocations" } }));

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xother", 1000, "allocation-data");
      expect(broadcastSpy).toHaveBeenCalledWith("response", { allocations: agent.allocations });
    });

    it("ignores unknown request actions without side effects", async () => {
      const agent = makeAgent();
      const router = agent.routerContract as any;
      router.executeNanopayment = vi.fn();
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.handleMessage(msg({ type: "request", payload: { action: "nope" } }));

      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("logs alerts without throwing", async () => {
      const agent = makeAgent();
      await expect(agent.handleMessage(msg({ type: "alert", payload: { severity: "high" } }))).resolves.toBeUndefined();
    });
  });
});
