import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PaymentAgent } from "../src/payment.js";
import { type AgentMessage } from "../src/base.js";
import { createConfig, createProvider } from "./helpers.js";

const TS = 1704067200000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

class TestPaymentAgent extends PaymentAgent {
  set lastProcessValue(v: number) {
    (this as any).lastProcess = v;
  }
  get schedules() {
    return (this as any).scheduledPayments;
  }
  get routerContract() {
    return this.paymentRouter;
  }
  get budgetContract() {
    return this.budgetManager;
  }
  batch(payments: any[]) {
    return (this as any).batchPayments(payments);
  }
  execBatch(batch: any) {
    return (this as any).executeBatch(batch);
  }
  add(p: any) {
    return this.addScheduledPayment(p);
  }
  forecast() {
    return this.get7DayForecast();
  }
}

function makeAgent(): TestPaymentAgent {
  return new TestPaymentAgent(createConfig({ name: "Payment Agent", type: "payment", interval: 60_000 }), createProvider());
}

function mockRouter(agent: TestPaymentAgent) {
  const router = agent.routerContract as any;
  router.executeNanopayment = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
  return router;
}

function mockBudget(agent: TestPaymentAgent) {
  const bm = agent.budgetContract as any;
  bm.spend = vi.fn().mockResolvedValue({ wait: vi.fn().mockResolvedValue({}) });
  return bm;
}

