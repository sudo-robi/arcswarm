# ArcSwarm — Engineering Review

**Date:** July 25, 2026  
**Branch:** main  
**Reviewer:** plan-eng-review

---

## Executive Summary

The ArcSwarm codebase has **all core components implemented but disconnected**. Five smart contracts are deployed on Arc testnet, six agents are written in TypeScript, a tRPC backend exists, and a Next.js dashboard reads live on-chain data. However:

- **Agents don't call contracts** — they log nanopayments instead of executing them
- **Backend API uses in-memory store** — not PostgreSQL, doesn't sync with chain state
- **Frontend reads contracts directly** — bypasses API layer, no user vault creation flow
- **No Circle App Kits integration** — yield sources, swap, send not implemented
- **No ERC-8004/ERC-8183 usage** — agent identity and job settlement contracts deployed but unused

**Verdict:** 60% complete. The hard infrastructure (contracts, agent framework, deployed addresses) is solid. The wiring layer is missing.

---

## 1. Smart Contracts — Status: ✅ DEPLOYED, ⚠️ GAPS

| Contract | Address | Status | Gaps |
|---|---|---|---|
| `ArcSwarmVault` | `0x86014c6473574F93d4BFc386541681f8c1200160` | Deployed | Missing: yield source integration, CCTP/Gateway hooks |
| `AgentBudgetManager` | `0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e` | Deployed | Missing: per-transaction spend approvals, ERC-8183 escrow |
| `AgentRegistry` (ERC-8004) | `0x8007d0C9630f1AaB8A371702964AD2a5C07d7868` | Deployed | Missing: reputation used in allocation logic |
| `RiskOracle` (ERC-8183) | `0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd` | Deployed | Missing: on-chain yield source health checks |
| `PaymentRouter` (x402) | `0x11d0b045Df255940de0dF6CfD0130d9D25204214` | Deployed | Missing: batch gas optimization, refund handling |

**Critical finding:** Contracts are deployed but **no script registers agent wallets** in `AgentRegistry` or grants `AGENT_ROLE` on `PaymentRouter`. The deployed `Vault` has `COORDINATOR_ROLE` granted to itself, not to the coordinator agent.

---

## 2. Agent Framework — Status: ⚠️ FRAMEWORK READY, ❌ CONTRACT INTEGRATION MISSING

### What Works
- Clean `BaseAgent` abstract class with message queue, nanopayment abstraction, broadcast
- Six agents: Coordinator, Yield, Liquidity, FX, Payment, Risk
- Each has decision logic (scoring, allocation, anomaly detection)

### What's Missing — **Agents Never Touch Contracts**
```typescript
// Current: agents/log.ts
protected async sendNanopayment(to: string, amount: number, serviceId: string): Promise<string> {
  console.log(`[${this.config.name}] Nanopayment: ${amount} USDC to ${to} for ${serviceId}`);
  return `nanopayment-${Date.now()}`;  // Returns fake ID!
}
```

**Every agent needs:**
1. `ethers.Contract` instances for each deployed contract
2. Real transaction signing via `wallet.connect(provider)`
3. Gas estimation and error handling
4. Event listening for on-chain confirmations

### Agent Contract Wiring Matrix

| Agent | Must Call | Must Listen |
|---|---|---|
| **Coordinator** | `AgentBudgetManager.allocate()`, `AgentRegistry.registerAgent()`, `PaymentRouter.executeBatchPayments()` | `BudgetAllocated`, `AgentRegistered`, `NanopaymentExecuted` |
| **Yield** | `PaymentRouter.executeNanopayment()` (risk check), `AppKits.swap()` | `YieldHarvested`, `Rebalanced` |
| **Liquidity** | `PaymentRouter.executeNanopayment()` (reserve request) | `Deposited`, `Withdrawn` |
| **FX** | `PaymentRouter.executeNanopayment()` (risk check), `AppKits.swap()` | — |
| **Payment** | `PaymentRouter.executePayment()`, `executeBatchPayments()` | `PaymentExecuted`, `BatchPaymentExecuted` |
| **Risk** | `RiskOracle.updateMetrics()`, `RiskOracle.addRiskAgent()` | `CircuitBreakerTriggered`, `RiskCheckCompleted` |

---

## 3. Backend API — Status: ⚠️ SKELETON ONLY

### Current State (`src/api/src/index.ts`)
- tRPC router with vault/agent/tx/risk CRUD
- **In-memory `Map` storage** — loses data on restart
- Express server on port 3001
- No contract event indexing
- No authentication
- No WebSocket for real-time updates

