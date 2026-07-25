"use client";

import { useEffect, useState } from "react";

interface Transaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  type: "deposit" | "withdrawal" | "nanopayment" | "payment" | "allocation";
  memo?: string;
  timestamp: string;
}

const TYPE_COLORS: Record<string, string> = {
  deposit: "bg-emerald-500/20 text-emerald-400",
  withdrawal: "bg-red-500/20 text-red-400",
  nanopayment: "bg-blue-500/20 text-blue-400",
  payment: "bg-amber-500/20 text-amber-400",
  allocation: "bg-purple-500/20 text-purple-400",
};

export function TransactionFeed() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    // Simulate live transactions
    const mockTxs: Transaction[] = [
      {
        id: "1",
        from: "Yield Agent",
        to: "Risk Agent",
        amount: 1000,
        type: "nanopayment",
        memo: "Validate yield source AAVE",
        timestamp: "Just now",
      },
      {
        id: "2",
        from: "Coordinator",
        to: "Yield Agent",
        amount: 30_000e6,
        type: "allocation",
        memo: "Budget allocation",
        timestamp: "2 min ago",
      },
      {
        id: "3",
        from: "FX Agent",
        to: "Risk Agent",
        amount: 1000,
        type: "nanopayment",
        memo: "FX risk check EURC/USDC",
        timestamp: "3 min ago",
      },
      {
        id: "4",
        from: "Payment Agent",
        to: "0xAbc...1234",
        amount: 5_000e6,
        type: "payment",
        memo: "Contractor payment",
        timestamp: "5 min ago",
      },
      {
        id: "5",
        from: "User",
        to: "Vault",
        amount: 50_000e6,
        type: "deposit",
        memo: "Initial deposit",
        timestamp: "10 min ago",
      },
    ];
    setTransactions(mockTxs);
  }, []);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold mb-4">Live Transaction Feed</h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-start gap-3 p-2 rounded-lg bg-background"
          >
            <div className="mt-1">
              <span
                className={`inline-block px-2 py-0.5 text-xs rounded ${TYPE_COLORS[tx.type]}`}
              >
                {tx.type}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 text-sm">
                <span className="font-medium truncate">{tx.from}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium truncate">{tx.to}</span>
              </div>
              {tx.memo && (
                <p className="text-xs text-muted-foreground truncate">
                  {tx.memo}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-mono">
                {tx.amount < 100_000
                  ? `${tx.amount} wei`
                  : `$${(tx.amount / 1e6).toLocaleString()}`}
              </p>
              <p className="text-xs text-muted-foreground">{tx.timestamp}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
