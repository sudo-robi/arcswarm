# ArcSwarm — Complete Deployment Guide

## Required Variables (All must be set)

### Blockchain (Arc Testnet)
| Variable | Value | Where to Get |
|----------|-------|--------------|
| `ARC_RPC_URL` | `https://rpc.testnet.arc.network` | Fixed — Arc testnet public RPC |
| `PRIVATE_KEY` | `0x...` (64 hex chars) | **Your wallet private key** with USDC on Arc testnet. Get from MetaMask → Account Details → Export Private Key. **Must have COORDINATOR_ROLE on deployed contracts.** |

### Contract Addresses (Already Deployed on Arc Testnet)
| Variable | Value | Source |
|----------|-------|--------|
| `VAULT_ADDRESS` | `0x86014c6473574F93d4BFc386541681f8c1200160` | Deployed contracts |
| `BUDGET_MANAGER_ADDRESS` | `0xC62734d9E83AbA8e1B337667ACBf67F5b6E3375e` | Deployed contracts |
| `AGENT_REGISTRY_ADDRESS` | `0x8007d0C9630f1AaB8A371702964AD2a5C07d7868` | Deployed contracts |
| `RISK_ORACLE_ADDRESS` | `0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd` | Deployed contracts |
| `PAYMENT_ROUTER_ADDRESS` | `0x11d0b045Df255940de0dF6CfD0130d9D25204214` | Deployed contracts |
| `USDC_ADDRESS` | `0x3600000000000000000000000000000000000000` | Fixed — Arc native USDC |

### Circle API (Required for App Kits)
| Variable | Value | Where to Get |
|----------|-------|--------------|
| `CIRCLE_API_KEY` | `...` | **Circle Developer Console** → https://console.circle.com/ → API Keys → Create Key. Select "App Kits" scope. |
| `CIRCLE_ENTITY_SECRET` | `...` | Same console → Entity Secret → Generate. Store securely. |

### Database (PostgreSQL)
| Variable | Value | Where to Get |
|----------|-------|--------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/arcswarm` | **Provision PostgreSQL** (see options below), then copy connection string. |

### Frontend
| Variable | Value | Where to Get |
|----------|-------|--------------|
| `VITE_API_URL` | `https://api.arcswarm.xyz` | Your Railway deployment URL after API deploy |
| `VITE_ARC_RPC_URL` | `https://rpc.testnet.arc.network` | Fixed |

### API Server
| Variable | Value | Where to Get |
|----------|-------|--------------|
| `PORT` | `3001` | Fixed — Railway assigns dynamically, but app reads this |

---

## PostgreSQL Provisioning Options (Pick One)

### Option A: Railway (Recommended — Same platform as API)
1. In Railway project → **New** → **Database** → **PostgreSQL**
2. Wait for provision → **Connect** tab → Copy `DATABASE_URL`
3. Add as variable in Railway API service

### Option B: Neon (Free tier, serverless)
1. https://console.neon.tech/ → Create Project
2. Copy connection string (pooled): `postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/arcswarm?sslmode=require`
3. Add to Railway/Vercel env vars

### Option C: Supabase (Free tier)
1. https://supabase.com/ → New Project
2. Settings → Database → Connection string (Transaction pooler)
3. Format: `postgresql://postgres:[password]@db.xxx.supabase.co:6543/postgres?pgbouncer=true`

---

## Step-by-Step Deployment Commands

### 1. Provision DB + Set .env
```bash
# Copy example
cp .env.example .env

# Edit .env with ALL values above (use your editor)
# Required: PRIVATE_KEY, CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, DATABASE_URL
```

### 2. Install & Build (Local Verification)
```bash
# Install pnpm if needed
corepack enable pnpm

# Install all workspace deps
pnpm install

# Generate Prisma client
pnpm --filter @arcswarm/api db:generate

# Build all packages
pnpm run build
```

