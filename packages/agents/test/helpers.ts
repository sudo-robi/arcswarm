import { vi } from "vitest";
import { ethers } from "ethers";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import type { AgentConfig } from "../src/base.js";

export const RPC_URL = "http://127.0.0.1:8545";

export function createProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export function createConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  const wallet = ethers.Wallet.createRandom();
  return {
    name: "TestAgent",
    type: "yield",
    wallet,
    contracts: CONTRACTS,
    interval: 1000,
    ...overrides,
  };
}

export function mockTx(hash = "0xhash") {
  return { wait: vi.fn().mockResolvedValue({ hash }) };
}
