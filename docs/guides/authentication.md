# Agent API Authentication

This guide covers authentication for the SymbioKnowledgeBase Agent API. All `/api/agent/*` endpoints require a valid bearer token in the `Authorization` header.

---

## Overview

The Agent API supports two authentication methods:

| Method | Token Format | Status |
|--------|-------------|--------|
| **API Key** | `skb_live_<32 hex chars>` | Available now |
| **Supabase JWT** | Standard JWT string | Planned (EPIC-19) |

Both methods deliver the same result: the server resolves a `tenantId`, `userId`, and a set of **scopes** that govern what the caller is allowed to do.

---

## API Keys

API keys are the primary authentication method for agent and automation use cases. Each key is:

- **Tied to a user and tenant** — all operations are performed within that tenant's data boundary.
- **Scoped** — keys can be granted `read`, `write`, or both scopes.
- **Stored securely** — only a bcrypt hash is persisted; the plaintext key is returned once at creation time and never stored.

### Generating a Key

Keys are generated through the web UI (**Settings > API Keys**) or via the settings API.

**Via API:**

```bash
curl -X POST https://kb.example.com/api/settings/api-keys \
  -H "Cookie: next-auth.session-token=<your-session>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ci-pipeline",
    "scopes": ["read", "write"]
  }'
```

**Response (201 Created):**

```json
{
  "data": {
    "id": "key-uuid",
    "key": "skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
    "keyPrefix": "skb_live_a1b2c3",
    "name": "ci-pipeline",
    "scopes": ["read", "write"],
    "created_at": "2026-01-15T10:00:00.000Z"
  }
}
```

> **Critical:** The `key` field is returned **only in this response**. Copy it immediately and store it securely. It cannot be retrieved again.

The `keyPrefix` (first 15 characters) is stored in plaintext for identification and is visible in the settings UI alongside the key name and last-used timestamp.

### Key Format

```
skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4
|______| |__________________________________|
 prefix          32 hex characters
         (16 random bytes)
```

- The `skb_` prefix identifies the token as a SymbioKnowledgeBase API key during authentication.
- The `live_` segment indicates a production key.
- The remaining 32 hex characters are generated from 16 cryptographically random bytes.

### Using a Key

Pass the key as a Bearer token in the `Authorization` header:

```bash
curl https://kb.example.com/api/agent/pages \
  -H "Authorization: Bearer skb_live_a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
```

### How Key Authentication Works

1. The server extracts the bearer token from the `Authorization` header.
2. It identifies the token as an API key by the `skb_` prefix.
3. The first 15 characters (`keyPrefix`) are used to look up candidate keys in the database, narrowing the search before any expensive bcrypt comparison.
4. The full token is compared against each candidate's bcrypt hash.
5. On match, the server resolves the key's `tenantId`, `userId`, and `scopes`.
6. The key's `lastUsedAt` timestamp is updated asynchronously.

### Listing Keys

```bash
curl https://kb.example.com/api/settings/api-keys \
  -H "Cookie: next-auth.session-token=<your-session>"
```

Returns all active (non-revoked) keys for the authenticated user:

```json
{
  "data": [
    {
      "id": "key-uuid",
      "name": "ci-pipeline",
      "key_prefix": "skb_live_a1b2c3",
      "scopes": ["read", "write"],
      "created_at": "2026-01-15T10:00:00.000Z",
      "last_used_at": "2026-01-20T14:30:00.000Z"
    }
  ]
}
```

### Revoking a Key

```bash
curl -X DELETE https://kb.example.com/api/settings/api-keys/<key-id> \
  -H "Cookie: next-auth.session-token=<your-session>"
```

Revocation is immediate. The key's `revokedAt` timestamp is set and it will no longer pass authentication. Revoked keys are excluded from candidate lookups.

### Security Best Practices

- **Never commit keys to version control.** Use environment variables or a secrets manager.
- **Use the minimum required scopes.** A read-only agent should use `["read"]` only.
- **Rotate keys periodically.** Generate a new key, update your agents, then revoke the old one.
- **Monitor `last_used_at`.** Keys that have not been used recently may indicate stale integrations and should be revoked.
- **Use one key per agent or service.** This provides granular audit trails and allows revoking access to a single integration without affecting others.
- **Keep keys out of logs.** Ensure your HTTP client does not log request headers containing the Authorization value.

---

## Supabase JWT Authentication

> **Status:** Planned for EPIC-19 (Supabase Auth Migration). This section describes the intended design.