### Required for MVP
| Feature | Status | Effort |
|---|---|---|
| PostgreSQL + Prisma/Drizzle | ❌ | 2h |
| Contract event indexer (Vault, PaymentRouter, RiskOracle) | ❌ | 4h |
| WebSocket for live dashboard | ❌ | 2h |
| User vault creation flow | ❌ | 3h |
| Circle App Kits API wrapper | ❌ | 4h |
| Agent wallet management (Circle Agent Stack) | ❌ | 3h |

---

## 4. Frontend — Status: ✅ READS CONTRACTS, ❌ NO USER FLOW

### What Works
- Dashboard reads live: vault balance, agent budgets, risk score, transaction events
- Auto-refresh every 10-15s
- Clean shadcn/ui + Tailwind components

### What's Missing
| Flow | Status |
|---|---|
| Connect wallet (Circle Wallets / WalletConnect) | ❌ |
| Create vault → deposit USDC | ❌ |
| Set risk tolerance (Conservative/Moderate/Aggressive) | ❌ |
| Activate swarm (triggers coordinator) | ❌ |
| View agent nanopayment history | ❌ |
| Manual override / emergency pause | ❌ |

**Architecture issue:** Frontend calls `ethers.JsonRpcProvider` directly. Should call API (`/trpc`) which indexes chain state.

---

## 5. Circle Stack Integration — Status: ❌ NONE IMPLEMENTED

| Product | Required For | Implementation |
|---|---|---|
| **Agent Wallets** | Per-agent isolated wallets with spend policies | Use Circle Agent Stack SDK |
| **Nanopayments (x402)** | Agent-to-agent service payments | Already in `PaymentRouter`; need client SDK |
| **App Kits: Unified Balance** | Cross-chain treasury view | API integration |
| **App Kits: Swap** | Yield source entry/exit, FX arbitrage | API integration |
| **App Kits: Send** | Payment Agent execution | API integration |
| **Gateway** | Cross-chain yield routing | API integration |
| **CCTP** | Move yield between chains | API integration |
| **ERC-8004** | Agent identity on-chain | `AgentRegistry` deployed, needs registration |
| **ERC-8183** | Job settlement (risk checks, yield validation) | `RiskOracle` deployed, needs job creation |

---

## 6. Deployment State

| Component | Status | Location |
|---|---|---|
| Contracts | ✅ Deployed | Arc testnet (chainId 5042002) |
| Frontend | ✅ Deployed | https://app-beta-eight-38.vercel.app |
| Backend API | ❌ Not deployed | Local only |
| Agents | ❌ Not running | Local only |
| Database | ❌ Not provisioned | — |

---

## 7. Critical Path to MVP (Priority Order)

```
1. BACKEND: PostgreSQL + Prisma + Contract Indexer (4h)
   └─ Index Vault, PaymentRouter, RiskOracle, AgentRegistry events
   └─ REST/tRPC endpoints for dashboard

2. AGENTS: Real contract integration (6h)
   └─ Each agent gets ethers.Contract instances
   └─ Real sendNanopayment() using wallet.signTransaction()
   └─ Event listeners for confirmation

3. COORDINATOR: Bootstrap flow (3h)
   └─ Create agent wallets (Circle Agent Stack or local)
   └─ Register agents in AgentRegistry (ERC-8004)
   └─ Grant AGENT_ROLE on PaymentRouter
   └─ Initial budget allocation via AgentBudgetManager

4. FRONTEND: User flow (4h)
   └─ Wallet connect (Circle Wallets)
   └─ Create vault → deposit USDC
   └─ Set risk tolerance → activate swarm
   └─ Switch from direct RPC to API calls

5. CIRCLE APP KITS: Yield + FX execution (4h)
   └─ Yield Agent: AppKits.swap() for yield source entry
   └─ FX Agent: AppKits.swap() for EURC/USDC arbitrage
   └─ Payment Agent: AppKits.send() for large payments

6. DEPLOY & TEST (3h)
   └─ Deploy API to Railway/Render
   └─ Run agents as background workers
   └─ End-to-end test: deposit → swarm activates → yield earned → dashboard updates
```

**Total: ~24h focused work**

---

## 8. Recommended Architecture (Wired)

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vercel)                        │
│  Next.js Dashboard ──tRPC──► API Layer                         │
└─────────────────────────────┬───────────────────────────────────┘
                              │ HTTPS
