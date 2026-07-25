import { StatsCards } from "@/components/stats-cards";
import { AgentGrid } from "@/components/agent-grid";
import { TransactionFeed } from "@/components/transaction-feed";
import { RiskPanel } from "@/components/risk-panel";
import { TreasuryOverview } from "@/components/treasury-overview";

export default function Dashboard() {
  return (
    <main className="container mx-auto p-6">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
            <svg
              className="h-6 w-6 text-primary-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">ArcSwarm</h1>
            <p className="text-sm text-muted-foreground">
              Autonomous Treasury Management on Arc
            </p>
          </div>
        </div>
      </header>

      <StatsCards />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2 space-y-6">
          <TreasuryOverview />
          <AgentGrid />
        </div>
        <div className="space-y-6">
          <RiskPanel />
          <TransactionFeed />
        </div>
      </div>
    </main>
  );
}
