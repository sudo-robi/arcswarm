import { useState } from 'react'
import { trpc } from '@/providers'
import { WalletConnect } from '@/components/wallet-connect'
import { VaultForm } from '@/components/vault-form'
import { StatsCards } from '@/components/stats-cards'
import { AgentGrid } from '@/components/agent-grid'
import { TransactionFeed } from '@/components/transaction-feed'
import { RiskPanel } from '@/components/risk-panel'
import { TreasuryOverview } from '@/components/treasury-overview'
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

const DEMO_VAULT = {
  id: 'vault-demo-001',
  address: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  isActive: true,
  riskTolerance: 3,
}

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
        fixed top-0 left-0 h-full w-64 bg-card border-r border-border z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
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

function Header({ onMenuClick }: { onMenuClick: () => void }) {
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
        <div className="flex items-center gap-2 sm:gap-3">
          <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
            <Bell className="w-5 h-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </button>
          <button className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Settings className="w-5 h-5 text-muted-foreground" />
          </button>
          <div className="w-px h-8 bg-border mx-1 sm:mx-2 hidden sm:block" />
          <WalletConnect />
        </div>
      </div>
    </header>
  )
}

function EmptyState({ onCreateVault }: { onCreateVault: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] p-4 sm:p-8">
      <div className="relative mb-8">
        <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-primary/20 pulse-ring" />
        <div className="absolute inset-0 w-32 h-32 rounded-full border-2 border-primary/10 pulse-ring" style={{ animationDelay: '0.5s' }} />
        <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-cyan-500/20 border border-primary/30 flex items-center justify-center glow">
          <Bot className="w-16 h-16 text-primary" />
        </div>
      </div>

      <h2 className="text-2xl sm:text-3xl font-bold mb-3 gradient-text text-center">Initialize Your Treasury</h2>
      <p className="text-muted-foreground text-center max-w-md mb-8 text-sm sm:text-base">
        Deploy autonomous AI agents to manage your USDC treasury on Arc. 
        Earn yield, manage risk, and execute payments automatically.
      </p>

      <button
        onClick={onCreateVault}
        className="px-6 sm:px-8 py-3 sm:py-4 rounded-xl bg-gradient-to-r from-primary to-cyan-500 text-white font-semibold text-base sm:text-lg glow hover:opacity-90 transition-opacity flex items-center gap-2"
      >
        <Zap className="w-5 h-5" />
        Create Treasury Vault
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-12 w-full max-w-5xl">
        <div className="p-6 rounded-2xl bg-card border border-border card-hover">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Zap className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Nanopayments</h3>
          <p className="text-sm text-muted-foreground">Agent-to-agent micro-transactions via x402 protocol</p>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border card-hover">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <Shield className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="font-semibold mb-2">Risk Oracle</h3>
          <p className="text-sm text-muted-foreground">ERC-8183 automated circuit breakers</p>
        </div>
        <div className="p-6 rounded-2xl bg-card border border-border card-hover">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-4">
            <Activity className="w-6 h-6 text-cyan-500" />
          </div>
          <h3 className="font-semibold mb-2">Cross-Chain</h3>
          <p className="text-sm text-muted-foreground">Circle App Kits for unified balances</p>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [showVaultForm, setShowVaultForm] = useState(false)
  const [localVault, setLocalVault] = useState<{ id: string; address: string; name: string } | null>(() => {
    try {
      const stored = localStorage.getItem('arcswarm-vault')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  
  const { data: vaults } = trpc.vault.getAll.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  })

  const activeVault = vaults?.find(v => v.isActive) ?? localVault ?? (vaults === undefined && !localVault ? DEMO_VAULT : undefined)

  return (
    <div className="flex h-screen overflow-hidden bg-background grid-pattern">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} activeTab={activeTab} onTabChange={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && activeVault && (
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
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Vault</p>
                    <p className="font-mono text-sm font-medium">
                      {activeVault.address.slice(0, 8)}...{activeVault.address.slice(-6)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-xs font-medium text-emerald-400">Swarm Active</span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </div>

              <StatsCards vaultId={activeVault.id} />

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-6">
                <div className="xl:col-span-2 space-y-4 sm:space-y-6">
                  <TreasuryOverview vaultId={activeVault.id} />
                  <AgentGrid vaultId={activeVault.id} />
                </div>
                <div className="space-y-4 sm:space-y-6">
                  <RiskPanel vaultId={activeVault.id} />
                  <TransactionFeed vaultId={activeVault.id} />
                </div>
              </div>
            </>
          )}

          {activeTab === 'dashboard' && !activeVault && (
            <EmptyState onCreateVault={() => setShowVaultForm(true)} />
          )}

          {activeTab === 'treasury' && activeVault && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Treasury</h2>
              <StatsCards vaultId={activeVault.id} />
              <TreasuryOverview vaultId={activeVault.id} />
            </div>
          )}

          {activeTab === 'agents' && activeVault && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Agents</h2>
              <AgentGrid vaultId={activeVault.id} />
            </div>
          )}

          {activeTab === 'risk' && activeVault && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Risk Monitor</h2>
              <RiskPanel vaultId={activeVault.id} />
            </div>
          )}

          {activeTab === 'yield' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Yield Strategies</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {[
                  { name: 'Conservative', apy: '3-5%', risk: 'Low', color: 'from-blue-500 to-cyan-500', desc: 'Stable yields via USDC lending' },
                  { name: 'Balanced', apy: '5-8%', risk: 'Medium', color: 'from-primary to-violet-500', desc: 'Diversified yield strategies' },
                  { name: 'Aggressive', apy: '8%+', risk: 'High', color: 'from-orange-500 to-red-500', desc: 'Maximum yield, higher exposure' },
                  { name: 'Liquidity Pool', apy: '4-7%', risk: 'Medium', color: 'from-emerald-500 to-teal-500', desc: 'Arc-native liquidity provision' },
                  { name: 'Cross-Chain', apy: '5-9%', risk: 'Medium', color: 'from-pink-500 to-rose-500', desc: 'CCTP-powered yield farming' },
                ].map(s => (
                  <div key={s.name} className="p-6 rounded-2xl border border-border bg-card card-hover">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-4`}>
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">{s.name}</h3>
                    <p className="text-2xl font-bold gradient-text mb-2">{s.apy} APY</p>
                    <p className="text-sm text-muted-foreground mb-2">Risk: {s.risk}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab !== 'dashboard' && !activeVault && (
            <EmptyState onCreateVault={() => setShowVaultForm(true)} />
          )}
        </main>
      </div>

      <VaultForm 
        isActive={showVaultForm}
        onCreate={(vaultId) => {
          const vault = { id: vaultId, address: '0x86014c6473574F93d4BFc386541681f8c1200160', name: 'My Treasury' }
          setLocalVault(vault)
          localStorage.setItem('arcswarm-vault', JSON.stringify(vault))
        }}
        onActivate={() => setShowVaultForm(false)}
      />
    </div>
  )
}
