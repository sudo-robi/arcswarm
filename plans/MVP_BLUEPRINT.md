# ArcSwarm MVP Blueprint — Build Plan

**Objective:** Ship a working demo for Build on Arc hackathon showing 6 agents autonomously managing a USDC treasury with 50+ on-chain nanopayments.

**Current State:** 60% complete per ENGINEERING_REVIEW. Contracts deployed, agents written but don't call contracts, API uses in-memory store, frontend reads contracts directly, no Circle App Kits, no ERC-8004/8183 usage.

---

## Phase 0: Foundation & Infrastructure (Week 1)

### Step 1: Root Package.json + Workspaces
**Context:** No root package.json exists. Need monorepo structure for shared types, contracts lib, and coordinated scripts.
**Files:** `package.json` (root), `turbo.json`, `pnpm-workspace.yaml`
**Tasks:**
- Create root package.json with pnpm workspaces for `app`, `src/api`, `src/agents`, `contracts`
- Add turbo.json for pipeline (build, lint, test, db:migrate)
- Add shared `tsconfig.base.json`
**Verification:** `pnpm install` succeeds, `pnpm build` runs all workspaces
**Exit:** All workspaces install and typecheck

### Step 2: Contracts Package (Hardhat + TypeScript)
**Context:** Contracts are deployed but no local Hardhat project exists for testing, type generation, or script deployment.
**Files:** `contracts/hardhat.config.ts`, `contracts/package.json`, `contracts/scripts/SetupSwarm.s.sol`
**Tasks:**
- Scaffold Hardhat project with TypeScript
- Add existing contract ABIs + addresses as constants
- Write `SetupSwarm.s.sol` script: registers 5 agent wallets in AgentRegistry, grants AGENT_ROLE on PaymentRouter/Vault, allocates initial budgets via BudgetManager
- Generate TypeScript types with `typechain`
**Verification:** `npx hardhat compile` passes, `SetupSwarm.s.sol` deploys to Arc testnet (dry-run)
**Exit:** Contract tooling ready, setup script works

### Step 3: Database Provisioning + Prisma Migration
**Context:** Prisma schema exists but no DATABASE_URL, no migrations run.
**Files:** `.env` (root), `src/api/prisma/schema.prisma`
**Tasks:**
- Provision PostgreSQL (local Docker or Neon/Railway)
- Add `DATABASE_URL` to root `.env`
- Run `pnpm --filter api db:migrate` (create migration from schema)
- Verify tables created
**Verification:** `pnpm --filter api db:seed` works, tables queryable
**Exit:** Database live with schema

### Step 4: Contract Event Indexer (Background Worker)
**Context:** Indexer code exists in MVP_ARCHITECTURE.md but not implemented. Need to index Vault, PaymentRouter, RiskOracle, AgentRegistry events.
**Files:** `src/api/src/indexer.ts`, `src/api/src/contracts.ts` (ABI imports)
**Tasks:**
- Implement indexer per MVP_ARCHITECTURE.md §3.2
- Poll every 15s, chunk 2000 blocks
- Handle: Deposited, Withdrawn, YieldHarvested, Rebalanced, PaymentExecuted, NanopaymentExecuted, BatchPaymentExecuted, RiskCheckCompleted, CircuitBreakerTriggered
- Upsert IndexerCursor for resume
- Run as separate worker process
**Verification:** Indexer populates Transaction, RiskAlert tables from block 0
**Exit:** Historical + live events in DB

---

## Phase 1: Backend API — tRPC + WebSocket (Week 1-2)

### Step 5: tRPC Router — Wire to Prisma + Contracts
**Context:** Router exists but uses in-memory logic for some operations. Need full Prisma + contract reads.
**Files:** `src/api/src/router.ts`, `src/api/src/contracts.ts`
**Tasks:**
- Replace all direct RPC calls with Prisma reads where indexed data exists
- Keep live reads (balance, risk score) as contract calls
- Add `vault.deposit` / `withdraw` mutations that call contracts + index
- Add `agent.create` mutation for Coordinator registration flow
- Add `swarm.activate` mutation that triggers Coordinator.initializeSwarm()
**Verification:** All procedures typecheck, return correct data shapes
**Exit:** API fully wired

