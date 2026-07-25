"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  ARC_TESTNET,
  CONTRACTS,
  VAULT_ABI,
  PAYMENT_ROUTER_ABI,
} from "@/lib/contracts";

interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "nanopayment" | "payment" | "allocation" | "yield";
  from: string;
  to: string;
  amount: number;
  memo?: string;
  timestamp: number;
}

const TYPE_COLORS: Record<string, string> = {
  deposit: "bg-emerald-500/20 text-emerald-400",
  withdrawal: "bg-red-500/20 text-red-400",
  nanopayment: "bg-blue-500/20 text-blue-400",
  payment: "bg-amber-500/20 text-amber-400",
  allocation: "bg-purple-500/20 text-purple-400",
  yield: "bg-emerald-500/20 text-emerald-400",
};

function truncateAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000) - timestamp;
  if (seconds < 60) return seconds + "s ago";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
  return Math.floor(seconds / 86400) + "d ago";
}

export function TransactionFeed() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetchTransactions = async (): Promise<void> => {
      try {
        const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
        const vault = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);

        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 1000);

        const depositFilter = vault.filters.Deposited();
        const withdrawFilter = vault.filters.Withdrawn();
        const yieldFilter = vault.filters.YieldHarvested();

        const [depositEvents, withdrawEvents, yieldEvents] = await Promise.all([
          vault.queryFilter(depositFilter, fromBlock, latestBlock),
          vault.queryFilter(withdrawFilter, fromBlock, latestBlock),
          vault.queryFilter(yieldFilter, fromBlock, latestBlock),
        ]);

        const txs: Transaction[] = [];

        for (const e of depositEvents) {
          const block = await e.getBlock();
          const args = (e as any).args;
          if (!args) continue;
          txs.push({
            id: e.transactionHash + "-dep",
            type: "deposit",
            from: String(args[0] ?? ""),
            to: "Vault",
            amount: Number(args[1] ?? 0),
            timestamp: block.timestamp,
          });
        }

        for (const e of withdrawEvents) {
          const block = await e.getBlock();
          const args = (e as any).args;
          if (!args) continue;
          txs.push({
            id: e.transactionHash + "-wit",
            type: "withdrawal",
            from: "Vault",
            to: String(args[0] ?? ""),
            amount: Number(args[1] ?? 0),
            timestamp: block.timestamp,
          });
        }

        for (const e of yieldEvents) {
          const block = await e.getBlock();
          const args = (e as any).args;
          if (!args) continue;
          txs.push({
            id: e.transactionHash + "-yld",
            type: "yield",
            from: "Protocol",
            to: "Vault",
            amount: Number(args[0] ?? 0),
            memo: "Yield harvested",
            timestamp: block.timestamp,
          });
        }

        txs.sort((a, b) => b.timestamp - a.timestamp);
        setTransactions(txs.slice(0, 20));
      } catch (e) {
        console.error("Failed to fetch transactions:", e);
      }
    };

    fetchTransactions();
    const interval = setInterval(fetchTransactions, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h2 className="text-lg font-semibold mb-4">Live Transaction Feed</h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No transactions yet. Deposit USDC to get started.
          </p>
        ) : (
          transactions.map((tx) => (
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
                  <span className="font-medium truncate">
                    {tx.from.length > 10 ? truncateAddress(tx.from) : tx.from}
                  </span>
                  <span className="text-muted-foreground">&rarr;</span>
                  <span className="font-medium truncate">
                    {tx.to.length > 10 ? truncateAddress(tx.to) : tx.to}
                  </span>
                </div>
                {tx.memo && (
                  <p className="text-xs text-muted-foreground truncate">
                    {tx.memo}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-mono">
                  ${(tx.amount / 1e6).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{timeAgo(tx.timestamp)}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
