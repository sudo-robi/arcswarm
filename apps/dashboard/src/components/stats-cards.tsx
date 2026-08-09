import { useVaultData, useAgentInfos, usePaymentStats } from '@/lib/hooks'
import { Wallet, Bot, DollarSign, Activity, ArrowUpRight, Loader2 } from 'lucide-react'

export function StatsCards() {
  const vault = useVaultData(5000)
  const agents = useAgentInfos(10000)
  const payments = usePaymentStats(10000)

  const totalBalance = vault.data?.balance ?? '0'
  const totalYield = vault.data?.totalYield ?? '0'
  const activeAgents = agents.data?.filter(a => a.active).length ?? 0
  const totalAgents = agents.data?.length ?? 0
  const paymentCount = payments.data?.paymentCount ?? 0

  const cards = [
    {
      label: 'Total Balance',
      value: `${Number(totalBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      icon: Wallet,
      gradient: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-500/10',
      loading: vault.loading,
    },
    {
      label: 'Yield Earned',
      value: `${Number(totalYield).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      icon: DollarSign,
      gradient: 'from-primary to-violet-500',
      bg: 'bg-primary/10',
      loading: vault.loading,
    },
    {
      label: 'Active Agents',
      value: `${activeAgents} / ${totalAgents}`,
      icon: Bot,
      gradient: 'from-orange-500 to-amber-500',
      bg: 'bg-orange-500/10',
      loading: agents.loading,
    },
    {
      label: 'Payments',
      value: paymentCount.toString(),
      icon: Activity,
      gradient: 'from-blue-500 to-cyan-500',
      bg: 'bg-blue-500/10',
      loading: payments.loading,
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="p-5 rounded-2xl border border-border bg-card card-hover relative overflow-hidden group">
          <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
          
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
              <card.icon className={`w-5 h-5 bg-gradient-to-br ${card.gradient} text-transparent`} style={{ color: 'inherit' }} />
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{card.label}</p>
          
          {card.loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <p className="text-xl font-bold">{card.value}</p>
          )}
        </div>
      ))}
    </div>
  )
}
