# ArcSwarm — CEO Plan & Architecture

> Build on Arc Hackathon (Programmable Money) — Jul 13 – Aug 9, 2026
> Tracks: DeFi + Agentic Economy (dual-track)

---

## 1. What This Is

ArcSwarm is a multi-agent treasury management system on Arc. Six specialized AI agents autonomously manage USDC treasuries — yield optimization, liquidity buffering, FX arbitrage, payment execution, risk monitoring — coordinated by a Coordinator agent that enforces budgets and resolves conflicts.

The key differentiator: **agents pay each other via Nanopayments on Arc**, demonstrating real agent-to-agent commerce at sub-cent scale. This is not a dashboard with AI chat. It's autonomous financial infrastructure.

---

## 2. Why This Wins

### Judge Criteria Alignment

| Criterion | How ArcSwarm Delivers |
|---|---|
| Meaningful use of Arc + USDC | USDC-as-gas, sub-second settlement for agent operations, ERC-8004 agent identity, ERC-8183 job contracts |
| Advanced programmable money flows | Conditional payments between agents, multi-step yield strategies, autonomous circuit breakers |
| App Kits integration | Unified Balance for cross-chain treasury, Swap for FX, Send for payments |
| Real use case with path to production | Treasury management is a $10T+ problem — every company with idle cash needs this |
| Agent-to-agent commerce | 50+ Nanopayments in demo — agents hire each other, pay for risk checks, settle budgets |

### Dual-Track Entry

- **DeFi Track:** Yield optimization, FX strategies, liquidity management, treasury automation
- **Agentic Economy Track:** Autonomous agents with wallets, Nanopayments, ERC-8004 identity, ERC-8183 job settlement

---

## 3. Arc + Circle Stack Usage

### What We Use and Why

| Product | Usage | Why It Matters |
|---|---|---|
| **Arc L1** | Settlement layer for all agent operations | USDC gas, sub-second finality, EVM-compatible |
| **USDC** | Treasury asset + gas token | Stable, programmable, native on Arc |
| **Agent Wallets** | Per-agent isolated wallets with spending policies | Each agent gets its own wallet with time-bound limits, contract allowlists |
| **Nanopayments (x402)** | Agent-to-agent service payments | $0.001-$0.01 per call — agents pay for risk checks, data, coordination |
| **App Kits** | Unified Balance, Swap, Send, Bridge | Cross-chain treasury aggregation, FX execution, payment routing |
| **Gateway** | Cross-chain USDC routing | Treasury operations across Ethereum, Base, Arbitrum |
| **CCTP** | Cross-chain USDC transfers | Move yield between chains |
| **ERC-8004** | Agent identity registration | Onchain agent reputation and credentials |
| **ERC-8183** | Job contracts for agent work | Escrow, deliverable submission, settlement |
| **Circle Wallets** | User-facing wallet connection | Email-based onboarding, no wallet downloads |

---

## 4. Product Architecture

### 4.1 Agent Swarm

```
┌─────────────────────────────────────────────────────────┐
│                    USER LAYER                           │
│  Connect wallet → Create vault → Set risk tolerance     │
│  Dashboard: treasury, agents, transactions, risk        │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              COORDINATOR AGENT                          │
│  • Allocates budgets to each agent via Nanopayments     │
│  • Resolves conflicting strategies                       │
│  • Escalates to human when thresholds breached          │
│  • Enforces global risk limits                          │
│  • Registered via ERC-8004, manages ERC-8183 jobs       │
└──────┬──────┬──────┬──────┬──────┬─────────────────────┘
       │      │      │      │      │
┌──────▼──┐┌──▼───┐┌─▼──┐┌─▼───┐┌─▼──────────┐
│ Yield   ││Liqui-││FX  ││Pay- ││ Risk       │
│ Agent   ││dity  ││    ││ment ││ Agent      │
│         ││Agent ││    ││Agent││            │
└────┬────┘└──┬───┘└─┬──┘└─┬───┘└─┬──────────┘
     │        │      │     │      │
┌────▼────────▼──────▼─────▼──────▼──────────────────────┐
│              ARC BLOCKCHAIN                             │
│  USDC Gas | Sub-second | ERC-8004 | ERC-8183           │
└────────────────────────────────────────────────────────┘
     │        │      │     │      │
┌────▼────────▼──────▼─────▼──────▼──────────────────────┐
│              CIRCLE STACK                               │
│  Agent Wallets | Nanopayments | App Kits | Gateway     │
│  CCTP | Circle Wallets | Circle Contracts              │
└────────────────────────────────────────────────────────┘
```

### 4.2 Agent Specifications

