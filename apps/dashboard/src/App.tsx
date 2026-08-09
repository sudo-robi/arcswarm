import { useState, useEffect } from 'react'
import { WalletConnect } from '@/components/wallet-connect'
import { StatsCards } from '@/components/stats-cards'
import { AgentGrid } from '@/components/agent-grid'
import { RiskPanel } from '@/components/risk-panel'
import { TreasuryOverview } from '@/components/treasury-overview'
import { useVaultData, useAgentInfos, useRiskMetrics, usePaymentStats } from '@/lib/hooks'
import { VAULT_ADDRESS } from '@/lib/contracts'
import { 
  Shield, 
  Zap, 
  Bot, 
  Activity,
  Wallet,
  Settings,
  Bell,
  Search,
  Menu,
  ChevronRight,
  Sparkles,
  TrendingUp
} from 'lucide-react'

type Tab = 'dashboard' | 'treasury' | 'agents' | 'risk' | 'yield'

const NAV_ITEMS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity },
  { id: 'treasury', label: 'Treasury', icon: Wallet },
  { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'risk', label: 'Risk Monitor', icon: Shield },
  { id: 'yield', label: 'Yield Strategies', icon: Sparkles },
]

function Sidebar({ isOpen, onClose, activeTab, onTabChange }: {
  isOpen: boolean
  onClose: () => void
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}) {
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside className={`
        fixed top-0 left-0 h-screen w-64 bg-card border-r border-border z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen
        shrink-0
      `}>
        <div className="flex flex-col h-full">
          <div className="flex items-center gap-3 p-6 border-b border-border">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-cyan-500 flex items-center justify-center glow">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold gradient-text">ArcSwarm</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Treasury OS</p>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => { onTabChange(id); onClose() }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-left ${
                  activeTab === id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-border">
            <div className="p-4 rounded-xl bg-gradient-to-br from-primary/20 to-cyan-500/20 border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-400">Network Online</span>
              </div>
              <p className="text-xs text-muted-foreground">Arc Testnet</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

function NotificationsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notifications = [
    { id: 1, title: 'Vault Deposited', desc: '9.00 USDC deposited into ArcSwarmVault', time: '2h ago', type: 'success' as const },
    { id: 2, title: 'Agent Registered', desc: 'YieldAgent, LiquidityAgent, FXAgent joined the swarm', time: '2h ago', type: 'info' as const },
    { id: 3, title: 'Payment Sent', desc: '0.50 USDC transferred to YieldAgent', time: '2h ago', type: 'success' as const },
    { id: 4, title: 'Risk Updated', desc: 'RiskOracle score set to 100 — all clear', time: '2h ago', type: 'info' as const },
    { id: 5, title: 'Circuit Breaker', desc: 'Circuit breaker armed and monitoring', time: '2h ago', type: 'warning' as const },
  ]

  if (!open) return null

  return (
    <div className="absolute top-14 right-4 w-80 max-h-96 overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl z-50">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm">Notifications</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Clear all</button>
      </div>
      <div className="divide-y divide-border">
        {notifications.map(n => (
          <div key={n.id} className="p-4 hover:bg-muted/50 transition-colors">
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                n.type === 'success' ? 'bg-emerald-500' : n.type === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              <div className="min-w-0">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.desc}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  return (
    <div className="absolute top-14 right-4 w-72 rounded-2xl border border-border bg-card shadow-2xl z-50">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h3 className="font-semibold text-sm">Settings</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Network</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Chain</span>
              <span className="text-sm font-mono">Arc Testnet</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Chain ID</span>
              <span className="text-sm font-mono">5042002</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Currency</span>
              <span className="text-sm font-mono">USDC</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Display</p>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Theme</span>
              <span className="text-sm text-muted-foreground">System</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Currency</span>
              <span className="text-sm text-muted-foreground">USDC</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border pt-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Contracts</p>
          <div className="space-y-1">
            {[
              ['Vault', '0x68c104C3...55AB3C'],
              ['Registry', '0xD168D318...2e0Ab'],
              ['Budget', '0x61dAF0E0...71F8'],
              ['Risk', '0x255C0534...18a7'],
              ['Payments', '0x5CEed60c...e0Ab'],
            ].map(([label, addr]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-mono">{addr}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const [notifsOpen, setNotifsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-card/80 backdrop-blur-xl">
      <div className="flex items-center justify-between h-full px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border w-64 lg:w-80">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search agents, transactions..." 
              className="bg-transparent text-sm focus:outline-none w-full"
            />
            <kbd className="hidden lg:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 relative">
          <button 
            onClick={() => { setNotifsOpen(!notifsOpen); setSettingsOpen(false) }}
            className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </button>
          <button 
            onClick={() => { setSettingsOpen(!settingsOpen); setNotifsOpen(false) }}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="w-px h-8 bg-border mx-1 sm:mx-2 hidden sm:block" />
          <WalletConnect />
          <NotificationsPanel open={notifsOpen} onClose={() => setNotifsOpen(false)} />
          <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </div>
    </header>
  )
}

function YieldStrategies() {
  const vault = useVaultData(30000)
  const agents = useAgentInfos(30000)
  const totalYield = vault.data?.totalYield ?? '0'
  const balance = vault.data?.balance ?? '0'

  const strategies = [
    { name: 'USDC Lending', apy: '3-5%', risk: 'Low', color: 'from-blue-500 to-cyan-500', desc: 'Stable yields via Arc-native lending protocols', allocated: balance },
    { name: 'Liquidity Provision', apy: '5-8%', risk: 'Medium', color: 'from-primary to-violet-500', desc: 'Arc DEX liquidity with automated rebalancing', allocated: '0' },
    { name: 'Cross-Chain Yield', apy: '4-7%', risk: 'Medium', color: 'from-emerald-500 to-teal-500', desc: 'CCTP-powered yield farming across chains', allocated: '0' },
    { name: 'Agent-Managed', apy: '6-10%', risk: 'Medium', color: 'from-orange-500 to-amber-500', desc: 'AI-optimized yield strategies via agent swarm', allocated: totalYield },
    { name: 'Risk-Adjusted', apy: '4-6%', risk: 'Low', color: 'from-pink-500 to-rose-500', desc: 'Dynamic allocation based on RiskOracle signals', allocated: '0' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Yield Strategies</h2>
          <p className="text-muted-foreground text-sm mt-1">On-chain vault data from Arc Testnet</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Total Yield Earned</p>
          <p className="text-2xl font-bold gradient-text">{totalYield} USDC</p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {strategies.map(s => (
          <div key={s.name} className="p-6 rounded-2xl border border-border bg-card card-hover">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-4`}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <h3 className="font-semibold text-lg mb-1">{s.name}</h3>
            <p className="text-2xl font-bold gradient-text mb-2">{s.apy} APY</p>
            <p className="text-sm text-muted-foreground mb-2">Risk: {s.risk}</p>
            <p className="text-xs text-muted-foreground mb-3">{s.desc}</p>
            {s.allocated !== '0' && (
              <div className="pt-3 border-t border-border">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Allocated</p>
                <p className="text-sm font-mono font-medium">{s.allocated} USDC</p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl border border-border bg-card">
        <h3 className="font-semibold mb-4">On-Chain Vault Status</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Vault Address</p>
            <p className="font-mono text-sm">{VAULT_ADDRESS.slice(0, 10)}...{VAULT_ADDRESS.slice(-6)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Balance</p>
            <p className="font-mono text-sm">{vault.data?.balance ?? '...'} USDC</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Yield</p>
            <p className="font-mono text-sm">{totalYield} USDC</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Active Agents</p>
            <p className="font-mono text-sm">{agents.data?.filter(a => a.active).length ?? '...'}/{agents.data?.length ?? '...'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')

  return (
    <div className="flex min-h-screen max-w-full overflow-x-clip bg-background grid-pattern">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 p-4 rounded-2xl glass border border-border">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-card" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Live Vault</p>
                    <p className="font-mono text-sm font-medium">
                      {VAULT_ADDRESS.slice(0, 10)}...{VAULT_ADDRESS.slice(-6)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-xs font-medium text-emerald-400">Arc Testnet</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>

              <StatsCards />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
                <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                  <TreasuryOverview />
                  <AgentGrid />
                </div>
                <div className="space-y-4 sm:space-y-6">
                  <RiskPanel />
                </div>
              </div>
            </>
          )}

          {activeTab === 'treasury' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Treasury</h2>
              <StatsCards />
              <TreasuryOverview />
            </div>
          )}

          {activeTab === 'agents' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Agents</h2>
              <AgentGrid />
            </div>
          )}

          {activeTab === 'risk' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Risk Monitor</h2>
              <RiskPanel />
            </div>
          )}

          {activeTab === 'yield' && (
            <YieldStrategies />
          )}
        </main>
      </div>
    </div>
  )
}
