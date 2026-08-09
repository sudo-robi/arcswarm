import { useAgentInfos } from '@/lib/hooks'
import { AGENT_TYPES } from '@/lib/contracts'
import { Bot, Loader2, ExternalLink } from 'lucide-react'

export function AgentGrid() {
  const agents = useAgentInfos(10000)

  const agentList = agents.data ?? []

  return (
    <div className="p-6 rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg">Agent Swarm</h3>
        <span className="text-xs text-muted-foreground">
          {agentList.filter(a => a.active).length} active / {agentList.length} total
        </span>
      </div>

      {agents.loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading agents from Arc testnet...</span>
        </div>
      ) : agentList.length === 0 ? (
        <div className="text-center py-12">
          <Bot className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">No agents registered on-chain yet</p>
          <p className="text-xs text-muted-foreground mt-1">Agents will appear here once deployed to Arc</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agentList.map(agent => {
            const agentType = AGENT_TYPES[agent.agentType] ?? AGENT_TYPES[5]
            return (
              <div key={agent.address} className="p-4 rounded-xl border border-border bg-muted/20 card-hover">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agentType.color} flex items-center justify-center`}>
                      <span className="text-lg">{agentType.icon}</span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{agent.name || agentType.name}</p>
                      <p className="text-[10px] text-muted-foreground">{agentType.type}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${agent.active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Address</span>
                    <a
                      href={`https://testnet.arc.network/address/${agent.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono hover:text-primary transition-colors flex items-center gap-1"
                    >
                      {agent.address.slice(0, 6)}...{agent.address.slice(-4)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Reputation</span>
                    <span className="font-mono">{agent.reputationScore.toString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Status</span>
                    <span className={`font-medium ${agent.active ? 'text-emerald-400' : 'text-red-400'}`}>
                      {agent.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