| Agent | Responsibility | Decision Logic | Arc Products |
|---|---|---|---|
| **Yield Agent** | Scans yield sources, allocates capital | Monitor DeFi rates, TVL, risk scores → rebalance allocations | App Kits (Swap), Agent Wallets |
| **Liquidity Agent** | Maintains treasury buffer | Predict payment needs → keep optimal reserves → deploy excess | App Kits (Unified Balance, Send) |
| **FX Agent** | Stablecoin FX arbitrage | Monitor EURC/USDC rates → execute when spread > threshold | App Kits (Swap), StableFX |
| **Payment Agent** | Processes outgoing payments | Batch payments → optimize gas → execute schedules | Nanopayments, Agent Wallets |
| **Risk Agent** | Monitors threats, triggers defenses | Anomaly detection → rate monitoring → emergency withdrawals | Agent Stack, Circle Contracts |
| **Coordinator** | Orchestrates the swarm | Allocate budgets → resolve conflicts → escalate to human | Agent Wallets (policy enforcement) |

### 4.3 Agent-to-Agent Communication Flow

Every inter-agent communication is a Nanopayment on Arc:

```
Yield Agent → Risk Agent:  "Validate yield source AAVE"  → 0.001 USDC
Risk Agent → Coordinator:  "ALERT: threshold breach"      → 0.001 USDC
Coordinator → All Agents:  "Budget reallocation"          → 0.001 USDC × 5
Payment Agent → Liquidity: "Reserve needed for batch"     → 0.001 USDC
FX Agent → Risk Agent:     "Check arbitrage opportunity"  → 0.001 USDC
```

This produces 50+ on-chain Nanopayments in the demo — meeting the hackathon requirement.

### 4.4 Smart Contracts

| Contract | Purpose | Arc-Specific |
|---|---|---|
| `ArcSwarmVault.sol` | Main treasury vault, holds USDC | Fee Manager for stable gas |
| `AgentBudgetManager.sol` | Per-agent spending limits, allocation tracking | Sub-second settlement |
| `RiskOracle.sol` | On-chain risk metrics, circuit breaker logic | ERC-8183 for job settlement |
| `AgentRegistry.sol` | Agent identity and reputation | ERC-8004 native registration |
| `PaymentRouter.sol` | Batched payment execution | Nanopayments (x402) |

### 4.5 Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Arc Testnet (EVM-compatible) |
| Smart Contracts | Solidity + Hardhat |
| Agent Framework | TypeScript + Circle Agent Stack |
| Backend API | Node.js + TypeScript + tRPC |
| Frontend | Next.js + Tailwind CSS + shadcn/ui |
| Wallet | Circle Wallets + WalletConnect |
| Database | PostgreSQL (state) + Redis (caching) |
| Agent Identity | ERC-8004 on Arc |
| Job Settlement | ERC-8183 on Arc |

---

## 5. User Flow

```
1. User visits ArcSwarm dashboard
2. Connect wallet via Circle Wallets (email-based, no downloads)
3. Create treasury vault → deposit USDC
4. Set risk tolerance: Conservative / Moderate / Aggressive
5. Coordinator Agent activates the swarm:
   a. Creates Agent Wallets for each specialist agent
   b. Allocates budgets via Nanopayments
   c. Registers agents via ERC-8004
6. Agents begin autonomous operation:
   - Yield Agent scans AAVE, Compound, Curve rates on Arc
   - Liquidity Agent maintains 15% buffer, predicts 7-day cash needs
   - FX Agent monitors EURC/USDC, executes when spread > 0.1%
   - Payment Agent batches outgoing payments, schedules recurring
   - Risk Agent monitors all positions, triggers circuit breakers
7. Dashboard shows real-time:
   - Treasury total and allocation breakdown
   - Agent status (active, idle, executing, error)
   - Live Nanopayment feed (agent-to-agent transactions)
   - Risk metrics (exposure, drawdown, concentration)
   - Historical yield earned
```

---

## 6. 4-Week Build Plan

### Week 1 (Jul 13–19): Foundation + Checkpoint 1

**Goal:** Smart contracts deployed, Coordinator Agent sending Nanopayments on Arc testnet.

| Day | Task | Deliverable |
|---|---|---|
| Mon Jul 13 | Project setup: repo, Hardhat, Next.js, Circle CLI | Scaffolded project |
| Tue Jul 14 | `ArcSwarmVault.sol` + `AgentBudgetManager.sol` | 2 contracts deployed |
| Wed Jul 15 | `AgentRegistry.sol` (ERC-8004) + `RiskOracle.sol` | Agent identity + risk on-chain |
| Thu Jul 16 | `PaymentRouter.sol` (x402 Nanopayments) | Payment infrastructure |
| Fri Jul 17 | Coordinator Agent: wallet creation, budget allocation | Coordinator operational |
| Sat Jul 18 | Yield + Risk agents (basic versions) | 2 agents sending Nanopayments |
| Sun Jul 19 | **CHECKPOINT 1:** Demo agents on Arc testnet | Project page live |

