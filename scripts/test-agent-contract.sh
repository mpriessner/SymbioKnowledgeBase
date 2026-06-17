#!/usr/bin/env bash
# Agent API Contract Test Script (SKB-53.1)
# Tests all agent API endpoints for direct access compatibility.
#
# Usage:
#   ./scripts/test-agent-contract.sh [base_url] [api_key]
#
# Defaults to localhost:3000 with the dev API key.

set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"
TOKEN="${2:-skb_live_11158466c6053c8585dd0fdd9410567f8d0e9d5edac5ca2d0dcd6804f4a4de54}"

PASS=0
FAIL=0

check() {
  local name="$1" expected_status="$2" actual_status="$3"
  if [ "$actual_status" -eq "$expected_status" ]; then
    echo "  ✓ $name (HTTP $actual_status)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — expected $expected_status, got $actual_status"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Agent API Contract Tests ==="
echo "Base URL: $BASE_URL"
echo ""

# 1. Health (no auth)
echo "--- Health Check ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/health")
check "GET /api/health (no auth)" 200 "$STATUS"

# 2. Search
echo "--- Search ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/agent/search?q=MTT" \
  -H "Authorization: Bearer $TOKEN")
check "GET /api/agent/search?q=MTT" 200 "$STATUS"

# 3. Search — no auth (should fail)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/agent/search?q=MTT")
check "GET /api/agent/search (no auth → 401 or 307)" 307 "$STATUS"

# 4. KB Query
echo "--- KB Query ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_URL/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT viability assay","depth":"medium"}')
check "POST /api/agent/kb-query" 200 "$STATUS"

# 5. KB Query with formatted_context
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_URL/api/agent/kb-query?include_formatted=true&max_context_chars=8000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT viability assay","depth":"medium"}')
check "POST /api/agent/kb-query?include_formatted=true" 200 "$STATUS"

# 6. Experiment Context
echo "--- Experiment Context ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/agent/pages/experiment-context?experimentId=EXP-2025-0015&depth=medium" \
  -H "Authorization: Bearer $TOKEN")
check "GET /api/agent/pages/experiment-context" 200 "$STATUS"

# 7. Bulk Experiment Context
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$BASE_URL/api/agent/pages/experiment-context/bulk" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"experiments":[{"experimentId":"EXP-2025-0015","depth":"medium"}],"maxTotalSize":10000}')
check "POST /api/agent/pages/experiment-context/bulk" 200 "$STATUS"

# 8. Pages list
echo "--- Pages ---"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  "$BASE_URL/api/agent/pages" \
  -H "Authorization: Bearer $TOKEN")
check "GET /api/agent/pages" 200 "$STATUS"

# 9. Rate limit headers
echo "--- Rate Limit Headers ---"
HEADERS=$(curl -s -D - -o /dev/null \
  "$BASE_URL/api/agent/search?q=test" \
  -H "Authorization: Bearer $TOKEN" 2>&1)
if echo "$HEADERS" | grep -q "x-ratelimit-limit"; then
  echo "  ✓ Rate limit headers present"
  PASS=$((PASS + 1))
else
  echo "  ✗ Rate limit headers missing"
  FAIL=$((FAIL + 1))
fi

# 10. Response shape validation (kb-query)
echo "--- Response Shape ---"
RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/agent/kb-query?include_formatted=true" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"sodium hydroxide safety","depth":"medium"}')

HAS_FIELDS=$(echo "$RESPONSE" | python3 -c "
import sys, json
d = json.load(sys.stdin)
checks = [
    d.get('success') == True,
    'answer' in d.get('data', {}),
    'context_blocks' in d.get('data', {}),
    'formatted_context' in d.get('data', {}),
    'query_metadata' in d.get('data', {}),
    isinstance(d['data']['context_blocks'], list),
]
if d['data']['context_blocks']:
    b = d['data']['context_blocks'][0]
    checks.extend([
        'type' in b,
        'content' in b,
        'relevance' in b,
        'source_page' in b,
        'source_path' in b,
        'char_count' in b,
    ])
print('PASS' if all(checks) else 'FAIL')
" 2>/dev/null || echo "FAIL")

if [ "$HAS_FIELDS" = "PASS" ]; then
  echo "  ✓ Response shape valid (success, data.answer, context_blocks with source_path/char_count, formatted_context)"
  PASS=$((PASS + 1))
else
  echo "  ✗ Response shape invalid"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
exit $FAIL
