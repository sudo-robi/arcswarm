import { BaseAgent, AgentConfig, AgentMessage } from "./base.js";
import { CONTRACTS } from "@arcswarm/shared/contracts";
import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

interface ScheduledPayment {
  id: string;
  recipient: string;
  amount: number;
  memo: string;
  scheduledTime: number;
  recurring: boolean;
  interval?: number;
  executed: boolean;
}

interface PaymentBatch {
  payments: ScheduledPayment[];
  totalAmount: number;
  scheduledExecution: number;
}

export class PaymentAgent extends BaseAgent {
  private scheduledPayments: ScheduledPayment[] = [];
  private lastProcess = 0;
  private processInterval = 60_000;

  async execute(): Promise<void> {
    if (Date.now() - this.lastProcess < this.processInterval) return;

    logger.info({ agent: this.config.name }, "Processing payments...");
    this.lastProcess = Date.now();

    const duePayments = this.scheduledPayments.filter(
      (p) => !p.executed && p.scheduledTime <= Date.now()
    );

    if (duePayments.length === 0) {
      logger.debug({ agent: this.config.name }, "No payments due");
      return;
    }

    const batches = this.batchPayments(duePayments);
    const totalNeeded = batches.reduce((sum, b) => sum + b.totalAmount, 0);

    await this.sendNanopayment("0xLIQUIDITY_AGENT", 1000, `reserve-need-${totalNeeded}`);

    for (const batch of batches) {
      logger.info({ agent: this.config.name, count: batch.payments.length, total: batch.totalAmount / 1e6 }, "Executing batch");
      await this.executeBatch(batch);
    }

    await this.broadcastMessage("response", {
      action: "paymentsProcessed",
      count: duePayments.length,
      totalAmount: totalNeeded,
    });
  }

  private batchPayments(payments: ScheduledPayment[]): PaymentBatch[] {
    const batches: PaymentBatch[] = [];
    const batchSize = 10;

    for (let i = 0; i < payments.length; i += batchSize) {
      const batch = payments.slice(i, i + batchSize);
      batches.push({
        payments: batch,
        totalAmount: batch.reduce((sum, p) => sum + p.amount, 0),
        scheduledExecution: Date.now(),
      });
    }
    return batches;
  }

  private async executeBatch(batch: PaymentBatch): Promise<void> {
    for (const payment of batch.payments) {
      try {
        logger.info({ agent: this.config.name, to: payment.recipient, amount: payment.amount / 1e6, memo: payment.memo }, "Processing payment");

        if (payment.amount <= 10_000) { // ≤0.01 USDC = nanopayment
          await this.sendNanopayment(payment.recipient, payment.amount, payment.memo);
        } else {
          // Large payment via PaymentRouter
          await this.broadcastMessage("request", {
            action: "executePayment",
            to: payment.recipient,
            amount: payment.amount,
            memo: payment.memo,
          });
        }

        payment.executed = true;
        await this.spendBudget(payment.amount);

        if (payment.recurring && payment.interval) {
          payment.scheduledTime = Date.now() + payment.interval;
          payment.executed = false;
        }
      } catch (err) {
        logger.error({ agent: this.config.name, err }, "Payment failed");
      }
    }
  }

  addScheduledPayment(payment: Omit<ScheduledPayment, "executed">) {
    this.scheduledPayments.push({ ...payment, executed: false });
    logger.info({ agent: this.config.name, id: payment.id }, "Scheduled payment added");
  }

  get7DayForecast(): number {
    const weekLater = Date.now() + 7 * 24 * 60 * 60 * 1000;
    return this.scheduledPayments
      .filter((p) => p.scheduledTime <= weekLater)
      .reduce((sum, p) => sum + p.amount, 0);
  }

  async handleMessage(msg: AgentMessage): Promise<void> {
    switch (msg.type) {
      case "request":
        if (msg.payload.action === "addPayment") {
          this.addScheduledPayment(msg.payload.payment);
          await this.sendNanopayment(msg.from, 1000, "payment-confirmed");
        } else if (msg.payload.action === "getForecast") {
          const forecast = this.get7DayForecast();
          await this.sendNanopayment(msg.from, 1000, "forecast-data");
          await this.broadcastMessage("response", { action: "paymentForecast", forecast });
        }
        break;
      case "alert":
        logger.warn({ agent: this.config.name, payload: msg.payload }, "Alert received");
        break;
    }
  }
}