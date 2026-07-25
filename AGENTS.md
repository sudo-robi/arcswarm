# ArcSwarm — Agent Instructions

## Project Overview

ArcSwarm is a multi-agent USDC treasury management system on Arc.
Six specialized AI agents manage yield, liquidity, FX, payments, and risk.
Agents communicate via Nanopayments (x402) on Arc.

## Tech Stack

- **Blockchain:** Arc Testnet (EVM-compatible, USDC gas)
- **Contracts:** Solidity + Hardhat
- **Backend:** Node.js + TypeScript + tRPC
- **Frontend:** Next.js + Tailwind + shadcn/ui
- **Agent Framework:** TypeScript + Circle Agent Stack
- **Database:** PostgreSQL + Redis

## Key Commands

```bash
# Contracts
npx hardhat compile
npx hardhat test
npx hardhat run scripts/deploy.ts --network arc-testnet

# Backend
npm run dev          # Start API server
npm run db:migrate   # Run migrations
npm run db:seed      # Seed test data

# Frontend
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm run lint         # ESLint

# Agent
npm run agent:start  # Start agent swarm
npm run agent:test   # Run agent tests
```

## Arc/Circle Integration Points

- **ERC-8004:** Agent identity registration (AgentRegistry.sol)
- **ERC-8183:** Job settlement contracts (RiskOracle.sol)
- **Nanopayments (x402):** Agent-to-agent payments (PaymentRouter.sol)
- **Agent Wallets:** Per-agent isolated wallets with spending policies
- **App Kits:** Unified Balance, Swap, Send for treasury operations
- **Gateway:** Cross-chain USDC routing
- **CCTP:** Cross-chain USDC transfers

## File Structure

```
arcswarm/
├── contracts/          # Solidity smart contracts
│   ├── ArcSwarmVault.sol
│   ├── AgentBudgetManager.sol
│   ├── AgentRegistry.sol      # ERC-8004
│   ├── RiskOracle.sol         # ERC-8183
│   └── PaymentRouter.sol      # x402 Nanopayments
├── agents/             # Agent implementations
│   ├── coordinator.ts
│   ├── yield.ts
│   ├── liquidity.ts
│   ├── fx.ts
│   ├── payment.ts
│   └── risk.ts
├── src/                # Backend API
│   ├── api/
│   ├── db/
│   └── services/
├── app/                # Next.js frontend
│   ├── dashboard/
│   ├── vault/
│   └── components/
├── docs/               # Planning docs
│   ├── CEO-PLANNING.md
│   └── ARCHITECTURE.md
└── test/               # Tests
```

## Conventions

- TypeScript strict mode
- Solidity 0.8.x with OpenZeppelin
- All agent interactions logged on-chain
- Nanopayments for all agent-to-agent communication
- USDC amounts in string format (never float)
- Gas fees denominated in USDC (Arc native)
