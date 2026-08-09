import { describe, it, expect } from "vitest";
import {
  ARC_TESTNET,
  CONTRACTS,
  VAULT_ABI,
  AGENT_REGISTRY_ABI,
  BUDGET_MANAGER_ABI,
  RISK_ORACLE_ABI,
  PAYMENT_ROUTER_ABI,
  AGENT_TYPES,
} from "../src/index.js";

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

describe("shared contracts (packages/shared/src/contracts.ts)", () => {
  describe("ARC_TESTNET", () => {
    it("exposes the Arc testnet chain id, rpc url, and USDC address", () => {
      expect(ARC_TESTNET.chainId).toBe(5042002);
      expect(ARC_TESTNET.rpcUrl).toMatch(/^https:\/\//);
      expect(ARC_TESTNET.usdcAddress).toMatch(HEX_ADDRESS);
    });
  });

  describe("CONTRACTS", () => {
    const expectedKeys = [
      "vault",
      "budgetManager",
      "agentRegistry",
      "riskOracle",
      "paymentRouter",
    ] as const;

    it.each(expectedKeys)("has a %s key", (key) => {
      expect(CONTRACTS).toHaveProperty(key);
    });

    it("has exactly the 5 expected contract keys", () => {
      expect(Object.keys(CONTRACTS).sort()).toEqual([...expectedKeys].sort());
    });

    it.each(expectedKeys)("%s is a valid 0x-prefixed 40-hex address", (key) => {
      expect(CONTRACTS[key]).toMatch(HEX_ADDRESS);
    });

    it("matches the addresses deployed in packages/api/src/contracts.ts", () => {
      expect(CONTRACTS).toEqual({
        vault: "0x68c104C39B8f8B0a0C7FA8Dec094b5eFD655AB3C",
        budgetManager: "0x61dAF0E077555362ea135C1C56c808aA8b0e71F8",
        agentRegistry: "0xD168D3185E1A972b32719169e42Bb949De61B6d9",
        riskOracle: "0x255C053490060Df61D374A42D95Fd570D25418a7",
        paymentRouter: "0x5CEed60c98b7F98e79016295AAdaCC5166D2e0Ab",
      });
    });

    it("uses unique addresses (no two contracts share a key)", () => {
      const values = Object.values(CONTRACTS);
      expect(new Set(values).size).toBe(values.length);
    });
  });

  describe("ABI arrays", () => {
    const ABIS = {
      VAULT_ABI,
      AGENT_REGISTRY_ABI,
      BUDGET_MANAGER_ABI,
      RISK_ORACLE_ABI,
      PAYMENT_ROUTER_ABI,
    } as const;

    it.each(Object.keys(ABIS) as (keyof typeof ABIS)[])(
      "%s is a non-empty array of strings",
      (name) => {
        const abi = ABIS[name];
        expect(Array.isArray(abi)).toBe(true);
        expect(abi.length).toBeGreaterThan(0);
        abi.forEach((entry) => expect(typeof entry).toBe("string"));
      }
    );

    it.each(Object.keys(ABIS) as (keyof typeof ABIS)[])(
      "%s entries are either 'function' or 'event' fragments",
      (name) => {
        ABIS[name].forEach((entry) => {
          const decl = entry.split("(")[0];
          const kind = decl.split(" ")[0];
          expect(["function", "event"]).toContain(kind);
        });
      }
    );

    it("VAULT_ABI contains the expected vault functions/events", () => {
      const signatures = [
        "function deposit(uint256 amount) external",
        "function withdraw(uint256 amount) external",
        "function getVaultBalance() external view returns (uint256)",
        "function totalDeposits() external view returns (uint256)",
        "function totalYield() external view returns (uint256)",
        "event Deposited(address indexed user, uint256 amount)",
        "event Withdrawn(address indexed user, uint256 amount)",
        "event YieldHarvested(uint256 amount, uint256 totalYield)",
        "event Rebalanced(uint256 yieldAmount, uint256 liquidityAmount)",
      ];
      signatures.forEach((sig) => expect(VAULT_ABI).toContain(sig));
    });

    it("AGENT_REGISTRY_ABI contains agent registration entries", () => {
      const signatures = [
        "function getAgentCount() external view returns (uint256)",
        "function registerAgent(address wallet, bytes32 agentId, uint8 agentType, string calldata name) external",
        "event AgentRegistered(address indexed wallet, bytes32 agentId, uint8 agentType, string name)",
      ];
      signatures.forEach((sig) => expect(AGENT_REGISTRY_ABI).toContain(sig));
    });

    it("BUDGET_MANAGER_ABI contains budget entries", () => {
      const signatures = [
        "function getBudget(address agent) external view returns (uint256)",
        "function getSpent(address agent) external view returns (uint256)",
        "function spend(address agent, uint256 amount) external returns (bool)",
        "event BudgetSpent(address indexed agent, uint256 amount, uint256 remaining)",
      ];
      signatures.forEach((sig) => expect(BUDGET_MANAGER_ABI).toContain(sig));
    });

    it("RISK_ORACLE_ABI contains risk entries", () => {
      const signatures = [
        "function checkHealth() external view returns (bool healthy, uint256 riskScore)",
        "function getRiskScore() external view returns (uint256)",
        "event CircuitBreakerTriggered(uint256 riskScore, uint256 timestamp)",
        "event RiskCheckCompleted(uint256 riskScore, bool healthy)",
      ];
      signatures.forEach((sig) => expect(RISK_ORACLE_ABI).toContain(sig));
    });

    it("PAYMENT_ROUTER_ABI contains nanopayment entries", () => {
      const signatures = [
        "function executeNanopayment(address payee, uint256 amount, string calldata serviceId) external returns (uint256)",
        "function executePayment(address to, uint256 amount, string calldata memo) external returns (uint256)",
        "event NanopaymentExecuted(uint256 indexed nanopaymentId, address indexed payer, address indexed payee, uint256 amount, string serviceId)",
      ];
      signatures.forEach((sig) => expect(PAYMENT_ROUTER_ABI).toContain(sig));
    });
  });

  describe("AGENT_TYPES", () => {
    it("maps each agent type id to a named type", () => {
      expect(AGENT_TYPES).toHaveLength(6);
      expect(AGENT_TYPES[0]).toEqual({ id: 0, name: "Yield Agent", type: "yield" });
      expect(AGENT_TYPES[5]).toEqual({ id: 5, name: "Coordinator", type: "coordinator" });
      expect(new Set(AGENT_TYPES.map((a) => a.id)).size).toBe(AGENT_TYPES.length);
    });

    it("index matches the API router's agent type enum order", () => {
      // The indexer casts numeric agentType -> enum using this order:
      // YIELD, LIQUIDITY, FX, PAYMENT, RISK, COORDINATOR
      expect(AGENT_TYPES.map((a) => a.type)).toEqual([
        "yield",
        "liquidity",
        "fx",
        "payment",
        "risk",
        "coordinator",
      ]);
    });
  });
});
