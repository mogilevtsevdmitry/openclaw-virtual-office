#!/bin/sh
set -e

echo "[entrypoint] Starting OpenClaw Virtual Office Backend..."
echo "[entrypoint] NODE_ENV=${NODE_ENV}"

# Wait for PostgreSQL
echo "[entrypoint] Waiting for PostgreSQL at ${DB_HOST:-postgres}:${DB_PORT:-5432}..."
until nc -z "${DB_HOST:-postgres}" "${DB_PORT:-5432}"; do
  echo "[entrypoint] PostgreSQL not ready, retrying in 2s..."
  sleep 2
done
echo "[entrypoint] PostgreSQL is ready."

# Start app
echo "[entrypoint] Starting NestJS..."
cd /app/apps/backend && exec node dist/apps/backend/src/main
