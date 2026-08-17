// Circle App Kits Client Wrapper
// Mock implementation for hackathon - replace with @circle-fin/app-kits when available

import pino from "pino";

const logger = pino({ transport: { target: "pino-pretty" } });

interface SwapParams {
  fromToken: string
  toToken: string
  amount: string
  walletAddress: string
}

interface SendParams {
  to: string
  amount: string
  token: string
  walletAddress: string
}

interface BalanceParams {
  address: string
}

interface CircleAppKitsConfig {
  apiKey: string
  entitySecret?: string
}

export class CircleAppKits {
  private config: CircleAppKitsConfig

  constructor(config: CircleAppKitsConfig) {
    this.config = config
  }

  async swap(params: SwapParams): Promise<{ transactionHash: string }> {
    if (!this.config.apiKey || this.config.apiKey === 'mock-key') {
      throw new Error('Circle API key not configured');
    }
    logger.info({ fromToken: params.fromToken, toToken: params.toToken, amount: params.amount }, "Circle App Kits Swap");
    await new Promise(r => setTimeout(r, 1000))
    return { transactionHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('') }
  }

  async send(params: SendParams): Promise<{ transactionHash: string }> {
    if (!this.config.apiKey || this.config.apiKey === 'mock-key') {
      throw new Error('Circle API key not configured');
    }
    logger.info({ to: params.to, amount: params.amount, token: params.token }, "Circle App Kits Send");
    await new Promise(r => setTimeout(r, 1000))
    return { transactionHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('') }
  }

  async getUnifiedBalance(params: BalanceParams): Promise<{ balance: string; chains: Record<string, string> }> {
    logger.info("Circle App Kits Get Unified Balance");
    return {
      balance: '100000',
      chains: { ethereum: '50000', base: '30000', arbitrum: '20000' },
    }
  }

  async bridge(params: { fromChain: string; toChain: string; amount: string; walletAddress: string }): Promise<{ transactionHash: string }> {
    if (!this.config.apiKey || this.config.apiKey === 'mock-key') {
      throw new Error('Circle API key not configured');
    }
    logger.info({ fromChain: params.fromChain, toChain: params.toChain, amount: params.amount }, "Circle App Kits Bridge");
    await new Promise(r => setTimeout(r, 2000))
    return { transactionHash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('') }
  }
}

export function createCircleAppKits(): CircleAppKits {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) {
    logger.warn("CIRCLE_API_KEY not set — Circle App Kits will not work");
  }
  return new CircleAppKits({
    apiKey: apiKey || 'mock-key',
    entitySecret: process.env.CIRCLE_ENTITY_SECRET,
  })
}
