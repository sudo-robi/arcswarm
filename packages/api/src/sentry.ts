import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Express } from 'express';

const SENTRY_DSN = process.env.SENTRY_DSN;

export const setupSentry = (app: Express) => {
  if (!SENTRY_DSN) return;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });
};

export const setupSentryErrorHandler = (app: Express) => {
  if (!SENTRY_DSN) return;
  Sentry.setupExpressErrorHandler(app);
};

export default Sentry;
