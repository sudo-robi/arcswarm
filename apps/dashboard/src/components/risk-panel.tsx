import { useRiskMetrics } from '@/lib/hooks'
import { RISK_ORACLE_ADDRESS } from '@/lib/contracts'
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, Loader2, ExternalLink } from 'lucide-react'

export function RiskPanel() {
  const risk = useRiskMetrics(10000)

  const riskScore = risk.data?.riskScore ?? '0'
  const healthy = risk.data?.healthy ?? true
  const paused = risk.data?.paused ?? false
  const totalExposure = risk.data?.totalExposure ?? '0'
  const currentDrawdown = risk.data?.currentDrawdown ?? '0'

  const scoreNum = Number(riskScore)
  const gaugePercent = Math.min(scoreNum, 100)

  let gaugeColor = 'from-emerald-500 to-teal-500'
  let statusText = 'Healthy'
  let statusColor = 'text-emerald-400'
  let StatusIcon = ShieldCheck

  if (paused) {
    gaugeColor = 'from-red-500 to-rose-500'
    statusText = 'Circuit Breaker Active'
    statusColor = 'text-red-400'
    StatusIcon = ShieldAlert
  } else if (scoreNum > 70) {
    gaugeColor = 'from-orange-500 to-red-500'
    statusText = 'Elevated Risk'
    statusColor = 'text-orange-400'
    StatusIcon = AlertTriangle
  } else if (scoreNum > 40) {
    gaugeColor = 'from-yellow-500 to-orange-500'
    statusText = 'Moderate'
    statusColor = 'text-yellow-400'
    StatusIcon = Shield
  }

  return (
    <div className="p-6 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg">Risk Monitor</h3>
        <a
          href={`https://testnet.arcscan.app/address/${RISK_ORACLE_ADDRESS}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          RiskOracle
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {risk.loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading risk data...</span>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${gaugePercent * 2.51} 251`}
                  className={`bg-gradient-to-r ${gaugeColor}`}
                  style={{ stroke: 'url(#gaugeGradient)' }}
                />
                <defs>
                  <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" className="text-emerald-500" stopColor="currentColor" />
                    <stop offset="50%" className="text-yellow-500" stopColor="currentColor" />
                    <stop offset="100%" className="text-red-500" stopColor="currentColor" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{riskScore}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Risk Score</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            <StatusIcon className={`w-4 h-4 ${statusColor}`} />
            <span className={`text-sm font-medium ${statusColor}`}>{statusText}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Total Exposure</p>
              <p className="font-mono text-sm font-medium">{Number(totalExposure).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Drawdown</p>
              <p className="font-mono text-sm font-medium">{Number(currentDrawdown).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Circuit Breaker</p>
              <p className={`font-mono text-sm font-medium ${paused ? 'text-red-400' : 'text-emerald-400'}`}>
                {paused ? 'TRIGGERED' : 'Normal'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Network</p>
              <p className="font-mono text-sm font-medium">Arc Testnet</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