function payment(partial: Partial<any> = {}): any {
  return {
    id: `p-${Math.random()}`,
    recipient: "0xpayee",
    amount: 5000,
    memo: "memo",
    scheduledTime: TS - 1000,
    recurring: false,
    executed: false,
    ...partial,
  };
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

describe("PaymentAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(TS);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("addScheduledPayment", () => {
    it("stores a payment with executed=false", () => {
      const agent = makeAgent();
      const p = payment({ id: "abc" });
      agent.add(p);
      expect(agent.schedules).toHaveLength(1);
      expect(agent.schedules[0]).toEqual({ ...p, executed: false });
    });
  });

  describe("batchPayments", () => {
    it("returns an empty array for no payments", () => {
      const agent = makeAgent();
      expect(agent.batch([])).toEqual([]);
    });

    it("chunks payments into batches of 10", () => {
      const agent = makeAgent();
      const payments = Array.from({ length: 25 }, (_, i) => payment({ id: `p${i}`, amount: 100 }));
      const batches = agent.batch(payments);
      expect(batches).toHaveLength(3);
      expect(batches[0].payments).toHaveLength(10);
      expect(batches[1].payments).toHaveLength(10);
      expect(batches[2].payments).toHaveLength(5);
    });

    it("sums totalAmount per batch", () => {
      const agent = makeAgent();
      const payments = Array.from({ length: 3 }, (_, i) => payment({ id: `p${i}`, amount: (i + 1) * 1000 }));
      const [batch] = agent.batch(payments);
      expect(batch.totalAmount).toBe(6000);
    });

    it("stamps scheduledExecution with Date.now()", () => {
      const agent = makeAgent();
      const [batch] = agent.batch([payment()]);
      expect(batch.scheduledExecution).toBe(TS);
    });
  });

  describe("get7DayForecast", () => {
    it("sums payments scheduled within the next 7 days, inclusive of the boundary", () => {
      const agent = makeAgent();
      agent.add(payment({ id: "in", amount: 100, scheduledTime: TS + 1000 }));
      agent.add(payment({ id: "boundary", amount: 200, scheduledTime: TS + WEEK_MS }));
      agent.add(payment({ id: "out", amount: 400, scheduledTime: TS + WEEK_MS + 1 }));
      expect(agent.forecast()).toBe(300);
    });

    it("returns 0 when nothing is scheduled", () => {
      const agent = makeAgent();
      expect(agent.forecast()).toBe(0);
    });

    it("counts already-executed payments too", () => {
      const agent = makeAgent();
      agent.add(payment({ id: "exec", amount: 50, scheduledTime: TS + 1000, executed: true }));
      expect(agent.forecast()).toBe(50);
    });
  });

  describe("executeBatch", () => {
    it("uses nanopayments for payments <= 10,000 base units", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      const bm = mockBudget(agent);
      const p = payment({ id: "small", amount: 5000 });
      await agent.execBatch({ payments: [p], totalAmount: 5000, scheduledExecution: TS });

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xpayee", 5000, "memo");
      expect(bm.spend).toHaveBeenCalledWith(expect.any(String), 5000);
      expect(p.executed).toBe(true);
    });

    it("uses nanopayments at exactly the 10,000 boundary", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      mockBudget(agent);
      const p = payment({ id: "boundary", amount: 10000 });
      await agent.execBatch({ payments: [p], totalAmount: 10000, scheduledExecution: TS });
      expect(router.executeNanopayment).toHaveBeenCalledWith("0xpayee", 10000, "memo");
    });

    it("broadcasts a request for payments above 10,000", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      const bm = mockBudget(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      const p = payment({ id: "big", amount: 10001, recipient: "0xbig" });
      await agent.execBatch({ payments: [p], totalAmount: 10001, scheduledExecution: TS });

      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).toHaveBeenCalledWith("request", {
        action: "executePayment",
        to: "0xbig",
        amount: 10001,
        memo: "memo",
      });
      expect(bm.spend).toHaveBeenCalledWith(expect.any(String), 10001);
      expect(p.executed).toBe(true);
    });

    it("marks recurring payments as not executed and reschedules them", async () => {
      const agent = makeAgent();
      mockRouter(agent);
      mockBudget(agent);
      const p = payment({ id: "rec", amount: 1000, recurring: true, interval: 60_000 });
      await agent.execBatch({ payments: [p], totalAmount: 1000, scheduledExecution: TS });
      expect(p.executed).toBe(false);
      expect(p.scheduledTime).toBe(TS + 60_000);
    });

    it("swallows errors and does not mark the payment executed", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      router.executeNanopayment = vi.fn().mockRejectedValue(new Error("reverted"));
      const bm = mockBudget(agent);
      const p = payment({ id: "fail", amount: 1000 });
      await agent.execBatch({ payments: [p], totalAmount: 1000, scheduledExecution: TS });
      expect(p.executed).toBe(false);
      expect(bm.spend).not.toHaveBeenCalled();
    });

    it("continues with the next payment when one fails", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      mockBudget(agent);
      const fail = payment({ id: "fail", amount: 1000 });
      const ok = payment({ id: "ok", amount: 1000 });
      router.executeNanopayment
        .mockRejectedValueOnce(new Error("boom"))
        .mockResolvedValueOnce({ wait: vi.fn().mockResolvedValue({ hash: "0x" }) });
      await agent.execBatch({ payments: [fail, ok], totalAmount: 2000, scheduledExecution: TS });
      expect(fail.executed).toBe(false);
      expect(ok.executed).toBe(true);
    });
  });

  describe("execute", () => {
    it("throttles processing by processInterval", async () => {
      const agent = makeAgent();
      agent.lastProcessValue = TS;
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("does nothing when no payments are due", async () => {
      const agent = makeAgent();
      agent.add(payment({ id: "future", scheduledTime: TS + 60_000 }));
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      await agent.execute();
      expect(router.executeNanopayment).not.toHaveBeenCalled();
      expect(broadcastSpy).not.toHaveBeenCalled();
    });

    it("reserves liquidity, executes due payments, and broadcasts a summary", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      mockBudget(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);

      agent.add(payment({ id: "a", amount: 4000, recipient: "0xa" }));
      agent.add(payment({ id: "b", amount: 6000, recipient: "0xb" }));

      await agent.execute();

      // reserve-need first, then per-payment nanopayments
      expect(router.executeNanopayment.mock.calls[0]).toEqual(["0xLIQUIDITY_AGENT", 1000, "reserve-need-10000"]);
      expect(router.executeNanopayment).toHaveBeenCalledWith("0xa", 4000, "memo");
      expect(router.executeNanopayment).toHaveBeenCalledWith("0xb", 6000, "memo");
      expect(broadcastSpy).toHaveBeenCalledWith("response", {
        action: "paymentsProcessed",
        count: 2,
        totalAmount: 10000,
      });
    });

    it("processes >10 due payments across multiple batches", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      mockBudget(agent);
      for (let i = 0; i < 12; i++) {
        agent.add(payment({ id: `p${i}`, amount: 1000, recipient: `0xr${i}` }));
      }
      await agent.execute();
      // 1 reserve + 12 nanopayments = 13 total
      expect(router.executeNanopayment).toHaveBeenCalledTimes(13);
      expect(router.executeNanopayment.mock.calls[0][0]).toBe("0xLIQUIDITY_AGENT");
    });
  });

  describe("handleMessage", () => {
    it("adds a payment on addPayment request and confirms via nanopayment", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      const p = payment({ id: "new" });
      await agent.handleMessage(msg({ type: "request", from: "0xfrom", payload: { action: "addPayment", payment: p } }));
      expect(agent.schedules).toHaveLength(1);
      expect(router.executeNanopayment).toHaveBeenCalledWith("0xfrom", 1000, "payment-confirmed");
    });

    it("responds to getForecast with the 7-day forecast", async () => {
      const agent = makeAgent();
      const router = mockRouter(agent);
      const broadcastSpy = vi.spyOn(agent as any, "broadcastMessage").mockResolvedValue({} as any);
      agent.add(payment({ id: "in", amount: 1234, scheduledTime: TS + 1000 }));

      await agent.handleMessage(msg({ type: "request", from: "0xfrom", payload: { action: "getForecast" } }));

      expect(router.executeNanopayment).toHaveBeenCalledWith("0xfrom", 1000, "forecast-data");
      expect(broadcastSpy).toHaveBeenCalledWith("response", { action: "paymentForecast", forecast: 1234 });
    });

    it("logs alerts without throwing", async () => {
      const agent = makeAgent();
      await expect(agent.handleMessage(msg({ type: "alert", payload: { severity: "critical" } }))).resolves.toBeUndefined();
    });
  });
});
