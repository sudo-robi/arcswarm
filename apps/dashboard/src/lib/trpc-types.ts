type Vault = {
  id: string
  address: string
  userId: string
  riskTolerance: string
  isActive: boolean
  totalYield: string | null
  createdAt: Date
  updatedAt: Date
}

type Agent = {
  id: string
  vaultId: string
  type: string
  walletAddress: string
  budget: bigint | null
  spent: bigint | null
  active: boolean
  reputation: number | null
  lastActiveAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type Transaction = {
  id: string
  vaultId: string
  agentId: string | null
  fromAddress: string
  toAddress: string
  amount: bigint
  type: string
  memo: string | null
  txHash: string | null
  blockNumber: bigint | null
  createdAt: Date
  updatedAt: Date
}

type RiskAlert = {
  id: string
  vaultId: string
  agentId: string | null
  severity: string
  type: string
  message: string
  resolved: boolean
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type AppRouter = {
  vault: {
    get: {
      input: { address: string }
      output: (Vault & { balance: string; totalDeposits: string; totalYield: string }) | null
    }
    getAll: {
      output: Vault[]
    }
    create: {
      input: { userId: string; riskTolerance?: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' }
      output: Vault
    }
    activate: {
      input: { vaultId: string }
      output: Vault
    }
    getLiveData: {
      input: { vaultAddress: string }
      output: { balance: string; totalDeposits: string; totalYield: string }
    }
  }
  agent: {
    getAll: {
      input?: { vaultId?: string }
      output: Agent[]
    }
    get: {
      input: { id: string }
      output: Agent | null
    }
    update: {
      input: { id: string; budget?: bigint; spent?: bigint; active?: boolean; reputation?: number; lastActiveAt?: Date }
      output: Agent
    }
    create: {
      input: { vaultId: string; type: 'YIELD' | 'LIQUIDITY' | 'FX' | 'PAYMENT' | 'RISK' | 'COORDINATOR'; walletAddress: string; budget?: bigint }
      output: Agent
    }
  }
  transaction: {
    getAll: {
      input?: { vaultId?: string; agentId?: string; type?: 'DEPOSIT' | 'WITHDRAWAL' | 'NANOPAYMENT' | 'PAYMENT' | 'ALLOCATION' | 'YIELD_HARVEST' | 'REBALANCE'; limit?: number; offset?: number }
      output: { transactions: Transaction[]; total: number }
    }
    create: {
      input: { vaultId: string; agentId?: string; fromAddress: string; toAddress: string; amount: bigint; type: 'DEPOSIT' | 'WITHDRAWAL' | 'NANOPAYMENT' | 'PAYMENT' | 'ALLOCATION' | 'YIELD_HARVEST' | 'REBALANCE'; memo?: string; txHash?: string; blockNumber?: bigint }
      output: Transaction
    }
  }
  risk: {
    getAlerts: {
      input: { vaultId?: string; resolved?: boolean }
      output: RiskAlert[]
    }
    createAlert: {
      input: { vaultId: string; severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; type: string; message: string; agentId?: string }
      output: RiskAlert
    }
    resolveAlert: {
      input: { id: string }
      output: RiskAlert
    }
    getLiveScore: {
      input: { riskOracleAddress: string }
      output: { healthy: boolean; riskScore: string }
    }
  }
  stats: {
    input: { vaultId?: string }
    output: {
      totalAgents: number
      activeAgents: number
      totalBudget: string
      totalSpent: string
      totalTransactions: number
      unresolvedAlerts: number
      totalYield: string
      riskScore: string
    }
  }
}
