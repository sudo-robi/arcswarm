import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { LiquidityAgent } from "../src/liquidity.js";
import { type AgentMessage } from "../src/base.js";
import { createConfig, createProvider } from "./helpers.js";

const TS = 1704067200000;
const FORECAST_USDC = 5_000; // 5,000 USDC (from 5_000e6 base units / 1e6)
const OPTIMAL_BUFFER = Math.round(FORECAST_USDC * 1.2); // 6,000 USDC

class TestLiquidityAgent extends LiquidityAgent {
  set lastScanValue(v: number) {
    (this as any).lastScan = v;
  }
  get routerContract() {
    return this.paymentRouter;
  }
  get vaultContract() {
    return this.vault;
  }
  forecast() {
    return (this as any).getPaymentForecast();
  }
}

function makeAgent(): TestLiquidityAgent {
  return new TestLiquidityAgent(
    createConfig({ name: "Liquidity Agent", type: "liquidity", interval: 3_600_000 }),
    createProvider()
  );
}

function mockRouter(agent: TestLiquidityAgent) {
  const router = agent.routerContract as any;
  router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
  return router;
}

function mockVaultBalance(agent: TestLiquidityAgent, balance: bigint) {
  (agent.vaultContract as any).getVaultBalance = vi.fn().mockResolvedValue(balance);
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

describe("LiquidityAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getPaymentForecast", () => {
    it("returns the simulated 7-day forecast of 5,000 USDC (in base units)", async () => {
      const agent = makeAgent();
      await expect(agent.forecast()).resolves.toBe(5_000e6);
    });
  });

  describe("execute", () => {
    it("throttles scans by scanInterval", async () => {
      const agent = makeAgent();
      agent.lastScanValue = TS;
      const router = mockRouter(agent);
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
    });

    it("requests liquidity from Yield Agent when buffer is below optimal", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      // 1,000 USDC vault -> currentBuffer = 150 USDC (below 6,000 optimal)
      mockVaultBalance(agent, 1_000e6);
      await agent.execute();

      const calls = router.executeNanopayment.mock.calls;
      expect(calls).toHaveLength(2);
      expect(calls[0]).toEqual(["0xYIELD_AGENT", 1000, `need-liquidity-${OPTIMAL_BUFFER - 150}`]);
      expect(calls[1]).toEqual(["0xCOORDINATOR", 1000, "budget-confirmation"]);
    });

    it("deploys excess to Yield Agent when buffer is 1.5x above optimal", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      // 1e9 USDC vault -> currentBuffer = 150,000,000 USDC (well above 1.5x optimal = 9,000)
      mockVaultBalance(agent, 1_000_000_000_000_000n);
      await agent.execute();

      const calls = router.executeNanopayment.mock.calls;
      expect(calls).toHaveLength(2);
      const excess = 150_000_000 - OPTIMAL_BUFFER; // currentBuffer - optimalBuffer
      expect(calls[0]).toEqual(["0xYIELD_AGENT", 1000, `deploy-excess-${excess}`]);
      expect(calls[1]).toEqual(["0xCOORDINATOR", 1000, "budget-confirmation"]);
    });

    it("only confirms budget when buffer is inside the target range", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      // 50,000 USDC vault -> currentBuffer = 7,500 USDC (between 6,000 and 9,000)
      mockVaultBalance(agent, 50_000_000_000n);
      await agent.execute();

      const calls = router.executeNanopayment.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(["0xCOORDINATOR", 1000, "budget-confirmation"]);
    });

    it("skips yield notification at the exact high boundary", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      // 60,000 USDC vault -> currentBuffer = 9,000 USDC (exactly 1.5x optimal)
      mockVaultBalance(agent, 60_000_000_000n);
      await agent.execute();

      const calls = router.executeNanopayment.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual(["0xCOORDINATOR", 1000, "budget-confirmation"]);
    });
  });

  describe("handleMessage", () => {
    it("responds to getForecast request with the payment forecast", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      await agent.handleMessage(msg({ type: "request", from: "0xother", payload: { action: "getForecast" } }));

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xother", 1000, "forecast-data");
      expect(broadcastSpy).toHaveBeenCalledWith("response", { action: "paymentForecast", forecast: 5_000e6 });
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