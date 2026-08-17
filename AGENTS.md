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

## Subagents

All subagents are defined in `.opencode/agent/`. Invoke them by name when needed.

### Test Engineer Agent
A dedicated subagent (`test-engineer`) owns all testing work. Invoke it for writing/extending/auditing tests across any surface.

### Security Agents
| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `security-blockchain-security-auditor` | Smart contract vulnerability detection, formal verification, audit reports | Before any contract deployment, after major contract changes |
| `security-architect` | Threat modeling, trust-boundary analysis, secure-by-design architecture | New features, architectural decisions, security reviews |
| `security-appsec-engineer` | Secure SDLC, code review, SAST/DAST integration | PR reviews, dependency audits, CI/CD security |
| `security-penetration-tester` | Offensive security testing, exploit chain discovery | Pre-launch security assessment, red team exercises |

### Engineering Agents
| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `engineering-solidity-smart-contract-engineer` | Secure Solidity development, gas optimization, DeFi patterns | Writing/modifying any `.sol` files |
| `engineering-multi-agent-systems-architect` | Agent topology, failure modes, context management, HITL design | Agent swarm architecture decisions |
| `engineering-backend-architect` | System design, database architecture, API design, reliability | Backend architecture, scaling decisions |
| `engineering-payments-billing-engineer` | Payment flows, idempotency, webhook processing, reconciliation | PaymentRouter, x402 integration, USDC flows |
| `engineering-identity-access-engineer` | Auth systems, RBAC, identity management, access control | AgentRegistry, ERC-8004 identity, permissioning |
| `engineering-devops-automator` | CI/CD, deployment, infrastructure automation | Build pipelines, deployment, monitoring setup |
| `engineering-code-reviewer` | Code quality, patterns, best practices | PR reviews, refactoring guidance |
| `engineering-software-architect` | High-level architecture, system boundaries | Major architectural decisions |

### Marketing & Growth Agents
| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `marketing-content-creator` | Content strategy, editorial calendars, multi-platform content | Blog posts, docs, launch content |
| `marketing-social-media-strategist` | Cross-platform campaigns, LinkedIn/Twitter strategy | Community building, thought leadership |
| `marketing-seo-specialist` | Technical SEO, content optimization, organic search | Website visibility, content discoverability |
| `marketing-pr-communications-manager` | Media relations, press releases, crisis comms | Product launches, announcements, incident comms |
| `marketing-growth-hacker` | Growth loops, viral mechanics, user acquisition | Growth strategy, user funnel optimization |
| `marketing-twitter-engager` | Twitter/X engagement, community management | Real-time social engagement |

### Strategy & Coordination
| File | Purpose |
|------|---------|
| `agent-activation-prompts` | Agent activation and initialization patterns |
| `handoff-templates` | Inter-agent handoff protocols |
| `phase-0-discovery` through `phase-6-operate` | Development lifecycle playbooks |
| `scenario-startup-mvp` | MVP development playbook |
| `scenario-incident-response` | Incident response playbook |
| `scenario-marketing-campaign` | Marketing campaign playbook |
| `scenario-enterprise-feature` | Enterprise feature development playbook |

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
