# =============================================================================
# OpenClaw Virtual Office — Backend Dockerfile
# Uses pre-built dist/ from host (nest build already done)
# Build context: repo root
# =============================================================================

FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache netcat-openbsd openssl openssl-dev && \
    addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy monorepo package files
COPY package.json ./
COPY apps/backend/package.json ./apps/backend/

# Install production deps only
RUN npm install --omit=dev --ignore-scripts 2>/dev/null || npm install --omit=dev

# Copy pre-built dist (built on host)
COPY apps/backend/dist ./apps/backend/dist

# Copy Prisma schema + generated client from host
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
COPY apps/backend/node_modules/@prisma ./apps/backend/node_modules/@prisma

# Copy entrypoint
COPY apps/backend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Fix: symlink @nestjs/websockets for IoAdapter resolution
RUN ln -sf /app/apps/backend/node_modules/@nestjs/websockets \
    /app/node_modules/@nestjs/websockets 2>/dev/null || true && \
    ln -sf /app/apps/backend/node_modules/@nestjs/platform-socket.io \
    /app/node_modules/@nestjs/platform-socket.io 2>/dev/null || true

# Fix permissions so appuser can write prisma engines cache
RUN chown -R appuser:appgroup /app

EXPOSE 3000

USER appuser

ENTRYPOINT ["/docker-entrypoint.sh"]
