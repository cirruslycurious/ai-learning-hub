#!/usr/bin/env bash
# scripts/smoke-test/quick-jwt-test.sh
#
# Quick AC1 validation: paste a fresh Clerk JWT and immediately test GET /users/me.
# Designed for Clerk JWTs that expire in 60 seconds — no env file overhead.
#
# Usage:
#   ./scripts/smoke-test/quick-jwt-test.sh <JWT>
#   # Or paste when prompted:
#   ./scripts/smoke-test/quick-jwt-test.sh
#
# The script fires the HTTP request immediately — no unnecessary setup.

set -euo pipefail

API_URL="${SMOKE_TEST_API_URL:-https://fgri1dtdre.execute-api.us-east-1.amazonaws.com/dev}"

if [[ $# -ge 1 ]]; then
  JWT="$1"
else
  echo -n "Paste JWT and press Enter: "
  read -r JWT
fi

if [[ -z "$JWT" ]]; then
  echo "❌ No JWT provided"
  exit 1
fi

# Decode JWT to show expiry (for debugging)
EXP=$(echo "$JWT" | cut -d. -f2 | base64 -d 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('exp','?'))" 2>/dev/null || echo "?")
NOW=$(date +%s)
if [[ "$EXP" != "?" ]]; then
  TTL=$((EXP - NOW))
  echo "⏱  JWT expires in ${TTL}s (exp=$EXP, now=$NOW)"
  if [[ $TTL -le 0 ]]; then
    echo "❌ JWT already expired! Get a fresh one and try again immediately."
    exit 1
  fi
fi

echo "🔄 Sending GET /users/me ..."

HTTP_CODE=$(curl -s -o /tmp/smoke-ac1-response.json -w '%{http_code}' \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  "${API_URL}/users/me")

echo "📨 HTTP $HTTP_CODE"

BODY=$(cat /tmp/smoke-ac1-response.json)
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

if [[ "$HTTP_CODE" == "200" ]]; then
  echo ""
  echo "✅ AC1 PASS — Valid JWT → GET /users/me → 200"
else
  echo ""
  echo "❌ AC1 FAIL — Expected 200, got $HTTP_CODE"
  if [[ "$HTTP_CODE" == "401" ]]; then
    echo "   Likely cause: JWT expired before the request reached the Lambda."
    echo "   Clerk JWTs expire in 60 seconds. Paste and run immediately after copying."
  fi
fi
