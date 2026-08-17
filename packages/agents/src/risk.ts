import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage, AGENT_CONSTANTS } from "./base.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

const RISK_CONSTANTS = {
  SCAN_INTERVAL: 60_000,
  CIRCUIT_BREAKER_SCORE_THRESHOLD: 80,
  RISK_SCORE_CAP: 100,
} as const;

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
  window: number;
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
  private scanInterval = RISK_CONSTANTS.SCAN_INTERVAL;

  async execute(): Promise<void> {
    if (Date.now() - this.lastScan < this.scanInterval) return;

    logger.info({ agent: this.config.name }, "Running risk scan...");
    this.lastScan = Date.now();

    const walletHealth = await this.checkAgentWallets();
    const yieldHealth = await this.checkYieldSources();
    const anomalies = await this.detectAnomalies();

    const riskScore = this.calculateRiskScore(walletHealth, yieldHealth, anomalies);

    try {
      const tx = await this.riskOracle.updateMetrics(
        ethers.parseUnits(yieldHealth.totalExposure.toString(), 6),
        Math.round(yieldHealth.drawdown * 10000)
      );
      await tx.wait();
      logger.info({ agent: this.config.name, riskScore, tx: tx.hash }, "RiskOracle updated");
    } catch (err) {
      logger.error({ agent: this.config.name, err }, "Failed to update RiskOracle");
    }

    if (riskScore >= RISK_CONSTANTS.CIRCUIT_BREAKER_SCORE_THRESHOLD) {
      await this.triggerCircuitBreaker(riskScore);
    }

    await this.broadcastMessage("response", {
      action: "riskStatus",
      riskScore,
      alerts: this.alerts.filter((a) => !a.resolved).length,
      walletHealth,
      yieldHealth,
    });
  }

  private async checkAgentWallets(): Promise<number> {
    const agents = ["yield", "liquidity", "fx", "payment"];
    let totalHealth = 0;
    for (const type of agents) {
      const status = this.agentStatuses.get(type);
      if (status) {
        try {
          const remaining = await this.budgetManager.getRemaining(status.wallet);
          totalHealth += Number(remaining) > 0 ? 100 : 0;
        } catch {
          totalHealth += 0;
        }
      }
    }
    return agents.length > 0 ? totalHealth / agents.length : 0;
  }

  private async checkYieldSources(): Promise<{ totalExposure: number; drawdown: number }> {
    return { totalExposure: 50_000e6, drawdown: 1.5 };
  }

  private async detectAnomalies(): Promise<string[]> {
    const anomalies: string[] = [];

    for (const threat of this.threats) {
      if (Date.now() - threat.lastSeen > threat.window) {
        threat.count = 0;
      }

      if (threat.count > threat.threshold) {
        anomalies.push(threat.name);
        this.createAlert("high", threat.name, `Threshold exceeded: ${threat.count}/${threat.threshold}`);
      }
    }

    return anomalies;
  }

  private calculateRiskScore(walletHealth: number, yieldHealth: { totalExposure: number; drawdown: number }, anomalies: string[]): number {
    let score = 0;
    score += (100 - walletHealth) * 0.3;
    score += yieldHealth.drawdown * 10; // drawdown is already a percentage
    score += Math.min(anomalies.length * 20, 40);
    return Math.min(Math.round(score), RISK_CONSTANTS.RISK_SCORE_CAP);
  }

  private createAlert(severity: RiskAlert["severity"], type: string, message: string) {
    const alert: RiskAlert = {
      id: `alert-${Date.now()}`,
      severity,
      type,
      message,
      timestamp: Date.now(),
      resolved: false,
    };
    this.alerts.push(alert);

    logger.warn({ agent: this.config.name, severity, type, message }, "ALERT");

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
    logger.error({ agent: this.config.name, riskScore }, "CIRCUIT BREAKER TRIGGERED");
    this.createAlert("critical", "circuit_breaker", `Risk score ${riskScore} exceeds threshold`);

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
          const isValid = await this.validateYieldSource(msg.payload.source as string);
          await this.sendNanopayment(msg.from, AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, "validation-result");
          await this.broadcastMessage("response", {
            action: "validationResult",
            source: msg.payload.source,
            valid: isValid,
          });
        } else if (msg.payload.action === "checkFxRisk") {
          const risk = this.assessFxRisk(msg.payload.pair as string);
          await this.sendNanopayment(msg.from, AGENT_CONSTANTS.DEFAULT_NANOPAYMENT, "fx-risk-assessment");
          await this.broadcastMessage("response", {
            action: "fxRiskAssessment",
            pair: msg.payload.pair,
            risk,
          });
        }
        break;
      case "response":
        if (msg.payload.action === "riskStatus") {
          logger.info({ agent: this.config.name, payload: msg.payload }, "Risk status update");
        }
        break;
    }
  }

  private async validateYieldSource(source: string): Promise<boolean> {
    return true;
  }

  private assessFxRisk(pair: string): number {
    return 25;
  }
}