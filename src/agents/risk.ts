import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage } from "./base";

interface RiskAlert {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  type: string;
  message: string;
  timestamp: number;
  resolved: boolean;
}

interface ThreatSignature {
  name: string;
  threshold: number;
  window: number; // ms
  count: number;
  lastSeen: number;
}

export class RiskAgent extends BaseAgent {
  private alerts: RiskAlert[] = [];
  private threats: ThreatSignature[] = [
    { name: "rapid_drawdown", threshold: 5, window: 300_000, count: 0, lastSeen: 0 },
    { name: "concentration_risk", threshold: 30, window: 3_600_000, count: 0, lastSeen: 0 },
    { name: "unusual_outflow", threshold: 10, window: 600_000, count: 0, lastSeen: 0 },
  ];
  private lastScan = 0;
  private scanInterval = 60_000; // 1 minute
  private totalAlerts = 0;

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    console.log(`[${this.config.name}] Running risk scan...`);
    this.lastScan = Date.now();

    // 1. Check all agent wallets
    const walletHealth = await this.checkWallets();

    // 2. Check yield source health
    const yieldHealth = await this.checkYieldSources();

    // 3. Check for anomalies
    const anomalies = await this.detectAnomalies();

    // 4. Update on-chain risk metrics
    const riskScore = this.calculateRiskScore(walletHealth, yieldHealth, anomalies);

    // 5. Check circuit breaker conditions
    if (riskScore >= 80) {
      await this.triggerCircuitBreaker(riskScore);
    }

    // 6. Report to Coordinator
    await this.broadcastMessage("response", {
      action: "riskStatus",
      riskScore,
      alerts: this.alerts.filter((a) => !a.resolved).length,
      walletHealth,
      yieldHealth,
    });
  }

  private async checkWallets(): Promise<number> {
    // In production: check all agent wallet balances and spending
    console.log(`[${this.config.name}] Checking agent wallets...`);
    return 85; // Health score 0-100
  }

  private async checkYieldSources(): Promise<number> {
    // In production: check TVL, utilization rates, contract health
    console.log(`[${this.config.name}] Checking yield sources...`);
    return 90; // Health score 0-100
  }

  private async detectAnomalies(): Promise<string[]> {
    const anomalies: string[] = [];

    for (const threat of this.threats) {
      if (Date.now() - threat.lastSeen > threat.window) {
        threat.count = 0;
      }

      // Simulate anomaly detection
      if (threat.count > threat.threshold) {
        anomalies.push(threat.name);
        this.createAlert("high", threat.name, `Threshold exceeded: ${threat.count}/${threat.threshold}`);
      }
    }

    return anomalies;
  }

  private calculateRiskScore(
    walletHealth: number,
    yieldHealth: number,
    anomalies: string[]
  ): number {
    let score = 0;

    // Wallet health risk (0-30)
    score += (100 - walletHealth) * 0.3;

    // Yield health risk (0-30)
    score += (100 - yieldHealth) * 0.3;

    // Anomaly risk (0-40)
    score += Math.min(anomalies.length * 20, 40);

    return Math.min(Math.round(score), 100);
  }

  private createAlert(
    severity: RiskAlert["severity"],
    type: string,
    message: string
  ) {
    const alert: RiskAlert = {
      id: `alert-${Date.now()}`,
      severity,
      type,
      message,
      timestamp: Date.now(),
      resolved: false,
    };
    this.alerts.push(alert);
    this.totalAlerts++;

    console.log(`[${this.config.name}] ALERT [${severity}]: ${message}`);

    // Notify Coordinator immediately for critical alerts
    if (severity === "critical" || severity === "high") {
      this.broadcastMessage("alert", {
        alertId: alert.id,
        severity,
        type,
        message,
      });
    }
  }

  private async triggerCircuitBreaker(riskScore: number): Promise<void> {
    console.log(
      `[${this.config.name}] CIRCUIT BREAKER TRIGGERED (score: ${riskScore})`
    );

    this.createAlert("critical", "circuit_breaker", `Risk score ${riskScore} exceeds threshold`);

    // Notify Coordinator to pause all agents
    await this.broadcastMessage("alert", {
      action: "circuitBreakerTriggered",
      riskScore,
      timestamp: Date.now(),
    });
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "request":
        if (msg.payload.action === "validateYieldSource") {
          const isValid = await this.validateYieldSource(msg.payload.source);
          await this.sendNanopayment(msg.from, 1000, "validation-result");
          await this.broadcastMessage("response", {
            action: "validationResult",
            source: msg.payload.source,
            valid: isValid,
          });
        } else if (msg.payload.action === "checkFxRisk") {
          const risk = this.assessFxRisk(msg.payload.pair);
          await this.sendNanopayment(msg.from, 1000, "fx-risk-assessment");
          await this.broadcastMessage("response", {
            action: "fxRiskAssessment",
            pair: msg.payload.pair,
            risk,
          });
        }
        break;
      case "response":
        if (msg.payload.action === "riskStatus") {
          console.log(`[${this.config.name}] Risk status update:`, msg.payload);
        }
        break;
    }
  }

  private async validateYieldSource(source: string): Promise<boolean> {
    // In production: check TVL, audit status, contract health
    return true;
  }

  private assessFxRisk(pair: string): number {
    // In production: check spread, volatility, liquidity
    return 25; // Risk score 0-100
  }
}