Once Supabase auth is enabled, users and agents can authenticate with a Supabase-issued JWT. The token is passed as a bearer token in the same `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

The server will:

1. Detect that the token does not start with `skb_`.
2. Validate the JWT signature against the Supabase JWT secret.
3. Extract the `sub` (user ID) and custom claims (tenant ID, scopes) from the token payload.
4. Proceed with the same scope and tenant checks as API key auth.

**Current behavior (pre-EPIC-19):** Non-`skb_` tokens fall through to a default tenant context using the `DEFAULT_TENANT_ID` environment variable. This is intended only for local development and testing.

---

## Scopes

Scopes control what operations a token is authorized to perform. They are checked after authentication on every request.

| Scope | Allows |
|-------|--------|
| `read` | `GET` requests — listing pages, reading content, searching, graph queries |
| `write` | `POST`, `PUT`, `PATCH`, `DELETE` requests — creating and updating pages |

### Scope Enforcement

- A `GET` request requires the `read` scope.
- A `POST`, `PUT`, `PATCH`, or `DELETE` request requires the `write` scope.
- If the token lacks the required scope, the server returns `403 Forbidden`:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions (write scope required)"
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

### Recommended Scope Assignments

| Use Case | Scopes |
|----------|--------|
| Read-only dashboard or reporting agent | `["read"]` |
| CI/CD pipeline that creates documentation | `["read", "write"]` |
| Search indexer or analytics | `["read"]` |
| Full-access automation agent | `["read", "write"]` |

---

## Multi-Tenant Isolation

SymbioKnowledgeBase is a multi-tenant system. Every piece of data (pages, blocks, links, databases) is scoped to a `tenantId`. The Agent API enforces tenant isolation at multiple levels:

### How It Works

1. **Authentication resolves the tenant.** The API key or JWT determines the `tenantId` for the request. There is no way for a caller to specify or override the tenant.

2. **Every database query includes a tenant filter.** All Prisma queries include `WHERE tenantId = ctx.tenantId`, ensuring a user in Tenant A can never read or modify data belonging to Tenant B.

3. **Parent page validation is tenant-scoped.** When creating a page with a `parent_id`, the server verifies the parent exists within the same tenant. Cross-tenant parent references are rejected with a 404.

4. **Search is tenant-scoped.** Full-text search queries filter by `tenantId`, so search results never leak data across tenants.

5. **Graph queries are tenant-scoped.** The knowledge graph (nodes and edges) only includes pages and links within the authenticated tenant.

### Guarantees

- There is no API parameter to select a different tenant.
- Tenant ID is derived exclusively from the authenticated credential.
- Even if a user knows a page UUID from another tenant, the query will return 404 because the tenant filter will not match.

---

## Error Responses

Authentication and authorization failures produce standard error responses:

### 401 Unauthorized

Returned when the `Authorization` header is missing, empty, or the token is invalid.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid Authorization header"
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

Common causes:
- No `Authorization` header in the request.
- Header does not start with `Bearer `.
- API key has been revoked.
- API key does not match any stored hash.
- JWT signature is invalid (once Supabase auth is enabled).

### 403 Forbidden

Returned when the token is valid but lacks the scope required for the operation.

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions (read scope required)"
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

Common causes:
- A `write`-only key making a `GET` request (unlikely but possible if scopes are misconfigured).
- A `read`-only key making a `POST`, `PUT`, or `DELETE` request.

### 429 Too Many Requests

Returned when the rate limit is exceeded. See the [Agent API Guide](./agent-api.md#rate-limiting) for the full rate limiting section.

```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests"
  },
  "meta": {
    "timestamp": "2026-01-15T10:30:00.000Z"
  }
}
```

Headers included:
- `Retry-After: <seconds>` — how long to wait before retrying.
- `X-RateLimit-Limit: 100` — requests allowed per window.
- `X-RateLimit-Remaining: 0` — no requests remaining.
- `X-RateLimit-Reset: <unix-timestamp>` — when the window resets.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| 401 on every request | Missing `Bearer ` prefix | Ensure header is `Authorization: Bearer <key>` |
| 401 with valid key | Key was revoked | Generate a new key in Settings |
| 403 on POST/PUT | Key has `read` scope only | Generate a new key with `["read", "write"]` scopes |
| 404 on a known page | Page belongs to a different tenant | Verify the key is associated with the correct user/tenant |
| 429 responses | Rate limit exceeded | Implement `Retry-After` handling or reduce request frequency |
