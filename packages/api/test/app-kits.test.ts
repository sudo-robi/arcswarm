import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircleAppKits, createCircleAppKits } from "../src/circle/app-kits.js";

const TX_HASH = /^0x[0-9a-f]{64}$/;

describe("CircleAppKits (packages/api/src/circle/app-kits.ts)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const kits = () => new CircleAppKits({ apiKey: "test-key" });

  it("stores the config passed to the constructor", () => {
    const instance = new CircleAppKits({ apiKey: "k", entitySecret: "s" });
    expect((instance as any).config).toEqual({ apiKey: "k", entitySecret: "s" });
  });

  describe("swap", () => {
    it("returns a fake 0x-prefixed 64-hex transaction hash", async () => {
      const promise = kits().swap({
        fromToken: "USDC",
        toToken: "USDT",
        amount: "100",
        walletAddress: "0xabc",
      });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      expect(result.transactionHash).toMatch(TX_HASH);
    });

    it("hashes are hex of length 66 (0x + 64)", async () => {
      const promise = kits().swap({
        fromToken: "USDC",
        toToken: "USDC",
        amount: "0",
        walletAddress: "0xabc",
      });
      await vi.advanceTimersByTimeAsync(1000);
      const { transactionHash } = await promise;
      expect(transactionHash.startsWith("0x")).toBe(true);
      expect(transactionHash.length).toBe(66);
    });
  });

  describe("send", () => {
    it("returns a fake transaction hash", async () => {
      const promise = kits().send({
        to: "0xdest",
        amount: "50",
        token: "USDC",
        walletAddress: "0xsrc",
      });
      await vi.advanceTimersByTimeAsync(1000);
      const result = await promise;
      expect(result.transactionHash).toMatch(TX_HASH);
    });
  });

  describe("bridge", () => {
    it("returns a fake transaction hash after its delay", async () => {
      const promise = kits().bridge({
        fromChain: "ethereum",
        toChain: "base",
        amount: "10",
        walletAddress: "0xabc",
      });
      await vi.advanceTimersByTimeAsync(2000);
      const result = await promise;
      expect(result.transactionHash).toMatch(TX_HASH);
    });
  });

  describe("getUnifiedBalance", () => {
    it("returns the documented balance shape", async () => {
      const result = await kits().getUnifiedBalance({ address: "0xabc" });
      expect(result).toEqual({
        balance: "100000",
        chains: { ethereum: "50000", base: "30000", arbitrum: "20000" },
      });
    });

    it("does not require a network call (resolves immediately)", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const result = await kits().getUnifiedBalance({ address: "0xabc" });
      expect(result.balance).toBe("100000");
      spy.mockRestore();
    });
  });

  describe("createCircleAppKits", () => {
    it("returns a CircleAppKits instance using the CIRCLE_API_KEY env or mock-key", () => {
      const instance = createCircleAppKits();
      expect(instance).toBeInstanceOf(CircleAppKits);
      expect((instance as any).config.apiKey).toBe("mock-key");
    });

    it("uses CIRCLE_API_KEY when set", () => {
      const prev = process.env.CIRCLE_API_KEY;
      process.env.CIRCLE_API_KEY = "env-key";
      const instance = createCircleAppKits();
      expect((instance as any).config.apiKey).toBe("env-key");
      if (prev === undefined) delete process.env.CIRCLE_API_KEY;
      else process.env.CIRCLE_API_KEY = prev;
    });
  });

  describe("validation behavior (documented: none enforced)", () => {
    it("does not validate swap params and always succeeds (mock boundary)", async () => {
      const promise = kits().swap({} as any);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toMatchObject({ transactionHash: expect.any(String) });
    });

    it("does not validate send params and always succeeds (mock boundary)", async () => {
      const promise = kits().send({} as any);
      await vi.advanceTimersByTimeAsync(1000);
      await expect(promise).resolves.toMatchObject({ transactionHash: expect.any(String) });
    });
  });
});
