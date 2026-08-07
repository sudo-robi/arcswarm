'use client'

import { useState } from 'react'
import { Shield, Zap, TrendingUp, CheckCircle, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface VaultFormProps {
  onCreate?: (vaultId: string) => void
  onActivate?: () => void
  isActive?: boolean
  vaultId?: string | null
}

export function VaultForm({ onCreate, onActivate, isActive = false, vaultId: propVaultId }: VaultFormProps) {
  const [riskTolerance, setRiskTolerance] = useState<'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'>('MODERATE')
  const [creating, setCreating] = useState(false)
  const [localVaultId, setLocalVaultId] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  const vaultId = propVaultId ?? localVaultId

  const handleCreate = async () => {
    setCreating(true)
    try {
      await new Promise(r => setTimeout(r, 1500))
      const newVaultId = 'vault_' + Date.now()
      setLocalVaultId(newVaultId)
      setShowSuccess(true)
      onCreate?.(newVaultId)
    } catch (err) {
      console.error('Failed to create vault:', err)
    } finally {
      setCreating(false)
    }
  }

  const handleActivate = () => {
    setShowSuccess(false)
    onActivate?.()
  }

  const riskOptions = [
    { 
      value: 'CONSERVATIVE', 
      label: 'Conservative', 
      description: 'Low risk, stable yields (3-5% APY)', 
      icon: Shield,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    { 
      value: 'MODERATE', 
      label: 'Moderate', 
      description: 'Balanced risk/reward (5-8% APY)', 
      icon: Zap,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    { 
      value: 'AGGRESSIVE', 
      label: 'Aggressive', 
      description: 'Higher risk, higher potential (8%+ APY)', 
      icon: TrendingUp,
      color: 'text-orange-500',
      bg: 'bg-orange-500/10'
    },
  ]

  if (showSuccess && vaultId && !creating) {
    return (
      <Dialog open={true} onOpenChange={handleActivate}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden">
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold mb-2">Vault Created!</h3>
            <p className="text-muted-foreground mb-6">
              Deposit USDC to start your autonomous treasury
            </p>
            <div className="p-4 rounded-xl bg-muted/50 border border-border mb-6">
              <p className="text-xs text-muted-foreground mb-1">Vault Address</p>
              <p className="font-mono text-sm font-medium">0x86014c6473574F93d4BFc386541681f8c1200160</p>
            </div>
            <Button 
              onClick={handleActivate}
              className="w-full h-12 bg-gradient-to-r from-primary to-cyan-500 text-white font-semibold glow"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Activate Swarm
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isActive} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">Create Treasury</DialogTitle>
          </div>
          <p className="text-muted-foreground text-sm mt-1">
            Deploy AI agents to manage your USDC automatically
          </p>
        </DialogHeader>
        
        <div className="p-6 space-y-6">
          {/* Risk tolerance selection */}
          <div className="space-y-3">
            <span className="text-sm font-medium">Risk Profile</span>
            <div className="grid grid-cols-3 gap-3">
              {riskOptions.map(({ value, label, description, icon: Icon, color, bg }) => (
                <button
                  key={value}
                  onClick={() => setRiskTolerance(value as any)}
                  className={`
                    p-4 rounded-xl border-2 text-left transition-all
                    ${riskTolerance === value 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50 bg-card'
                    }
                  `}
                >
                  <div className={`w-10 h-10 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${color}`} />
                  </div>
                  <p className="font-medium text-sm mb-1">{label}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight">{description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Create button */}
          <Button 
            onClick={handleCreate}
            disabled={creating}
            className="w-full h-12 bg-gradient-to-r from-primary to-cyan-500 text-white font-semibold glow"
          >
            {creating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                Deploying...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 mr-2" />
                Create Vault
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
