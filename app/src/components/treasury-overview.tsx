"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import {
  ARC_TESTNET,
  CONTRACTS,
  VAULT_ABI,
  BUDGET_MANAGER_ABI,
} from "@/lib/contracts";

interface TreasuryData {
  totalBalance: number;
  totalDeposits: number;
  totalYield: number;
  allocations: {
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
}

export function TreasuryOverview() {
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);

  useEffect(() => {
    const fetchTreasury = async () => {
      try {
        const provider = new ethers.JsonRpcProvider(ARC_TESTNET.rpcUrl);
        const vault = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);
        const budgetMgr = new ethers.Contract(CONTRACTS.budgetManager, BUDGET_MANAGER_ABI, provider);

        const [balance, deposits, yieldEarned] = await Promise.all([
          vault.getVaultBalance(),
          vault.totalDeposits(),
          vault.totalYield(),
        ]);

        const totalBalance = Number(balance);
        const totalDeposits = Number(deposits);
        const totalYield = Number(yieldEarned);

        const allocations = [
          { name: "In Vault", amount: totalBalance, color: "bg-emerald-500" },
          { name: "Deposited", amount: totalDeposits, color: "bg-blue-500" },
          { name: "Yield Earned", amount: totalYield, color: "bg-amber-500" },
        ].map((a) => ({
          ...a,
          percentage: totalBalance > 0 ? (a.amount / totalBalance) * 100 : 0,
        }));

        setTreasury({
          totalBalance,
          totalDeposits,
          totalYield,
          allocations,
        });
      } catch (e) {
        console.error("Failed to fetch treasury:", e);
      }
    };

    fetchTreasury();
    const interval = setInterval(fetchTreasury, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!treasury) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-4">Treasury Overview</h2>
        <div className="animate-pulse h-48 bg-muted rounded-lg" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Treasury Overview</h2>
        <div className="text-right">
          <p className="text-2xl font-bold">
            ${(treasury.totalBalance / 1e6).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Vault Balance</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        {treasury.allocations.map((alloc) => (
          <div key={alloc.name} className="text-center">
            <p className="text-lg font-semibold">
              ${(alloc.amount / 1e6).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{alloc.name}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <p className="text-sm text-muted-foreground">Total Deposits</p>
          <p className="text-lg font-semibold">
            ${(treasury.totalDeposits / 1e6).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Yield Earned</p>
          <p className="text-lg font-semibold text-emerald-400">
            +${(treasury.totalYield / 1e6).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
