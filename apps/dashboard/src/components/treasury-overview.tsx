import { useVaultData } from '@/lib/hooks'
import { VAULT_ADDRESS } from '@/lib/contracts'
import { Wallet, TrendingUp, ArrowDownRight, ArrowUpRight, Loader2, ExternalLink } from 'lucide-react'

export function TreasuryOverview() {
  const vault = useVaultData(5000)
  const balance = vault.data?.balance ?? '0'
  const totalDeposits = vault.data?.totalDeposits ?? '0'
  const totalYield = vault.data?.totalYield ?? '0'
  const depositorCount = vault.data?.depositorCount ?? 0

  const metrics = [
    {
      label: 'Vault Balance',
      value: `${Number(balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      icon: Wallet,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Total Deposits',
      value: `${Number(totalDeposits).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      icon: ArrowDownRight,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      label: 'Total Yield',
      value: `${Number(totalYield).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`,
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Depositors',
      value: depositorCount.toString(),
      icon: ArrowUpRight,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10',
    },
  ]

  return (
    <div className="p-6 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg">Treasury Overview</h3>
        <a
          href={`https://testnet.arcscan.app/address/${VAULT_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          View on Explorer
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.label} className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center mb-3`}>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{m.label}</p>
            {vault.loading ? (
              <div className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Loading</span>
              </div>
            ) : (
              <p className="text-lg font-bold font-mono">{m.value}</p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 rounded-xl bg-muted/20 border border-border/30">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Contract Address</span>
          <a
            href={`https://testnet.arcscan.app/address/${VAULT_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            {VAULT_ADDRESS}
          </a>
        </div>
      </div>
    </div>
  )
}
