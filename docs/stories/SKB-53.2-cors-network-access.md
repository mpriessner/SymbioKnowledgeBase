# Story SKB-53.2: CORS & Network Access Support for Direct iOS Connections

**Epic:** Epic 53 — Direct Knowledge Base Access for SciSymbioLens
**Story ID:** SKB-53.2
**Story Points:** 2 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-53.1

---

## User Story

As the SciSymbioLens iOS app making direct HTTP requests to SKB over Tailscale,
I need SKB to accept connections from non-browser and non-localhost origins so that
the voice agent can fetch KB context without being blocked.

---

## Context

The current SKB setup was designed for:
1. Browser clients (same-origin, cookie auth)
2. Server-to-server (gateway → SKB, localhost or Docker network)

iOS native HTTP requests (URLSession) don't send Origin headers the same way browsers do,
so CORS may not be an issue. However, we need to verify:
- The middleware doesn't block requests lacking a browser-like Origin header
- Security headers (CSP, X-Frame-Options) don't interfere with API responses
- The `Host` header from Tailscale hostname is accepted

---

## Acceptance Criteria

1. **Middleware passthrough for API routes with Bearer auth**
   - [ ] Requests to `/api/agent/*` with valid `Authorization: Bearer` header are never
         redirected to `/login`, regardless of origin or Host header
   - [ ] Verify middleware.ts explicitly skips auth redirect for API routes with Authorization header
   - [ ] No session cookie required for agent API routes

2. **Security headers don't break JSON responses**
   - [ ] API routes return `Content-Type: application/json`, not text/html
   - [ ] CSP header doesn't block API responses (not relevant for JSON but verify)

3. **Tailscale hostname accepted**
   - [ ] Requests with `Host: martins-macbook-pro-1.tail3a744f.ts.net:3000` work
   - [ ] Requests with `Host: 100.105.235.96:3000` (Tailscale IP) work
   - [ ] No hostname allowlist blocking non-localhost hosts

4. **CORS headers for preflight (optional but good practice)**
   - [ ] If iOS ever sends preflight OPTIONS requests, they get 200 with appropriate headers
   - [ ] `Access-Control-Allow-Origin: *` for `/api/agent/*` routes (or specific Tailscale origins)
   - [ ] `Access-Control-Allow-Headers: Authorization, Content-Type`
   - [ ] `Access-Control-Allow-Methods: GET, POST, OPTIONS`

---

## Implementation Notes

### Middleware check (`src/middleware.ts`)

Current logic (line ~30-40) should already handle this:
```typescript
// API route with Authorization header → bypass session check
if (request.nextUrl.pathname.startsWith('/api/') && request.headers.get('Authorization')) {
  return NextResponse.next()
}
```

Verify this works for all `/api/agent/*` paths.

### Next.js config (`next.config.ts`)

May need to add CORS headers for agent API routes:
```typescript
async headers() {
  return [{
    source: '/api/agent/:path*',
    headers: [
      { key: 'Access-Control-Allow-Origin', value: '*' },
      { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
      { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
    ],
  }]
}
```

### What NOT to change
- Browser-facing routes still require Supabase session auth
- Non-agent API routes (`/api/blocks`, `/api/search`, etc.) keep current auth
- No changes to API key validation logic

---

## Verification

```bash
# Test from Mac Mini with explicit headers
TOKEN="skb_live_..."

# Tailscale hostname
curl -v "http://martins-macbook-pro-1.tail3a744f.ts.net:3000/api/agent/search?q=MTT" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with JSON, no redirect

# Tailscale IP
curl -v "http://100.105.235.96:3000/api/agent/search?q=MTT" \
  -H "Authorization: Bearer $TOKEN"
# Expected: 200 with JSON

# OPTIONS preflight
curl -v -X OPTIONS "http://martins-macbook-pro-1.tail3a744f.ts.net:3000/api/agent/kb-query" \
  -H "Origin: http://scisymbiolens.local" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Authorization, Content-Type"
# Expected: 200 with CORS headers (or 204)
```
