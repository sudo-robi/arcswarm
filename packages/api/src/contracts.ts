export {
  ARC_TESTNET,
  VAULT_ABI,
  AGENT_REGISTRY_ABI,
  BUDGET_MANAGER_ABI,
  RISK_ORACLE_ABI,
  PAYMENT_ROUTER_ABI,
  AGENT_TYPES,
} from "@arcswarm/shared/contracts";

export const CONTRACTS = {
  vault: "0x86014c6473574F93d4BFc386541681f8c1200160",
  budgetManager: "0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e",
  agentRegistry: "0x8007d0C9630f1AaB8A371702964AD2a5C07d7868",
  riskOracle: "0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd",
  paymentRouter: "0x11d0b045Df255940de0dF6CfD0130d9D25204214",
} as const;

export const RPC_URL = "https://rpc.testnet.arc.network";