### Week 2 (Jul 20–26): Agent Logic + Checkpoint 2

**Goal:** All 6 agents operational, end-to-end treasury flow on Arc testnet.

| Day | Task | Deliverable |
|---|---|---|
| Mon Jul 20 | Yield Agent: rate scanning, allocation logic | Yield optimization working |
| Tue Jul 21 | Liquidity Agent: buffer management, prediction | Liquidity management working |
| Wed Jul 22 | FX Agent: rate monitoring, arbitrage execution | FX strategies working |
| Thu Jul 23 | Payment Agent: batching, scheduling | Payment execution working |
| Fri Jul 24 | Risk Agent: anomaly detection, circuit breakers | Risk protection working |
| Sat Jul 25 | Coordinator: conflict resolution, budget rebalancing | Full swarm coordination |
| Sun Jul 26 | **CHECKPOINT 2:** Repo link + progress summary | All 6 agents on testnet |

### Week 3 (Jul 27–Aug 2): Frontend + Polish

**Goal:** Complete dashboard, polished UX, tested system.

| Day | Task | Deliverable |
|---|---|---|
| Mon Jul 27 | Dashboard: treasury overview, agent status cards | Core dashboard |
| Tue Jul 28 | Dashboard: live Nanopayment feed, transaction history | Live activity view |
| Wed Jul 29 | Dashboard: risk metrics, historical performance charts | Analytics view |
| Thu Jul 30 | User flow: connect → create vault → set risk → activate | Full user journey |
| Fri Jul 31 | Polish: error handling, loading states, mobile responsive | Production-quality UX |
| Sat Aug 1 | Testing: all agents, all flows, all contracts | Test suite passing |
| Sun Aug 2 | Documentation: README, architecture, setup guide | Docs complete |

### Week 4 (Aug 3–9): Submission

**Goal:** Submit functional MVP + video + deck.

| Day | Task | Deliverable |
|---|---|---|
| Mon Aug 3 | 3-minute video script + storyboard | Script ready |
| Tue Aug 4 | Video recording: demo walkthrough | Raw footage |
| Wed Aug 5 | Video editing + music | Final video |
| Thu Aug 6 | Pitch deck creation | Deck ready |
| Fri Aug 7 | Final testing on Arc testnet | All systems green |
| Sat Aug 8 | Submit early — platform locks at deadline | **SUBMITTED** |
| Sun Aug 9 | Buffer / late fixes if needed | DEADLINE (UTC-12) |

---

## 7. Hackathon Submission Checklist

- [ ] Functional MVP deployed on Arc testnet
- [ ] Public GitHub repository with clean code
- [ ] 3-minute video pitch + demo
- [ ] Pitch deck
- [ ] 50+ on-chain Nanopayments in demo
- [ ] Uses Arc, USDC, Agent Stack, App Kits, Nanopayments, ERC-8004, ERC-8183
- [ ] Dashboard showing real-time treasury management
- [ ] Agent-to-agent commerce demonstrated

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Arc testnet instability | Can't deploy/test | Deploy contracts Day 1, test continuously |
| Agent logic too complex | Miss deadline | Start with 2 agents (Yield + Risk), add incrementally |
| Nanopayments integration issues | Miss agent-to-agent demo | Fallback: direct USDC transfers, Nanopayments as enhancement |
| Frontend takes too long | Weak demo | Use shadcn/ui, focus on data viz over polish |
| Video quality poor | Low judge impression | Record early (Week 3), iterate |
| Scope creep | Nothing ships | Strict week-by-week plan, cut features not core |

---

## 9. Competitive Positioning

**What others will build:** Single-agent DeFi dashboards, simple payment apps, basic yield aggregators.

**What makes ArcSwarm different:**

1. **Multi-agent swarm** — not one AI, six specialists coordinating
2. **Agent-to-agent commerce** — Nanopayments prove the agentic economy works
3. **Risk-first design** — circuit breakers and emergency protocols, not just "yield go up"
4. **Full stack utilization** — Arc + USDC + Agent Stack + App Kits + Nanopayments + ERC-8004 + ERC-8183
5. **Real treasury management** — solves a genuine $10T+ problem, not a toy demo

---

## 10. Success Metrics

| Metric | Target |
|---|---|
| On-chain Nanopayments in demo | 50+ |
| Circle products used | 6+ (Arc, USDC, Agent Stack, App Kits, Nanopayments, ERC-8004) |
| Agents operational | All 6 |
| Video length | Under 3 minutes |
| Code quality | Clean, documented, tests passing |
| Hackathon result | Top 8 → accelerator programme |