### 3. Run Migrations (Against Provisioned DB)
```bash
cd packages/api
pnpm db:migrate   # Creates tables in your PostgreSQL
cd ../..
```

### 4. Deploy API to Railway
1. Push repo to GitHub
2. Railway → **New Project** → **Deploy from GitHub** → Select repo
3. **Add PostgreSQL** service (Option A above) → Link to API service
4. **Variables** tab → Add ALL `.env` variables (except `VITE_*`)
5. Deploy → Wait for build → Copy `https://xxx.railway.app` URL

### 5. Deploy Agents (PM2 on Railway)
**Option A: Same Railway project (background worker)**
1. Railway → **New Service** → **GitHub Repo** (same repo)
2. Root Directory: `/` (monorepo root)
3. Build Command: `pnpm install && pnpm run build`
4. Start Command: `node packages/agents/dist/main.js`
5. Add same env vars as API

**Option B: Separate VM (DigitalOcean, Fly.io, etc.)**
```bash
# On VM
git clone <repo>
cd arcswarm
pnpm install && pnpm run build
pm2 start ecosystem.config.js
pm2 save && pm2 startup
```

### 6. Deploy Frontend to Vercel
1. Vercel → **Add New** → **Project** → Import GitHub repo
2. Root Directory: `apps/dashboard`
3. **Environment Variables**:
   - `VITE_API_URL` = Your Railway API URL (e.g., `https://api.arcswarm.xyz`)
   - `VITE_ARC_RPC_URL` = `https://rpc.testnet.arc.network`
4. Deploy → Copy `https://app.arcswarm.xyz` URL

### 7. Run DeployArcSwarm (One-Time, Local)
```bash
cd packages/contracts
# Ensure .env has PRIVATE_KEY with COORDINATOR_ROLE
forge script script/DeployArcSwarm.s.sol --rpc-url arc-testnet --broadcast
# Output: agent wallets, budgets, roles granted
```

### 8. E2E Test
1. Open Vercel frontend URL
2. Connect wallet (Circle Wallets / MetaMask)
3. Create vault → Set risk tolerance → Deposit 10,000 USDC (from testnet faucet)
4. Click "Activate Swarm"
5. Watch dashboard: agents start, nanopayments appear in TransactionFeed
6. Verify on ArcScan: `https://testnet.arcscan.app/address/0x11d0b045Df255940de0dF6CfD0130d9D25204214` → **Nanopayments** tab → Should see 50+

### 9. Video + Submit
- Record 3-min demo (OBS/Loom)
- Create pitch deck (problem, solution, demo, tech, traction)
- Submit at Build on Arc hackathon portal by Aug 9

---

## Quick Checklist Before Deploy

- [ ] `PRIVATE_KEY` has USDC on Arc testnet (get from faucet: https://faucet.testnet.arc.network)
- [ ] `PRIVATE_KEY` address has `COORDINATOR_ROLE` on Vault, BudgetManager, PaymentRouter, RiskOracle, AgentRegistry
- [ ] `CIRCLE_API_KEY` has App Kits permissions
- [ ] `DATABASE_URL` points to provisioned PostgreSQL (not localhost)
- [ ] All contract addresses match deployed addresses
- [ ] `VITE_API_URL` will be updated AFTER Railway deploy
- [ ] `pnpm run build` passes locally
- [ ] `pnpm test` passes (449 tests)

---

## Docker Deployment (Alternative)

### API
```bash
docker build -t arcswarm-api -f Dockerfile .
docker run -d -p 3001:3001 --env-file .env arcswarm-api
```

### Agents
```bash
docker build -t arcswarm-agents -f Dockerfile.agents .
docker run -d --env-file .env arcswarm-agents
```

---

## Local Development

```bash
# Terminal 1: API
pnpm --filter @arcswarm/api dev

# Terminal 2: Agents
pnpm --filter @arcswarm/agents dev

# Terminal 3: Dashboard
pnpm --filter @arcswarm/dashboard dev
```

All three will connect to the same `.env` and shared database.