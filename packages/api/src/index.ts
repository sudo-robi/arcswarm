import "dotenv/config";
import "./telemetry";
import { setupSentry, setupSentryErrorHandler } from "./sentry.js";

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { WebSocketServer } from "ws";
import { appRouter, prisma, provider } from "./router.js";
import { CONTRACTS, VAULT_ABI, RISK_ORACLE_ABI } from "./contracts.js";
import pino from "pino";
import { ethers } from "ethers";
import { createServer, type Server } from "http";

const logger = pino({ transport: { target: "pino-pretty" } });

export function createApp(): express.Express {
  const app = express();

  setupSentry(app);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://browser.sentry-cdn.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'", "https://rpc.testnet.arc.network", "https://*.ingest.sentry.io"],
        frameSrc: ["'self'", "https://*.sentry.io"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }));

  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
  app.use(cors());
  app.use(express.json());

  app.use((req, _res, next) => {
    req.headers['x-correlation-id'] = req.headers['x-correlation-id'] || crypto.randomUUID();
    logger.info({
      correlationId: req.headers['x-correlation-id'],
      method: req.method,
      url: req.url,
    }, 'Incoming request');
    next();
  });

  app.get('/api/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      const blockNumber = await provider.getBlockNumber();

      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        blockchain: {
          connected: true,
          blockNumber,
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      res.status(503).json({
        status: 'error',
        error: err.message,
        database: 'disconnected',
        blockchain: {
          connected: false,
        },
      });
    }
  });

  app.get('/metrics', (_req, res) => {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send([
      '# HELP arcswarm_api_requests_total Total API requests',
      '# TYPE arcswarm_api_requests_total counter',
      `arcswarm_api_requests_total{env="${process.env.NODE_ENV || 'development'}"} 1`,
      '# HELP arcswarm_api_up API server status',
      '# TYPE arcswarm_api_up gauge',
      'arcswarm_api_up 1',
      '# HELP arcswarm_api_info ArcSwarm API info',
      '# TYPE arcswarm_api_info gauge',
      `arcswarm_api_info{version="${process.env.npm_package_version || '0.1.0'}"} 1`,
    ].join('\n') + '\n');
  });

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext: () => ({ prisma }),
    })
  );

  setupSentryErrorHandler(app);

  return app;
}

export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const vaultId = url.searchParams.get("vaultId");
    logger.info({ vaultId }, "WebSocket client connected");

    const interval = setInterval(async () => {
      try {
        const vault = new ethers.Contract(CONTRACTS.vault, VAULT_ABI, provider);
        const riskOracle = new ethers.Contract(CONTRACTS.riskOracle, RISK_ORACLE_ABI, provider);

        const [healthy, riskScore] = await riskOracle.checkHealth();
        const [balance, totalDeposits, totalYield] = await Promise.all([
          vault.getVaultBalance(),
          vault.totalDeposits(),
          vault.totalYield(),
        ]);

        const agents = await prisma.agent.findMany({ where: vaultId ? { vaultId } : {} });
        const totalBudget = agents.reduce((sum: bigint, a: { budget: bigint | null }) => sum + (a.budget || 0n), 0n);
        const totalSpent = agents.reduce((sum: bigint, a: { spent: bigint | null }) => sum + (a.spent || 0n), 0n);

        ws.send(
          JSON.stringify({
            type: "VAULT_UPDATE",
            data: {
              balance: balance.toString(),
              totalDeposits: totalDeposits.toString(),
              totalYield: totalYield.toString(),
              riskScore: riskScore.toString(),
              healthy,
              totalBudget: totalBudget.toString(),
              totalSpent: totalSpent.toString(),
              activeAgents: agents.filter((a: { active: boolean }) => a.active).length,
              timestamp: Date.now(),
            },
          })
        );
      } catch (e) {
        logger.error({ err: e }, "WebSocket error");
      }
    }, 10_000);

    ws.on("close", () => {
      clearInterval(interval);
      logger.info({ vaultId }, "WebSocket client disconnected");
    });
  });
}

function startServer() {
  const PORT = process.env.PORT || 3001;
  const app = createApp();
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, "ArcSwarm API running");
  });
  attachWebSocketServer(server);

  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { appRouter, prisma, provider, startServer };
