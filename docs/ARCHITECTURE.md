# ArcSwarm Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│            Next.js Dashboard + Tailwind + shadcn/ui             │
│     Treasury Overview | Agent Status | Live Feed | Risk         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ tRPC / REST
┌───────────────────────────▼─────────────────────────────────────┐
│                       API LAYER                                 │
│                 Node.js + TypeScript + tRPC                     │
│         Vault CRUD | Agent Control | Tx History | Risk API      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    COORDINATOR AGENT                            │
│    ┌──────────────────────────────────────────────────┐        │
│    │  • Budget allocation via Nanopayments            │        │
│    │  • Conflict resolution between agents            │        │
│    │  • Human escalation on threshold breach          │        │
│    │  • ERC-8004 identity registered                   │        │
│    │  • ERC-8183 job management                        │        │
│    └──────────────────────────────────────────────────┘        │
└───────┬───────┬───────┬───────┬───────┬────────────────────────┘
        │       │       │       │       │
   ┌────▼───┐┌──▼───┐┌──▼──┐┌──▼───┐┌──▼────────┐
   │ Yield  ││Liqui-││ FX  ││ Pay- ││ Risk      │
   │ Agent  ││dity  ││     ││ ment ││ Agent     │
   │        ││Agent ││     ││Agent ││           │
   └────┬───┘└──┬───┘└──┬──┘└──┬───┘└──┬────────┘
        │       │       │      │       │
   ┌────▼───────▼───────▼──────▼───────▼────────────┐
   │              ARC BLOCKCHAIN                     │
   │  ┌──────────────────────────────────────────┐  │
   │  │  USDC Gas ( Fee Manager — EWMA )         │  │
   │  │  Sub-second Deterministic Finality       │  │
   │  │  ERC-8004 Agent Identity                 │  │
   │  │  ERC-8183 Job Settlement                 │  │
   │  │  Nanopayments (x402 Protocol)            │  │
   │  └──────────────────────────────────────────┘  │
   └────┬───────┬───────┬──────┬───────┬────────────┘
        │       │       │      │       │
   ┌────▼───────▼───────▼──────▼───────▼────────────┐
   │              CIRCLE STACK                       │
   │  Agent Wallets    — per-agent isolated wallets  │
   │  Nanopayments     — sub-cent agent payments     │
   │  App Kits         — Unified Balance, Swap, Send │
   │  Gateway          — cross-chain USDC routing    │
   │  CCTP             — cross-chain transfers       │
   │  Circle Wallets   — user wallet connection      │
   │  Circle Contracts — on-chain logic              │
   └─────────────────────────────────────────────────┘
```

## Data Flow: Agent Treasury Operation

```
User deposits USDC
        │
        ▼
┌──────────────┐
│ ArcSwarmVault │ ◄── holds all treasury USDC
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Coordinator   │ ◄── reads vault balance, allocates budgets
└──────┬───────┘
       │ Nanopayments (x402)
       ├──► Yield Agent wallet (30% allocation)
       ├──► Liquidity Agent wallet (15% buffer)
       ├──► FX Agent wallet (20% allocation)
       ├──► Payment Agent wallet (25% allocation)
       └──► Risk Agent wallet (10% monitoring)
              │
              ▼
       Each agent operates independently:
       - Scans opportunities
       - Makes decisions
       - Executes via App Kits
       - Reports to Coordinator
       - Pays other agents for services
```

## Contract Interaction Map

```
User ──► ArcSwarmVault.deposit(USDC)
            │
            ▼
       AgentBudgetManager.allocate(agent, amount)
            │
            ├──► Yield Agent ──► App Kits Swap (yield sources)
            ├──► Liquidity Agent ──► App Kits Unified Balance
            ├──► FX Agent ──► App Kits Swap (EURC/USDC)
            ├──► Payment Agent ──► Nanopayments (x402)
            └──► Risk Agent ──► RiskOracle.check()
                                    │
                                    ▼ (if threshold breach)
                              Coordinator.escalate()
                                    │
                                    ▼
                              User notification
```

## Agent Decision Logic

### Yield Agent
```
LOOP every 5 minutes:
  1. Scan yield sources on Arc (AAVE, Compound, Curve)
  2. Score each source: rate × (1 - risk_penalty)
  3. Compare current allocation vs optimal
  4. If delta > 5%: rebalance via App Kits Swap
  5. Pay Risk Agent 0.001 USDC to validate each source
  6. Report to Coordinator
```

### Liquidity Agent
```
LOOP every 1 hour:
  1. Query Payment Agent for 7-day payment forecast
  2. Calculate optimal buffer = forecast × 1.2
  3. If current buffer < optimal: pull from Yield Agent
  4. If current buffer > optimal × 1.5: deploy excess to Yield
  5. Pay Coordinator 0.001 USDC for budget confirmation
```

### FX Agent
```
LOOP every 10 minutes:
  1. Fetch EURC/USDC rate from Arc oracles
  2. If spread > 0.1%: execute swap via App Kits
  3. Pay Risk Agent 0.001 USDC for risk check before execution
  4. Log profit/loss to on-chain reputation (ERC-8004)
```

### Payment Agent
```
ON payment request:
  1. Validate payment against budget (AgentBudgetManager)
  2. Batch with pending payments if possible
  3. Execute via Nanopayments (x402) for small amounts
  4. Execute via App Kits Send for large amounts
  5. Pay Liquidity Agent 0.001 USDC if reserve needed
```

### Risk Agent
```
LOOP every 1 minute:
  1. Monitor all agent wallets for anomalies
  2. Check yield source health (TVL, utilization, rate changes)
  3. If any threshold breached:
     a. Pause affected agent via Coordinator
     b. Trigger emergency withdrawal via ArcSwarmVault
     c. Pay Coordinator 0.001 USDC for escalation
  4. Update on-chain risk metrics (RiskOracle)
```

### Coordinator
```
ON Nanopayment received:
  1. Validate agent identity (ERC-8004)
  2. Process message (budget update, escalation, conflict)
  3. If conflict: apply resolution rules
  4. If escalation: notify user, pause affected agents
  5. If budget update: reallocate via AgentBudgetManager
  6. Pay all agents 0.001 USDC for acknowledgment
```
