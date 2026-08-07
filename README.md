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
| Backend | Node.js + TypeScript + tRPC |
| Frontend | Vite + React + Tailwind + shadcn/ui |
| Database | PostgreSQL (Prisma) |
| Monorepo | pnpm + Turborepo |

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Foundry (for contracts)

### Contracts

```bash
cd packages/contracts
forge build
forge test
forge script script/DeployArcSwarm.s.sol --broadcast --rpc-url arc-testnet
```

### Full Stack (from repo root)

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @arcswarm/api db:generate

# Build all packages
pnpm run build

# Run all tests
pnpm test

# Start API server (requires DATABASE_URL in .env)
pnpm --filter @arcswarm/api dev

# Start agents (requires PRIVATE_KEY, ARC_RPC_URL in .env)
pnpm --filter @arcswarm/agents dev

# Start dashboard
pnpm --filter @arcswarm/dashboard dev
```

## Contract Addresses (Arc Testnet)

After deployment, update these in your environment:

```
VAULT_ADDRESS=0x86014c6473574F93d4BFc386541681f8c1200160
BUDGET_MANAGER_ADDRESS=0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e
AGENT_REGISTRY_ADDRESS=0x8007d0C9630f1AaB8A371702964AD2a5C07d7868
RISK_ORACLE_ADDRESS=0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd
PAYMENT_ROUTER_ADDRESS=0x11d0b045Df255940de0dF6CfD0130d9D25204214
USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

## Circle Stack Usage

- **Arc L1:** Settlement layer, USDC gas, sub-second finality
- **USDC:** Treasury asset, gas token, payment rail
- **Agent Wallets:** Per-agent isolated wallets with spending policies
- **Nanopayments (x402):** Agent-to-agent micro-payments ($0.001-$0.01)
- **App Kits:** Unified Balance, Swap, Send for treasury operations
- **Gateway:** Cross-chain USDC routing
- **CCTP:** Cross-chain USDC transfers
- **ERC-8004:** Agent identity registration
- **ERC-8183:** Job settlement contracts

## Demo

1. Connect wallet via Circle Wallets (email-based)
2. Create treasury vault, deposit USDC
3. Set risk tolerance (Conservative / Moderate / Aggressive)
4. Watch 6 agents autonomously manage your treasury
5. Live Nanopayment feed shows agent-to-agent commerce

## Deployment

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for complete deployment instructions (Railway, Vercel, Docker).

## Testing

```bash
# Full test suite (contracts + API + agents + shared + dashboard)
pnpm test

# Contracts only
pnpm --filter @arcswarm/contracts test

# API/tRPC tests
pnpm --filter @arcswarm/api test

# Agent tests
pnpm --filter @arcswarm/agents test

# Dashboard component tests
pnpm --filter @arcswarm/dashboard test

# Shared package tests
pnpm --filter @arcswarm/shared test
```

## License

MIT