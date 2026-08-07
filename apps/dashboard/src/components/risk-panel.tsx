'use client'

import { trpc } from '@/lib/trpc'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, ShieldCheck, Shield, Bell } from 'lucide-react'

interface RiskPanelProps {
  vaultId: string | null
}

export function RiskPanel({ vaultId }: RiskPanelProps) {
  const { data: risk } = trpc.risk.getLiveScore.useQuery(
    { riskOracleAddress: '0xF36CB7f4c8D7E267FFfEEa33D0757e1A5a94C3cd' },
    { refetchInterval: 10000 }
  )

  const { data: alerts } = trpc.risk.getAlerts.useQuery(
    { vaultId: vaultId || '' },
    { enabled: !!vaultId, refetchInterval: 10000 }
  )

  const healthy = risk?.healthy ?? true
  const riskScore = risk?.riskScore ?? 0

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${healthy ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
            {healthy ? (
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">Risk Monitor</h3>
            <p className="text-sm text-muted-foreground">
              {healthy ? 'All systems operational' : 'Issues detected'}
            </p>
          </div>
        </div>
        <Badge 
          variant={healthy ? 'default' : 'destructive'} 
          className={`${healthy ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}
        >
          {healthy ? 'SAFE' : 'WARNING'}
        </Badge>
      </div>

      {/* Risk gauge */}
      <div className="mb-6 p-4 rounded-xl bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Risk Score</span>
          <span className="text-lg font-bold">{riskScore}/100</span>
        </div>
        <div className="h-2 bg-background rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all ${
              riskScore < 30 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' :
              riskScore < 70 ? 'bg-gradient-to-r from-amber-500 to-orange-500' :
              'bg-gradient-to-r from-rose-500 to-red-500'
            }`}
            style={{ width: `${riskScore}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-emerald-400">Low</span>
          <span className="text-xs text-amber-400">Medium</span>
          <span className="text-xs text-rose-400">High</span>
        </div>
      </div>

      {/* Alerts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Active Alerts</span>
        </div>
        {alerts?.length ? (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {alerts.slice(0, 5).map((alert) => (
              <div key={alert.id} className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/10 border-l-4 border-l-rose-500">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {alert.severity}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(alert.createdAt).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{alert.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <p className="text-xs text-muted-foreground">No active alerts</p>
          </div>
        )}
      </div>
    </div>
  )
}
