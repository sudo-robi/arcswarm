import { ArrowUpRight } from 'lucide-react'

interface TransactionFeedProps {
  vaultId?: string
}

export function TransactionFeed(_props: TransactionFeedProps) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6" aria-label="Live transactions feed">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Live Transactions</h3>
          <p className="text-sm text-muted-foreground">On-chain activity</p>
        </div>
      </div>

      <div className="text-center py-12">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <ArrowUpRight className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No transactions yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Deposit USDC to see activity here</p>
      </div>
    </div>
  )
}
