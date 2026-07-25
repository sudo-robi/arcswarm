"use client";

import { useEffect, useState } from "react";

interface TreasuryData {
  totalBalance: number;
  allocations: {
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
  yieldEarned: number;
  apy: number;
}

export function TreasuryOverview() {
  const [treasury, setTreasury] = useState<TreasuryData | null>(null);

  useEffect(() => {
    // In production: fetch from vault contract
    setTreasury({
      totalBalance: 76_543_210, // 76.5k USDC
      allocations: [
        { name: "Yield Sources", amount: 30_000e6, percentage: 39.2, color: "bg-emerald-500" },
        { name: "Liquidity Buffer", amount: 15_000e6, percentage: 19.6, color: "bg-blue-500" },
        { name: "FX Positions", amount: 12_000e6, percentage: 15.7, color: "bg-purple-500" },
        { name: "Payment Reserve", amount: 10_000e6, percentage: 13.1, color: "bg-amber-500" },
        { name: "Risk Reserve", amount: 5_000e6, percentage: 6.5, color: "bg-red-500" },
        { name: "Available", amount: 4_543e6, percentage: 5.9, color: "bg-muted" },
      ],
      yieldEarned: 2_345e6,
      apy: 4.2,
    });
  }, []);

  if (!treasury)
    return <div className="animate-pulse h-48 bg-muted rounded-lg" />;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Treasury Overview</h2>
        <div className="text-right">
          <p className="text-2xl font-bold">
            ${(treasury.totalBalance / 1e6).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground">Total Balance</p>
        </div>
      </div>

      {/* Allocation Bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-4">
        {treasury.allocations.map((alloc) => (
          <div
            key={alloc.name}
            className={`${alloc.color} transition-all`}
            style={{ width: `${alloc.percentage}%` }}
            title={`${alloc.name}: ${alloc.percentage}%`}
          />
        ))}
      </div>

      {/* Allocation Legend */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
        {treasury.allocations.map((alloc) => (
          <div key={alloc.name} className="flex items-center gap-2 text-sm">
            <div className={`h-2 w-2 rounded-full ${alloc.color}`} />
            <span className="text-muted-foreground">{alloc.name}</span>
            <span className="ml-auto font-mono">{alloc.percentage}%</span>
          </div>
        ))}
      </div>

      {/* Yield Stats */}
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <p className="text-sm text-muted-foreground">Yield Earned</p>
          <p className="text-lg font-semibold text-emerald-400">
            +${(treasury.yieldEarned / 1e6).toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Current APY</p>
          <p className="text-lg font-semibold">{treasury.apy}%</p>
        </div>
      </div>
    </div>
  );
}
