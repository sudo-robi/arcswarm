"use client";

import { useEffect, useState } from "react";

interface RiskMetrics {
  riskScore: number;
  circuitBreakerActive: boolean;
  drawdown: number;
  exposure: number;
  lastCheck: string;
}

export function RiskPanel() {
  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);

  useEffect(() => {
    // In production: fetch from RiskOracle contract
    setMetrics({
      riskScore: 23,
      circuitBreakerActive: false,
      drawdown: 2.1,
      exposure: 45_000,
      lastCheck: "30 sec ago",
    });
  }, []);

  if (!metrics) return <div className="animate-pulse h-48 bg-muted rounded-lg" />;

  const getScoreColor = (score: number) => {
    if (score < 30) return "text-emerald-400";
    if (score < 60) return "text-amber-400";
    return "text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score < 30) return "bg-emerald-500";
    if (score < 60) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Risk Monitor</h2>
        {metrics.circuitBreakerActive && (
          <span className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded animate-pulse">
            CIRCUIT BREAKER
          </span>
        )}
      </div>

      <div className="space-y-4">
        {/* Risk Score Gauge */}
        <div className="text-center">
          <div className="relative inline-flex items-center justify-center">
            <svg className="h-24 w-24" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                strokeDasharray={`${metrics.riskScore * 2.51} 251`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                className={getScoreColor(metrics.riskScore)}
              />
            </svg>
            <div className="absolute">
              <p className={`text-2xl font-bold ${getScoreColor(metrics.riskScore)}`}>
                {metrics.riskScore}
              </p>
              <p className="text-xs text-muted-foreground">/ 100</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Risk Score</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-background p-3">
            <p className="text-xs text-muted-foreground">Drawdown</p>
            <p className="text-lg font-semibold">{metrics.drawdown}%</p>
            <div className="h-1 bg-muted rounded-full mt-1">
              <div
                className={`h-full ${getScoreBg(metrics.drawdown > 5 ? 80 : metrics.drawdown > 3 ? 50 : 20)} rounded-full`}
                style={{ width: `${Math.min(metrics.drawdown * 10, 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-lg bg-background p-3">
            <p className="text-xs text-muted-foreground">Exposure</p>
            <p className="text-lg font-semibold">
              ${(metrics.exposure / 1000).toFixed(0)}k
            </p>
            <p className="text-xs text-muted-foreground">of $100k limit</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <span>Last check: {metrics.lastCheck}</span>
          <span
            className={
              metrics.circuitBreakerActive ? "text-red-400" : "text-emerald-400"
            }
          >
            {metrics.circuitBreakerActive ? "PAUSED" : "OPERATIONAL"}
          </span>
        </div>
      </div>
    </div>
  );
}
