import "dotenv/config";
import "./telemetry";
import { setupSentry, setupSentryErrorHandler } from "./sentry.js";

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { WebSocketServer, WebSocket } from "ws";
import { appRouter, prisma, provider } from "./router.js";
import { CONTRACTS, VAULT_ABI, RISK_ORACLE_ABI, RPC_URL } from "./contracts.js";
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
        connectSrc: ["'self'", RPC_URL, "https://*.ingest.sentry.io"],
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
  app.use(cors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? ['http://localhost:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
    credentials: true,
    maxAge: 86400,
  }));
  app.use(express.json({ limit: "1mb" }));

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
    const checks: Record<string, string> = {};
    let overallHealthy = true;

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = 'connected';
    } catch {
      checks.database = 'disconnected';
      overallHealthy = false;
    }

    try {
      const blockNumber = await provider.getBlockNumber();
      checks.blockchain = 'connected';
      checks.blockNumber = String(blockNumber);
    } catch {
      checks.blockchain = 'disconnected';
      overallHealthy = false;
    }

    res.status(overallHealthy ? 200 : 503).json({
      status: overallHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      ...checks,
    });
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
      createContext: ({ req }): { prisma: typeof prisma; walletAddress?: string; isAuthenticated: boolean } => {
        const authHeader = req.headers.authorization;
        let walletAddress: string | undefined;
        if (authHeader?.startsWith("Bearer ")) {
          walletAddress = authHeader.slice(7).trim();
          if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
            walletAddress = undefined;
          }
        }
        return {
          prisma,
          walletAddress,
          isAuthenticated: !!walletAddress,
        };
      },
    })
  );

  setupSentryErrorHandler(app);

  return app;
}

export function attachWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server, maxPayload: 1024 });

  const MAX_CONNECTIONS_PER_IP = 3;
  const connectionCounts = new Map<string, number>();

  wss.on("connection", (ws, req) => {
    const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0] || req.socket.remoteAddress || "unknown";
    const currentCount = connectionCounts.get(ip) || 0;
    if (currentCount >= MAX_CONNECTIONS_PER_IP) {
      logger.warn({ ip }, "WebSocket connection limit reached");
      ws.close(4000, "Too many connections");
      return;
    }
    connectionCounts.set(ip, currentCount + 1);

    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const vaultId = url.searchParams.get("vaultId");
    if (vaultId && !/^[a-zA-Z0-9_-]+$/.test(vaultId)) {
      ws.close(4001, "Invalid vaultId parameter");
      return;
    }
    logger.info({ vaultId, ip }, "WebSocket client connected");

    const interval = setInterval(async () => {
      if (ws.readyState !== WebSocket.OPEN) {
        clearInterval(interval);
        return;
      }

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
        const totalBudget = agents.reduce((sum, a) => sum + (a.budget || 0n), 0n);
        const totalSpent = agents.reduce((sum, a) => sum + (a.spent || 0n), 0n);

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
              activeAgents: agents.filter((a) => a.active).length,
              timestamp: Date.now(),
            },
          })
        );
      } catch (e) {
        logger.error({ err: e }, "WebSocket update failed");
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Failed to fetch update" }));
        }
      }
    }, 10_000);

    ws.on("error", (err) => {
      logger.error({ err, vaultId }, "WebSocket error");
    });

    ws.on("message", (data) => {
      const msg = data.toString();
      if (msg.length > 1024) {
        ws.close(4002, "Message too large");
        return;
      }
      try {
        JSON.parse(msg);
      } catch {
        ws.close(4003, "Invalid JSON");
      }
    });

    ws.on("close", () => {
      clearInterval(interval);
      const count = connectionCounts.get(ip) || 1;
      if (count <= 1) connectionCounts.delete(ip);
      else connectionCounts.set(ip, count - 1);
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

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10_000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { appRouter, prisma, provider, startServer };
