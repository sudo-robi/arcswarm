import { describe, it, expect } from "vitest";
import {
  ARC_TESTNET,
  CONTRACTS,
  VAULT_ABI,
  AGENT_REGISTRY_ABI,
  BUDGET_MANAGER_ABI,
  RISK_ORACLE_ABI,
  PAYMENT_ROUTER_ABI,
} from "../src/contracts.js";

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

describe("api contracts (packages/api/src/contracts.ts)", () => {
  describe("CONTRACTS", () => {
    const expectedKeys = [
      "vault",
      "budgetManager",
      "agentRegistry",
      "riskOracle",
      "paymentRouter",
    ] as const;

    it("has exactly the 5 expected contract keys", () => {
      expect(Object.keys(CONTRACTS).sort()).toEqual([...expectedKeys].sort());
    });

    it.each(expectedKeys)("%s is a valid 0x-prefixed 40-hex address", (key) => {
      expect(CONTRACTS[key]).toMatch(HEX_ADDRESS);
    });

    it("matches the addresses in the shared package", () => {
      expect(CONTRACTS).toEqual({
        vault: "0x86014c6473574F93d4BFc386541681f8c1200160",
        budgetManager: "0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e",
        agentRegistry: "0x8007d0C9630f1AaB8A371702964AD2a5C07d7868",
        riskOracle: "0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd",
        paymentRouter: "0x11d0b045Df255940de0dF6CfD0130d9D25204214",
      });
    });
  });

  describe("ARC_TESTNET", () => {
    it("matches the shared network config", () => {
      expect(ARC_TESTNET).toEqual({
        chainId: 5042002,
        rpcUrl: "https://rpc.testnet.arc.network",
        usdcAddress: "0x3600000000000000000000000000000000000000",
      });
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

    it("VAULT_ABI contains expected vault signatures", () => {
      for (const sig of [
        "function getVaultBalance() external view returns (uint256)",
        "function totalDeposits() external view returns (uint256)",
        "function totalYield() external view returns (uint256)",
        "function deposit(uint256 amount) external",
        "function withdraw(uint256 amount) external",
        "function allocateToAgent(address agent, uint256 amount) external",
        "event Deposited(address indexed user, uint256 amount)",
        "event YieldHarvested(uint256 amount, uint256 totalYield)",
        "event Rebalanced(uint256 yieldAmount, uint256 liquidityAmount)",
      ]) {
        expect(VAULT_ABI).toContain(sig);
      }
    });

    it("AGENT_REGISTRY_ABI contains expected signatures", () => {
      for (const sig of [
        "function registerAgent(address wallet, bytes32 agentId, uint8 agentType, string calldata name) external",
        "function isAgent(address) external view returns (bool)",
        "function getAgentInfo(address) external view returns (tuple(bytes32 agentId, uint8 agentType, string name, uint256 registeredAt, uint256 lastActiveAt, uint256 reputationScore, bool active, address wallet))",
        "event AgentRegistered(address indexed wallet, bytes32 agentId, uint8 agentType, string name)",
      ]) {
        expect(AGENT_REGISTRY_ABI).toContain(sig);
      }
    });

    it("BUDGET_MANAGER_ABI contains expected signatures", () => {
      for (const sig of [
        "function getRemaining(address agent) external view returns (uint256)",
        "function spend(address agent, uint256 amount) external returns (bool)",
        "function createBudget(address agent, uint256 amount) external",
        "event BudgetSpent(address indexed agent, uint256 amount, uint256 remaining)",
      ]) {
        expect(BUDGET_MANAGER_ABI).toContain(sig);
      }
    });

    it("RISK_ORACLE_ABI contains expected signatures", () => {
      for (const sig of [
        "function checkHealth() external view returns (bool healthy, uint256 riskScore)",
        "function getRiskScore() external view returns (uint256)",
        "function updateMetrics(uint256 _totalExposure, uint256 _currentDrawdown) external",
        "event CircuitBreakerTriggered(uint256 riskScore, uint256 timestamp)",
        "event RiskCheckCompleted(uint256 riskScore, bool healthy)",
      ]) {
        expect(RISK_ORACLE_ABI).toContain(sig);
      }
    });

    it("PAYMENT_ROUTER_ABI contains expected signatures", () => {
      for (const sig of [
        "function executeNanopayment(address payee, uint256 amount, string calldata serviceId) external returns (uint256)",
        "function executePayment(address to, uint256 amount, string calldata memo) external returns (uint256)",
        "function executeBatchPayments(address[] calldata recipients, uint256[] calldata amounts, string[] calldata memos) external returns (uint256)",
        "event NanopaymentExecuted(uint256 indexed nanopaymentId, address indexed payer, address indexed payee, uint256 amount, string serviceId)",
      ]) {
        expect(PAYMENT_ROUTER_ABI).toContain(sig);
      }
    });
  });
});