### Step 6: WebSocket Server — Live Dashboard Updates
**Context:** Basic WS exists but only pushes vault stats. Need agent status, nanopayments, risk alerts.
**Files:** `src/api/src/ws.ts`, `src/api/src/index.ts`
**Tasks:**
- Subscribe to indexer events (use EventEmitter)
- Push: `VAULT_UPDATE`, `AGENT_STATUS`, `NANOPAYMENT`, `RISK_ALERT`, `TRANSACTION`
- Auth via vaultId query param
**Verification:** Frontend receives real-time updates without polling
**Exit:** Live data flow working

### Step 7: Circle App Kits Client Wrapper
**Context:** Zero Circle integration. Need Swap, Send, Balance, Gateway, CCTP.
**Files:** `src/api/src/circle/app-kits.ts`, `src/api/src/circle/client.ts`
**Tasks:**
- Install `@circle-fin/app-kits` (or mock for hackathon)
- Implement: `swapUSDC(toToken, amount)`, `sendUSDC(to, amount)`, `getUnifiedBalance(address)`, `bridgeUSDC(chain, amount)`
- Add `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET` to env
**Verification:** `swapUSDC("aUSDC", 1000)` returns tx hash (testnet)
**Exit:** App Kits callable from agents

---

## Phase 2: Agent — Contract Integration (Week 2)

### Step 8: BaseAgent — Verify Real Contract Calls
**Context:** BaseAgent already has real contract instances. Need to verify `sendNanopayment`, `spendBudget`, `getRemainingBudget` work.
**Files:** `src/agents/base.ts`
**Tasks:**
- Test `paymentRouter.executeNanopayment()` on Arc testnet
- Test `budgetManager.spend()` + `getRemaining()`
- Test `riskOracle.updateMetrics()` (Risk Agent only)
- Add gas estimation + error handling
- Add transaction receipt logging with ArcScan links
**Verification:** Manual test: coordinator sends nanopayment → visible on ArcScan
**Exit:** All base contract methods functional

### Step 9: Coordinator — Full Swarm Bootstrap
**Context:** Coordinator has `initializeSwarm()` but uses local wallets. Need Circle Agent Stack or local wallet persistence.
**Files:** `src/agents/coordinator.ts`, `src/agents/main.ts`
**Tasks:**
- Implement wallet persistence (encrypt + store private keys locally for demo)
- Call `AgentRegistry.registerAgent()` for each agent (ERC-8004)
- Grant `AGENT_ROLE` on PaymentRouter + Vault
- Allocate budgets via `Vault.allocateToAgent()` → `BudgetManager.allocate()`
- Send budget notification nanopayments
- Start all 5 specialist agents + self
**Verification:** Run `pnpm agent:start` → 6 agents registered on-chain, budgets allocated, nanopayments visible
**Exit:** Swarm boots autonomously

### Step 10: Yield Agent — App Kits Swap Integration
**Context:** Yield Agent has allocation logic but commented-out App Kits swap.
**Files:** `src/agents/yield.ts`
**Tasks:**
- Inject Circle App Kits client
- Implement `rebalance()` → call `appKits.swap({ fromToken: "USDC", toToken: "aUSDC", amount, walletAddress })`
- After swap, call `budgetManager.spend(amount)`
- Pay Risk Agent nanopayment for validation
- Update `currentAllocations` with on-chain confirmation
**Verification:** Yield Agent moves USDC → aUSDC on Arc, tx visible
**Exit:** Yield optimization executing real swaps

### Step 11: Payment Agent — Real Payment Execution
**Context:** Payment Agent batches but doesn't execute.
**Files:** `src/agents/payment.ts`
**Tasks:**
- `executeBatch()`: call `paymentRouter.executeBatchPayments()` for ≤10 payments
- For single large payments: `appKits.send({ to, amount, token: "USDC", walletAddress })`
- After execution: `budgetManager.spend(amount)`
- Pay Liquidity Agent nanopayment if reserve needed
**Verification:** Payment Agent executes batch + single payments on-chain
**Exit:** Payment flow working

