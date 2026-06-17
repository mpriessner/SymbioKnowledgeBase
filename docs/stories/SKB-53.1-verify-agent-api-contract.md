# Story SKB-53.1: Verify & Document Agent API Contract for Direct Access

**Epic:** Epic 53 — Direct Knowledge Base Access for SciSymbioLens
**Story ID:** SKB-53.1
**Story Points:** 1 | **Priority:** High | **Status:** Draft
**Depends On:** None

---

## User Story

As the SciSymbioLens iOS app connecting directly to SKB (bypassing the Clawdbot Gateway),
I need a verified and documented API contract so that the iOS client can be built against
stable, tested endpoints.

---

## Context

The existing agent API endpoints were designed for server-to-server use (gateway → SKB).
Now that an iOS client will call them directly over Tailscale, we need to verify:
- Auth works with direct Bearer token calls (not proxied)
- Response shapes are stable and documented
- Error responses are consistent and parseable by Swift
- Rate limiting headers are present for client-side handling

---

## Acceptance Criteria

1. **Endpoint audit** — Verify these endpoints work correctly when called directly:
   - [x] `GET /api/agent/search?q={query}` — full-text search
   - [ ] `POST /api/agent/kb-query` — intelligent KB query with context blocks
   - [ ] `GET /api/agent/pages/experiment-context?experimentId={id}&depth={depth}`
   - [ ] `POST /api/agent/pages/experiment-context/bulk` — multi-experiment context

2. **Auth verification** — Confirm Bearer token auth works from non-localhost origins:
   - [ ] Direct curl from remote machine (Mac Mini) succeeds (already tested for search)
   - [ ] Test kb-query from remote machine
   - [ ] Test experiment-context from remote machine
   - [ ] Verify rate limit headers are returned: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

3. **Response shape documentation** — Create a concise contract document:
   - [ ] Success response shape for each endpoint
   - [ ] Error response shape (consistent `{ error: { code, message, details } }`)
   - [ ] HTTP status codes used (200, 400, 401, 404, 429, 500)

4. **Contract test** — Simple test script that validates all endpoints:
   - [ ] Can be run manually: `npm run test:agent-contract` or similar
   - [ ] Tests auth, search, kb-query, experiment-context
   - [ ] Verifies response shapes match documented contract

---

## Implementation Notes

- Most of this is verification, not new code
- The search endpoint already works from Mac Mini (confirmed in debugging session 2026-03-28)
- The kb-query endpoint works locally (also confirmed)
- Key file: `src/middleware.ts` — must allow API routes with Authorization header from any origin
- Key file: `src/lib/agent/auth.ts` — Bearer token validation
- Key file: `src/lib/apiResponse.ts` — response format builders

---

## Verification

```bash
# From remote machine (Mac Mini):
TOKEN="skb_live_..."

# Test 1: Search
curl -s "http://martins-macbook-pro-1.tail3a744f.ts.net:3000/api/agent/search?q=MTT" \
  -H "Authorization: Bearer $TOKEN"

# Test 2: KB Query
curl -s -X POST "http://martins-macbook-pro-1.tail3a744f.ts.net:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT viability assay","depth":"medium"}'

# Test 3: Experiment Context
curl -s "http://martins-macbook-pro-1.tail3a744f.ts.net:3000/api/agent/pages/experiment-context?experimentId=EXP-2025-0015&depth=medium" \
  -H "Authorization: Bearer $TOKEN"
```
