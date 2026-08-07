# ArcSwarm — Agent Instructions

## Project Overview

ArcSwarm is a multi-agent USDC treasury management system on Arc.
Six specialized AI agents manage yield, liquidity, FX, payments, and risk.
Agents communicate via Nanopayments (x402) on Arc.

## Tech Stack

- **Blockchain:** Arc Testnet (EVM-compatible, USDC gas)
- **Contracts:** Solidity + Foundry
- **Backend:** Node.js + TypeScript + tRPC
- **Frontend:** Vite + React + Tailwind + shadcn/ui
- **Agent Framework:** TypeScript + Circle Agent Stack
- **Database:** PostgreSQL + Redis

## Key Commands

```bash
# Contracts
forge build
forge test
forge script script/SetupSwarm.s.sol --rpc-url arc-testnet --broadcast

# Backend
npm run dev          # Start API server
npm run db:migrate   # Run migrations
npm run db:seed      # Seed test data

# Frontend
npm run dev          # Start Vite dev server
npm run build        # Production build
npm run lint         # ESLint

# Agent
npm run agent:start  # Start agent swarm
npm run agent:test   # Run agent tests

# Tests (run from repo root)
pnpm test                       # Full turbo test suite (contracts + api + agents + shared + dashboard)
pnpm --filter @arcswarm/contracts test   # Forge tests only
pnpm --filter @arcswarm/api test         # API/tRPC vitest
pnpm --filter @arcswarm/agents test      # Agent vitest
pnpm --filter @arcswarm/dashboard test   # Dashboard component tests
pnpm --filter @arcswarm/shared test      # Shared ABI/config tests
```

## Testing

- **Contracts:** Foundry — per-contract suites in `packages/contracts/test/` (ArcSwarmVault.t.sol, AgentBudgetManager.t.sol, AgentRegistry.t.sol, RiskOracle.t.sol, PaymentRouter.t.sol). Run `forge test` from `packages/contracts`.
- **TS packages:** vitest 2.x — tests live in `<pkg>/test/*.test.ts` (api, agents, shared) or `src/**/*.test.ts(x)` (dashboard, jsdom + testing-library). Each package has `test` / `test:coverage` scripts and a `vitest.config.ts`.
- **Test-only discipline:** the dedicated `test-engineer` subagent writes tests; production code is never modified by test work. Bugs found while testing are reported, not silently fixed.
- Use `vm.prank`/`vm.warp`/`vm.assume` in Forge; mock Prisma/ethers in vitest (no live network or DB).

## Test Engineer Agent

A dedicated subagent (`test-engineer`, defined in `.opencode/agent/test-engineer.md`) owns all testing work. Invoke it for writing/extending/auditing tests across any surface. It reports files added, functions covered, test counts, and any product bugs discovered.

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
├── packages/           # pnpm workspace packages
│   ├── contracts/      # Solidity smart contracts (Foundry)
│   │   ├── src/
│   │   │   ├── ArcSwarmVault.sol
│   │   │   ├── AgentBudgetManager.sol
│   │   │   ├── AgentRegistry.sol      # ERC-8004
│   │   │   ├── RiskOracle.sol         # ERC-8183
│   │   │   └── PaymentRouter.sol      # x402 Nanopayments
│   │   ├── script/     # Deploy scripts
│   │   └── test/
│   ├── agents/         # Agent implementations
│   │   ├── coordinator.ts
│   │   ├── yield.ts
│   │   ├── liquidity.ts
│   │   ├── fx.ts
│   │   ├── payment.ts
│   │   └── risk.ts
│   ├── api/            # Backend API (tRPC)
│   │   ├── prisma/
│   │   └── src/
│   └── shared/         # Shared types + contract ABIs
├── apps/               # Frontend apps
│   └── dashboard/      # Vite + React dashboard
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
