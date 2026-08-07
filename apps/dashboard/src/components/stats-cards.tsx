'use client'

import { trpc } from '@/lib/trpc'
import { DollarSign, TrendingUp, Users, Shield, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface StatsCardsProps {
  vaultId: string | null
}

export function StatsCards({ vaultId }: StatsCardsProps) {
  const { data: stats } = trpc.stats.useQuery({ vaultId: vaultId || '' }, { enabled: !!vaultId, refetchInterval: 10000 })
  const { data: live } = trpc.vault.getLiveData.useQuery({ vaultAddress: '0x86014c6473574F93d4BFc386541681f8c1200160' }, { refetchInterval: 5000 })

  const balance = Number(live?.balance || stats?.totalBudget || 0) / 1e6
  const yield_ = Number(stats?.totalYield || 0) / 1e6
  const agents = stats?.activeAgents || 0
  const totalAgents = stats?.totalAgents || 6
  const risk = stats?.riskScore || 0

  const cards = [
    {
      label: 'Treasury Balance',
      value: `$${balance.toLocaleString()}`,
      sub: 'USDC',
      icon: DollarSign,
      color: 'from-violet-500 to-purple-600',
      iconBg: 'bg-violet-500/20',
      iconColor: 'text-violet-400',
      change: '+2.4%',
      changeUp: true
    },
    {
      label: 'Total Yield Earned',
      value: `$${yield_.toLocaleString()}`,
      sub: 'USDC',
      icon: TrendingUp,
      color: 'from-emerald-500 to-teal-600',
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      change: '+12.8%',
      changeUp: true
    },
    {
      label: 'Active Agents',
      value: `${agents}/${totalAgents}`,
      sub: 'online',
      icon: Users,
      color: 'from-cyan-500 to-blue-600',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
      change: `${agents} healthy`,
      changeUp: true
    },
    {
      label: 'Risk Score',
      value: `${risk}`,
      sub: '/100',
      icon: Shield,
      color: 'from-orange-500 to-amber-600',
      iconBg: 'bg-orange-500/20',
      iconColor: 'text-orange-400',
      change: risk < 50 ? 'Low Risk' : 'Moderate',
      changeUp: risk < 50
    }
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 card-hover group"
        >
          {/* Background gradient accent */}
          <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.color} opacity-10 rounded-full blur-2xl -mr-10 -mt-10 group-hover:opacity-20 transition-opacity`} />
          
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center`}>
                <card.icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <div className={`flex items-center gap-1 text-xs font-medium ${card.changeUp ? 'text-emerald-400' : 'text-orange-400'}`}>
                {card.changeUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {card.change}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">{card.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold tracking-tight">{card.value}</span>
                <span className="text-sm text-muted-foreground">{card.sub}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