### Step 12: Risk Agent — Real RiskOracle Updates
**Context:** Risk Agent has logic but doesn't call `updateMetrics()`.
**Files:** `src/agents/risk.ts`
**Tasks:**
- Implement `checkAgentWallets()` → query `budgetManager.getRemaining()` per agent
- Implement `checkYieldSources()` → query on-chain TVL, utilization (or mock)
- Calculate risk score, call `riskOracle.updateMetrics(totalExposure, drawdownBps)`
- If score ≥ 80: `broadcastMessage("alert", { action: "circuitBreakerTriggered", riskScore })`
- Pay Coordinator nanopayment for escalation
**Verification:** Risk Agent updates RiskOracle every minute, circuit breaker triggers
**Exit:** On-chain risk monitoring active

### Step 13: Liquidity Agent + FX Agent — Complete Logic
**Context:** These agents exist but need contract integration.
**Files:** `src/agents/liquidity.ts`, `src/agents/fx.ts`
**Tasks:**
- Liquidity: forecast payments (query Payment Agent), maintain buffer, deploy excess to Yield
- FX: monitor EURC/USDC rate (mock or oracle), execute swap via App Kits when spread > 0.1%
- Both: nanopayments to Risk Agent for validation, budget spend tracking
**Verification:** Both agents execute their loops with real transactions
**Exit:** All 6 agents operational

---

## Phase 3: Frontend — User Flow + tRPC (Week 3)

### Step 14: tRPC Client + React Query Setup
**Context:** Frontend has @trpc/react-query installed but no client configuration.
**Files:** `app/src/lib/api.ts`, `app/src/lib/trpc.ts`
**Tasks:**
- Create `trpc` client with `httpBatchLink` + `wsLink` (WebSocket)
- Add `trpc` provider in `app/src/app/providers.tsx`
- Export typed hooks: `useVault`, `useAgents`, `useTransactions`, `useRiskAlerts`
**Verification:** `trpc.vault.getAll.useQuery()` returns data in component
**Exit:** Type-safe API layer

### Step 15: Wallet Connect — Circle Wallets
**Context:** No wallet connection. Need Circle Wallets (email-based) or WalletConnect.
**Files:** `app/src/components/wallet-connect.tsx`, `app/src/app/page.tsx`
**Tasks:**
- Add Circle Wallets SDK or WalletConnect v2
- "Connect Wallet" button → email flow → get address
- Store address in localStorage, pass to tRPC context
**Verification:** User connects, address shown in header
**Exit:** Wallet auth working

### Step 16: Vault Creation Flow
**Context:** Dashboard shows stats but no vault creation.
**Files:** `app/src/components/vault-form.tsx`, `app/src/app/page.tsx`
**Tasks:**
- Modal: "Create Treasury" → risk tolerance select (Conservative/Moderate/Aggressive)
- Call `trpc.vault.create.mutate({ userId: address, riskTolerance })`
- Show deposit address (Vault contract address)
- Poll for deposit confirmation → show "Activate Swarm" button
**Verification:** User creates vault, deposits USDC, sees balance update
**Exit:** Full vault lifecycle

### Step 17: Swarm Activation + Live Dashboard
**Context:** Dashboard reads contracts directly. Must switch to API.
**Files:** `app/src/components/*` (all), `app/src/app/page.tsx`
**Tasks:**
- Replace all `ethers.JsonRpcProvider` calls with tRPC hooks
- Add "Activate Swarm" button → `trpc.swarm.activate.mutate({ vaultId })`
- Live feed: WebSocket subscription → TransactionFeed component
- Agent status cards: WebSocket → AgentGrid component
- Risk panel: WebSocket → RiskPanel component
- Treasury overview: tRPC + WS → TreasuryOverview
**Verification:** Dashboard shows live agent activity, nanopayments, risk score
**Exit:** Production-quality dashboard

### Step 18: Polish — Error States, Loading, Mobile
**Context:** MVP functional but rough edges.
**Files:** All components
**Tasks:**
- Skeleton loaders for all queries
- Error boundaries + toast notifications
- Mobile responsive (Tailwind)
- Dark mode support
- ArcScan links for all transaction hashes
**Verification:** Lighthouse > 90, no console errors
**Exit:** Polished demo

---

## Phase 4: Deployment + Demo Prep (Week 4)