┌─────────────────────────────▼───────────────────────────────────┐
│                      API LAYER (Railway/Render)                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ tRPC Router │  │ Indexer     │  │ Circle App Kits Client  │  │
│  │ (vault,     │  │ (PostgreSQL │  │ (Swap, Send, Balance,   │  │
│  │  agents,    │  │  + Prisma)  │  │  Gateway, CCTP)         │  │
│  │  txs, risk) │  │             │  │                         │  │
│  └─────────────┘  └──────┬──────┘  └─────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │  AGENTS  │  │ CONTRACTS│  │  CIRCLE  │
       │(Workers) │  │(Arc)     │  │  STACK   │
       │          │  │          │  │          │
       │ Coordinator     │  │  │  │ Agent    │
       │ Yield           │  │  │  │ Wallets  │
       │ Liquidity       │  │  │  │ Nanopay  │
       │ FX              │  │  │  │ App Kits │
       │ Payment         │  │  │  │          │
       │ Risk            │  │  │  │          │
       └──────────┘  └──────────┘  └──────────┘
```

---

## 9. Decision Points (Need Your Input)

**D1: Agent Wallet Management**
- A) Circle Agent Stack (managed, policies, recoverable) — **Recommended**
- B) Local `ethers.Wallet.createRandom()` — simpler dev, no recovery
- C) User deposits to vault, coordinator holds private keys — **Don't do this**

**D2: Database**
- A) PostgreSQL + Prisma — **Recommended** (type-safe, migrations)
- B) SQLite (local) + Prisma — dev only
- C) Keep in-memory for hackathon — risky

**D3: Event Indexing**
- A) Custom indexer polling `provider.getLogs()` — **Recommended** (simple, controllable)
- B) The Graph — overkill for hackathon
- C) Alchemy/QuickNode webhooks — requires paid tier

**D4: Frontend ↔ API**
- A) tRPC end-to-end — **Recommended** (type-safe, already started)
- B) REST + React Query — simpler, less boilerplate
- C) Direct RPC (current) — demo only, no user vault flow

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Arc testnet instability | Medium | High | Contracts already deployed; test continuously |
| Agent logic bugs lose funds | Low | Critical | Circuit breaker in RiskOracle; emergency withdraw |
| Circle App Kits API changes | Low | Medium | Mock adapters for demo; swap to real post-hackathon |
| Time overrun | High | High | Cut: FX Agent, CCTP, Gateway — ship 4 agents + dashboard |
| Nanopayment gas costs | Low | Low | Arc USDC gas is cheap; batch payments |

---

## 11. Sign-Off Checklist for MVP

- [ ] PostgreSQL provisioned + Prisma schema migrated
- [ ] Indexer running, populating DB from block 0
- [ ] API deployed, `/trpc/vault.create` works end-to-end
- [ ] Coordinator registers 5 agent wallets on-chain
- [ ] Yield Agent executes real `AppKits.swap()` to yield source
- [ ] Payment Agent executes real `PaymentRouter.executePayment()`
- [ ] Risk Agent calls `RiskOracle.updateMetrics()` every minute
- [ ] Frontend: Connect wallet → Create vault → Deposit → Activate
- [ ] Dashboard shows live agent status from API (not direct RPC)
- [ ] 50+ nanopayments visible on explorer in demo run
- [ ] Video recorded, deck submitted

---

## 12. Files to Modify (Priority Order)

| Priority | File | Change |
|---|---|---|
| P0 | `src/agents/base.ts` | Add `contracts` property, real `sendNanopayment()` |
| P0 | `src/agents/coordinator.ts` | Implement `initializeAgents()` with on-chain registration |
| P0 | `src/api/prisma/schema.prisma` | Create (new file) |
| P0 | `src/api/src/indexer.ts` | Create (new file) — contract event indexer |
| P0 | `src/api/src/routes/*` | Wire tRPC to Prisma, add WebSocket |
| P1 | `app/src/lib/api.ts` | Create — tRPC client, replace direct RPC calls |
| P1 | `app/src/app/page.tsx` | Add vault creation flow, wallet connect |
| P1 | `src/agents/yield.ts` | Integrate Circle App Kits Swap |
| P1 | `src/agents/payment.ts` | Real PaymentRouter calls |
| P1 | `src/agents/risk.ts` | Real RiskOracle.updateMetrics() |
| P2 | `src/contracts/script/SetupSwarm.s.sol` | Create — one-click agent registration + role grants |

---

**Next Step:** Confirm decision points D1-D4, then I'll generate the implementation tasks and start wiring.