import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FXAgent } from "../src/fx.js";
import { type AgentMessage } from "../src/base.js";
import { createConfig, createProvider } from "./helpers.js";

const TS = 1704067200000;

class TestFXAgent extends FXAgent {
  set lastScanValue(v: number) {
    (this as any).lastScan = v;
  }
  get routerContract() {
    return this.paymentRouter;
  }
  get ratesMap() {
    return (this as any).rates;
  }
  rate() {
    return (this as any).fetchEURCRate();
  }
}

function makeAgent(): TestFXAgent {
  return new TestFXAgent(createConfig({ name: "FX Agent", type: "fx", interval: 600_000 }), createProvider());
}

function mockRouter(agent: TestFXAgent) {
  const router = agent.routerContract as any;
  router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
  return router;
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

describe("FXAgent", () => {
  let randomSpy: any;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
    randomSpy = vi.spyOn(Math, "random");
  });
  afterEach(() => {
    randomSpy.mockRestore();
    vi.useRealTimers();
  });

  describe("fetchEURCRate", () => {
    it.each([
      [0, 0.999], // rate -0.1%
      [1, 1.001], // rate +0.1%
      [0.5, 1.0], // exactly parity
    ])("Math.random()=%f yields rate %f", async (r, expected) => {
      randomSpy.mockReturnValue(r);
      const agent = makeAgent();
      await expect(agent.rate()).resolves.toBeCloseTo(expected, 10);
    });

    it("never deviates more than ±0.001 from parity", async () => {
      const agent = makeAgent();
      for (let i = 0; i < 20; i++) {
        randomSpy.mockReturnValue(i / 20);
        const r = await agent.rate();
        expect(Math.abs(r - 1.0)).toBeLessThanOrEqual(0.001 + 1e-9);
      }
    });
  });

  describe("execute", () => {
    it("throttles scans by scanInterval", async () => {
      const agent = makeAgent();
      agent.lastScanValue = TS;
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("flags an arbitrage opportunity when spread > 0.001 and validates with Risk Agent", async () => {
      const agent = makeAgent();
      (agent as any).fetchEURCRate = vi.fn().mockResolvedValue(1.002);
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.execute();

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xRISK_AGENT", 1000, "fx-risk-check-eurc");
      expect(broadcastSpy).toHaveBeenCalledWith("response", {
        action: "fxScan",
        rates: Object.fromEntries(agent.ratesMap),
      });
    });

    it("flags arbitrage on the downside (rate below parity)", async () => {
      const agent = makeAgent();
      (agent as any).fetchEURCRate = vi.fn().mockResolvedValue(0.998);
      const router = mockRouter(agent);
      await agent.execute();
      expect(router.executeNanopayment).toHaveBeenCalledWith("0xRISK_AGENT", 1000, "fx-risk-check-eurc");
    });

    it("does not flag arbitrage when spread is within 0.1%", async () => {
      const agent = makeAgent();
      (agent as any).fetchEURCRate = vi.fn().mockResolvedValue(1.0005);
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).toHaveBeenCalled();
    });

    it("does not flag arbitrage just below the 0.1% threshold (strict >)", async () => {
      const agent = makeAgent();
      (agent as any).fetchEURCRate = vi.fn().mockResolvedValue(1.000999);
      const router = mockRouter(agent);
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
    });

    it("flags arbitrage just above the 0.1% threshold", async () => {
      const agent = makeAgent();
      (agent as any).fetchEURCRate = vi.fn().mockResolvedValue(1.001001);
      const router = mockRouter(agent);
      await agent.execute();
      expect(router.executeNanopayment).toHaveBeenCalledWith("0xRISK_AGENT", 1000, "fx-risk-check-eurc");
    });

    it("handles parity rate with no arbitrage", async () => {
      const agent = makeAgent();
      (agent as any).fetchEURCRate = vi.fn().mockResolvedValue(1.0);
      const router = mockRouter(agent);
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
    });
  });

  describe("handleMessage", () => {
    it("responds to getRates request with rates and a nanopayment", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.handleMessage(msg({ type: "request", from: "0xother", payload: { action: "getRates" } }));

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xother", 1000, "fx-rates");
      expect(broadcastSpy).toHaveBeenCalledWith("response", { rates: Object.fromEntries(agent.ratesMap) });
    });

    it("ignores unknown actions", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.handleMessage(msg({ type: "request", payload: { action: "nope" } }));
      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });
  });
});
