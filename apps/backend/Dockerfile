# =============================================================================
# OpenClaw Virtual Office — Backend Dockerfile (multi-stage)
# Build context: repo root
# =============================================================================

# ── Stage 1: production deps ─────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

# Copy only package files for layer caching
COPY apps/backend/package*.json ./apps/backend/
RUN cd apps/backend && npm ci --omit=dev

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY apps/backend/package*.json ./apps/backend/
RUN cd apps/backend && npm ci

# Copy full backend source
COPY apps/backend/ ./apps/backend/

# Generate Prisma client (schema is at apps/backend/prisma/schema.prisma)
RUN cd apps/backend && npx prisma generate

# Build TypeScript via NestJS CLI
# nest build outputs to apps/backend/dist/ (per nest-cli.json outDir=./dist)
RUN cd apps/backend && npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache netcat-openbsd openssl && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy production node_modules
COPY --from=deps /app/apps/backend/node_modules ./apps/backend/node_modules

# Copy built dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist

# Copy Prisma schema and generated client from builder
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
COPY --from=builder /app/apps/backend/node_modules/@prisma ./apps/backend/node_modules/@prisma

# Copy entrypoint
COPY apps/backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

RUN chown -R appuser:appgroup /app

EXPOSE 3000

USER appuser

ENTRYPOINT ["/docker-entrypoint.sh"]
