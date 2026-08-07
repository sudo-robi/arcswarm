(node:37171) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications. Use the WHATWG URL API instead. CVEs are not issued for `url.parse()` vulnerabilities.
(Use `node --trace-deprecation ...` to show where the warning was created)
-- CreateEnum
CREATE TYPE "RiskTolerance" AS ENUM ('CONSERVATIVE', 'MODERATE', 'AGGRESSIVE');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('YIELD', 'LIQUIDITY', 'FX', 'PAYMENT', 'RISK', 'COORDINATOR');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'NANOPAYMENT', 'PAYMENT', 'ALLOCATION', 'YIELD_HARVEST', 'REBALANCE');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "Vault" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "riskTolerance" "RiskTolerance" NOT NULL DEFAULT 'MODERATE',
    "totalDeposits" BIGINT NOT NULL DEFAULT 0,
    "totalYield" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "type" "AgentType" NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "budget" BIGINT NOT NULL DEFAULT 0,
    "spent" BIGINT NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "reputation" INTEGER NOT NULL DEFAULT 50,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "agentId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "memo" TEXT,
    "txHash" TEXT,
    "blockNumber" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskAlert" (
    "id" TEXT NOT NULL,
    "vaultId" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "agentId" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "RiskAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerCursor" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "lastBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexerCursor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vault_address_key" ON "Vault"("address");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_walletAddress_key" ON "Agent"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_txHash_key" ON "Transaction"("txHash");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RiskAlert" ADD CONSTRAINT "RiskAlert_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

