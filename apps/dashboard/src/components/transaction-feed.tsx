'use client'

import { trpc } from '@/lib/trpc'
import { ArrowUpRight, ArrowDownLeft, Minus, Send, RotateCcw, DollarSign, ArrowDownUp, Clock } from 'lucide-react'

interface TransactionFeedProps {
  vaultId: string | null
}

const typeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  DEPOSIT: { icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  WITHDRAWAL: { icon: ArrowUpRight, color: 'text-rose-400', bg: 'bg-rose-500/10' },
  NANOPAYMENT: { icon: Minus, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
  PAYMENT: { icon: Send, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  ALLOCATION: { icon: RotateCcw, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  YIELD_HARVEST: { icon: DollarSign, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  REBALANCE: { icon: ArrowDownUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
}

export function TransactionFeed({ vaultId }: TransactionFeedProps) {
  const { data } = trpc.transaction.getAll.useQuery(
    { vaultId: vaultId || '', limit: 20 },
    { enabled: !!vaultId, refetchInterval: 10000 }
  )

  const transactions = data?.transactions || []

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Live Transactions</h3>
          <p className="text-sm text-muted-foreground">{transactions.length} recent</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-medium text-emerald-400">Auto-refresh</span>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {transactions.length > 0 ? (
          transactions.map((tx) => {
            const config = typeConfig[tx.type] || typeConfig.NANOPAYMENT
            const Icon = config.icon
            const amount = Number(tx.amount) / 1e6

            return (
              <div
                key={tx.id}
                className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
              >
                {/* Icon */}
                <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm capitalize">
                      {tx.type.toLowerCase().replace('_', ' ')}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {tx.memo || `${tx.fromAddress.slice(0, 6)}... → ${tx.toAddress.slice(0, 6)}...`}
                  </p>
                </div>

                {/* Amount & time */}
                <div className="text-right flex-shrink-0">
                  <p className={`font-semibold text-sm ${config.color}`}>
                    {tx.type === 'DEPOSIT' || tx.type === 'YIELD_HARVEST' ? '+' : '-'}${amount.toFixed(2)}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <ArrowUpRight className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No transactions yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Transactions will appear here</p>
          </div>
        )}
      </div>
    </div>
  )
}
