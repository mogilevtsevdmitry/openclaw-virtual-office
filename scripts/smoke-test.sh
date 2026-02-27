#!/bin/bash
set -e
BASE_URL="http://localhost:3000"
FRONTEND_URL="http://localhost:5173"

echo "=== OpenClaw Virtual Office Smoke Test ==="

# Health
curl -sf "$BASE_URL/health" > /dev/null && echo "✓ Backend health OK" || echo "✗ Backend health FAIL"

# Frontend (только если запущен)
curl -sf "$FRONTEND_URL" > /dev/null && echo "✓ Frontend OK" || echo "⚠ Frontend not running (start with npm run dev:frontend)"

# Auth flow
echo "--- Auth flow ---"
REG=$(curl -sf -X POST "$BASE_URL/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@test.com","password":"Test1234!","tenantId":"tenant-smoke"}' 2>/dev/null || true)
echo "Register: $REG"

TOKEN=$(curl -sf -X POST "$BASE_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"smoke-test@test.com","password":"Test1234!"}' 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('accessToken',''))" 2>/dev/null || true)

if [ -n "$TOKEN" ]; then
  echo "✓ Auth OK (got token)"
else
  echo "✗ Auth FAIL (no token)"
fi

echo "=== Done ==="
