'use client'

import { trpc } from '@/lib/trpc'
import { DollarSign, TrendingUp, RefreshCw, ArrowUpRight, ArrowDownRight, Sparkles } from 'lucide-react'

interface TreasuryOverviewProps {
  vaultId: string | null
}

export function TreasuryOverview({ vaultId }: TreasuryOverviewProps) {
  const { data: vault } = trpc.vault.getLiveData.useQuery(
    { vaultAddress: '0x86014c6473574F93d4BFc386541681f8c1200160' },
    { refetchInterval: 10000 }
  )

  const { data: stats } = trpc.stats.useQuery({ vaultId: vaultId || '' }, { enabled: !!vaultId, refetchInterval: 10000 })

  const balance = vault ? Number(vault.balance) / 1e6 : 0
  const deposits = vault ? Number(vault.totalDeposits) / 1e6 : 0
  const yield_ = vault ? Number(vault.totalYield) / 1e6 : 0
  const agents = stats ? `${stats.activeAgents}/${stats.totalAgents}` : '0/6'

  const metrics = [
    { 
      label: 'Vault Balance', 
      value: `$${balance.toFixed(2)}`, 
      sub: 'USDC', 
      icon: DollarSign, 
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-500/10',
      change: '+2.4%',
      changeUp: true
    },
    { 
      label: 'Total Deposits', 
      value: `$${deposits.toFixed(2)}`, 
      sub: 'USDC', 
      icon: TrendingUp, 
      gradient: 'from-blue-500 to-cyan-600',
      bg: 'bg-blue-500/10',
      change: '$0.00',
      changeUp: true
    },
    { 
      label: 'Total Yield', 
      value: `$${yield_.toFixed(4)}`, 
      sub: 'USDC', 
      icon: Sparkles, 
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-500/10',
      change: '+12.8%',
      changeUp: true
    },
    { 
      label: 'Active Agents', 
      value: agents, 
      sub: 'online', 
      icon: RefreshCw, 
      gradient: 'from-cyan-500 to-blue-600',
      bg: 'bg-cyan-500/10',
      change: '100%',
      changeUp: true
    },
  ]

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Treasury Overview</h3>
          <p className="text-sm text-muted-foreground">Real-time vault metrics</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <RefreshCw className="w-3 h-3" />
          <span>Updated live</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="relative p-4 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-colors">
            {/* Gradient accent */}
            <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${m.gradient} opacity-10 rounded-full blur-xl -mr-5 -mt-5`} />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg ${m.bg} flex items-center justify-center`}>
                  <m.icon className="w-5 h-5" />
                </div>
                <div className={`flex items-center gap-0.5 text-xs font-medium ${m.changeUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {m.changeUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {m.change}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-1">{m.label}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-bold">{m.value}</span>
                <span className="text-xs text-muted-foreground">{m.sub}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
