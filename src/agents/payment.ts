import { ethers } from "ethers";
import { BaseAgent, AgentConfig, AgentMessage } from "./base";

interface ScheduledPayment {
  id: string;
  recipient: string;
  amount: number;
  memo: string;
  scheduledTime: number;
  recurring: boolean;
  interval?: number; // ms
  executed: boolean;
}

interface PaymentBatch {
  payments: ScheduledPayment[];
  totalAmount: number;
  scheduledExecution: number;
}

export class PaymentAgent extends BaseAgent {
  private scheduledPayments: ScheduledPayment[] = [];
  private paymentHistory: { id: string; timestamp: number; amount: number }[] = [];
  private lastProcess = 0;
  private processInterval = 60_000; // 1 minute

  async execute(): Promise<void> {
    if (Date.now() - this.lastProcess < this.processInterval) return;

    console.log(`[${this.config.name}] Processing payments...`);
    this.lastProcess = Date.now();

    // 1. Find due payments
    const duePayments = this.scheduledPayments.filter(
      (p) => !p.executed && p.scheduledTime <= Date.now()
    );

    if (duePayments.length === 0) {
      console.log(`[${this.config.name}] No payments due`);
      return;
    }

    // 2. Batch small payments
    const batches = this.batchPayments(duePayments);

    // 3. Request liquidity if needed
    const totalNeeded = batches.reduce((sum, b) => sum + b.totalAmount, 0);
    await this.sendNanopayment(
      "0xLIQUIDITY_AGENT",
      1000,
      `reserve-need-${totalNeeded}`
    );

    // 4. Execute batches
    for (const batch of batches) {
      console.log(
        `[${this.config.name}] Executing batch: ${batch.payments.length} payments, ${batch.totalAmount / 1e6} USDC`
      );
      await this.executeBatch(batch);
    }

    // 5. Report to Coordinator
    await this.broadcastMessage("response", {
      action: "paymentsProcessed",
      count: duePayments.length,
      totalAmount: totalNeeded,
    });
  }

  private batchPayments(payments: ScheduledPayment[]): PaymentBatch[] {
    // Group payments into batches for gas efficiency
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
        // Execute via PaymentRouter contract
        console.log(
          `[${this.config.name}] Paying ${payment.amount / 1e6} USDC to ${payment.recipient}: ${payment.memo}`
        );

        // Use Nanopayment for small amounts, regular transfer for large
        if (payment.amount <= 10_000) {
          await this.sendNanopayment(
            payment.recipient,
            payment.amount,
            payment.memo
          );
        } else {
          // Regular payment via PaymentRouter
          await this.broadcastMessage("request", {
            action: "executePayment",
            to: payment.recipient,
            amount: payment.amount,
            memo: payment.memo,
          });
        }

        payment.executed = true;
        this.paymentHistory.push({
          id: payment.id,
          timestamp: Date.now(),
          amount: payment.amount,
        });

        // Handle recurring payments
        if (payment.recurring && payment.interval) {
          payment.scheduledTime = Date.now() + payment.interval;
          payment.executed = false;
        }
      } catch (err) {
        console.error(`[${this.config.name}] Payment failed:`, err);
      }
    }
  }

  addScheduledPayment(payment: Omit<ScheduledPayment, "executed">) {
    this.scheduledPayments.push({ ...payment, executed: false });
    console.log(`[${this.config.name}] Scheduled payment: ${payment.id}`);
  }

  get7DayForecast(): number {
    const now = Date.now();
    const weekLater = now + 7 * 24 * 60 * 60 * 1000;
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
          await this.broadcastMessage("response", {
            action: "paymentForecast",
            forecast,
          });
        }
        break;
      case "alert":
        console.log(`[${this.config.name}] Alert:`, msg.payload);
        break;
    }
  }
}