### Step 19: API Deployment (Railway/Render)
**Context:** API runs locally only.
**Files:** `railway.json`, `Dockerfile`, `src/api/src/index.ts` (PORT from env)
**Tasks:**
- Create Dockerfile for API
- Deploy to Railway with PostgreSQL addon
- Set env vars: DATABASE_URL, ARC_RPC_URL, CIRCLE_API_KEY, etc.
- Verify health endpoint, WebSocket works over wss://
**Verification:** `curl https://api.arcswarm.xyz/api/health` returns ok
**Exit:** API live

### Step 20: Agent Workers Deployment (PM2)
**Context:** Agents run locally via `tsx`.
**Files:** `ecosystem.config.js`, `src/agents/main.ts`
**Tasks:**
- Create PM2 config for 6 agent processes + coordinator
- Use `--max-memory-restart 500M`
- Log to files + stdout
- Auto-restart on crash
**Verification:** `pm2 list` shows all 7 processes online
**Exit:** Agents running 24/7

### Step 21: Frontend Deployment (Vercel)
**Context:** Frontend deployed but reads contracts directly.
**Files:** `vercel.json`, `app/next.config.js`
**Tasks:**
- Update `NEXT_PUBLIC_API_URL` to production API
- Deploy to Vercel
- Verify tRPC + WebSocket work in production
**Verification:** `https://app.arcswarm.xyz` loads dashboard with live data
**Exit:** Full stack deployed

### Step 22: End-to-End Test + 50 Nanopayments
**Context:** Need demo-ready system.
**Tasks:**
- Deposit 10,000 USDC to vault
- Activate swarm
- Run for 10 minutes
- Verify: Coordinator registered 5 agents, budgets allocated, Yield Agent swapped, Payment Agent batched, Risk Agent updated oracle, 50+ nanopayments on PaymentRouter
- Record ArcScan transaction links
**Verification:** All success criteria met
**Exit:** Demo ready

### Step 23: Video + Deck + Submit
**Tasks:**
- 3-min video script → record → edit
- Pitch deck (problem, solution, traction, tech, team)
- Submit to hackathon by Aug 9
**Exit:** Submitted!

---

## Dependency Graph

```
Step 1 (Root pkg) ──┬──► Step 2 (Contracts)
                    ├──► Step 3 (DB)
                    └──► Step 7 (Circle SDK)
Step 2 ──► Step 8 (BaseAgent test)
Step 3 ──► Step 4 (Indexer) ──► Step 5 (tRPC) ──► Step 6 (WS)
Step 7 ──► Step 10 (Yield) ──┐
Step 8 ──► Step 9 (Coordinator) ──► Step 10, 11, 12, 13 (All agents)
Step 5 ──► Step 14 (tRPC client) ──► Step 15 (Wallet) ──► Step 16 (Vault) ──► Step 17 (Dashboard)
Step 19, 20, 21 (Deploy) ──► Step 22 (E2E) ──► Step 23 (Submit)
```

**Parallelizable:** Steps 10-13 (agents) after Step 9; Steps 19/20/21 (deploy) can run in parallel.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Arc testnet down | Contracts already deployed; test continuously; have local anvil fork |
| Agent bugs lose funds | Circuit breaker in RiskOracle; emergency withdraw in Vault; max budget caps |
| Circle App Kits API changes | Mock adapters for demo; swap to real post-hackathon |
| Time overrun | Cut: FX Agent, CCTP, Gateway — ship 4 agents + dashboard |
| Nanopayment gas | Arc USDC gas is cheap; batch payments |

---

## Success Criteria (MVP Checklist)

- [ ] PostgreSQL provisioned + Prisma migrated
- [ ] Indexer running, populating DB from block 0
- [ ] API deployed, `/trpc/vault.create` works end-to-end
- [ ] Coordinator registers 5 agent wallets on-chain (ERC-8004)
- [ ] Yield Agent executes real `AppKits.swap()` to yield source
- [ ] Payment Agent executes real `PaymentRouter.executePayment()`
- [ ] Risk Agent calls `RiskOracle.updateMetrics()` every minute
- [ ] Frontend: Connect wallet → Create vault → Deposit → Activate
- [ ] Dashboard shows live agent status from API (not direct RPC)
- [ ] 50+ nanopayments visible on explorer in demo run
- [ ] Video recorded, deck submitted