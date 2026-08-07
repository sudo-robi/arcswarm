# Multi-stage build for ArcSwarm API (pnpm monorepo)
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable pnpm

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api/package.json ./packages/api/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @arcswarm/api --filter @arcswarm/shared

# Generate Prisma client
COPY packages/api/prisma ./packages/api/prisma/
RUN cd packages/api && pnpm db:generate

# Build the application
FROM base AS builder
WORKDIR /app

# Copy installed dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules

# Copy source code
COPY . .

# Build shared package first
RUN cd packages/shared && pnpm build

# Build API package
RUN cd packages/api && pnpm build

# Hardened Distroless Production Runner
FROM gcr.io/distroless/nodejs20-debian12 AS runner
WORKDIR /app

ENV NODE_ENV production

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/api/prisma ./packages/api/prisma

EXPOSE 3001

# Distroless nodejs base image has 'node' as the default entrypoint
CMD ["packages/api/dist/index.js"]