'use client'

import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { Wallet, Activity, Zap, Shield, RotateCcw, Play } from 'lucide-react'

interface AgentGridProps {
  vaultId: string | null
}

const agentConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; gradient: string; bg: string }> = {
  YIELD: { icon: Zap, gradient: 'from-yellow-500 to-amber-600', bg: 'bg-yellow-500/10' },
  LIQUIDITY: { icon: Activity, gradient: 'from-blue-500 to-cyan-600', bg: 'bg-blue-500/10' },
  PAYMENT: { icon: Wallet, gradient: 'from-violet-500 to-purple-600', bg: 'bg-violet-500/10' },
  RISK: { icon: Shield, gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-500/10' },
  FX: { icon: RotateCcw, gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-500/10' },
  COORDINATOR: { icon: Play, gradient: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-500/10' },
}

export function AgentGrid({ vaultId }: AgentGridProps) {
  const { data: agents } = trpc.agent.getAll.useQuery({ vaultId: vaultId || '' }, { enabled: !!vaultId, refetchInterval: 10000 })

  if (!agents?.length) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <Activity className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">No agents active</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Active Agents</h3>
          <p className="text-sm text-muted-foreground">{agents.filter(a => a.active).length} of {agents.length} online</p>
        </div>
        <Badge variant="secondary" className="gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => {
          const config = agentConfig[agent.type] || agentConfig.COORDINATOR
          const Icon = config.icon
          const isActive = agent.active
          const spent = Number(agent.spent) / 1e6
          const budget = Number(agent.budget) / 1e6
          const usagePercent = budget > 0 ? (spent / budget) * 100 : 0

          return (
            <div
              key={agent.id}
              className="relative p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-all group cursor-pointer"
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} opacity-5 rounded-xl group-hover:opacity-10 transition-opacity`} />
              
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-muted-foreground/50'}`} />
                    <span className="text-xs text-muted-foreground">{isActive ? 'Active' : 'Paused'}</span>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="font-semibold capitalize">{agent.type.toLowerCase()}</p>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{agent.walletAddress.slice(0, 12)}...</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-medium">${budget.toFixed(1)}M</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-medium">${spent.toFixed(1)}M</span>
                  </div>
                  {/* Usage bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full bg-gradient-to-r ${config.gradient} rounded-full transition-all`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
