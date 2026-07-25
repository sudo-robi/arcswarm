# ArcSwarm

Multi-agent USDC treasury management on Arc. Six specialized AI agents handle yield, liquidity, FX, payments, and risk autonomously. Agents communicate via Nanopayments (x402) on Arc.

## Architecture

```
User → Dashboard → Coordinator Agent → 5 Specialist Agents
                                          ↓
                                    Arc Blockchain (USDC Gas, Sub-second)
                                          ↓
                              Circle Stack (Agent Wallets, Nanopayments, App Kits)
```

## Tracks

- **DeFi Track:** Yield optimization, FX strategies, liquidity management, treasury automation
- **Agentic Economy Track:** Autonomous agents with wallets, Nanopayments, ERC-8004 identity

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Arc Testnet (EVM-compatible, USDC gas) |
| Contracts | Solidity + Foundry |
| Agents | TypeScript |
| Backend | Node.js + Express + tRPC |
| Frontend | Next.js + Tailwind CSS |

## Quick Start

### Contracts

```bash
cd src/contracts
forge build
forge test
forge script script/DeployArcSwarm.s.sol --broadcast --rpc-url arc-testnet
```

### Agents

```bash
cd src/agents
npm install
npm run start
```

### API

```bash
cd src/api
npm install
npm run dev
```

### Dashboard

```bash
cd app
npm install
npm run dev
```

## Contract Addresses (Arc Testnet)

After deployment, update these in your environment:

```
VAULT_ADDRESS=0x...
BUDGET_MANAGER_ADDRESS=0x...
AGENT_REGISTRY_ADDRESS=0x...
RISK_ORACLE_ADDRESS=0x...
PAYMENT_ROUTER_ADDRESS=0x...
USDC_ADDRESS=0x...
```

## Circle Stack Usage

- **Arc L1:** Settlement layer, USDC gas, sub-second finality
- **USDC:** Treasury asset, gas token, payment rail
- **Agent Wallets:** Per-agent isolated wallets with spending policies
- **Nanopayments (x402):** Agent-to-agent micro-payments ($0.001-$0.01)
- **App Kits:** Unified Balance, Swap, Send for treasury operations
- **Gateway:** Cross-chain USDC routing
- **ERC-8004:** Agent identity registration
- **ERC-8183:** Job settlement contracts

## Demo

1. Connect wallet via Circle Wallets (email-based)
2. Create treasury vault, deposit USDC
3. Set risk tolerance (Conservative / Moderate / Aggressive)
4. Watch 6 agents autonomously manage your treasury
5. Live Nanopayment feed shows agent-to-agent commerce
