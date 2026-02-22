# Story SKB-15.3: Agent Authentication & Rate Limiting

**Epic:** Epic 15 - Agent API & MCP Server
**Story ID:** SKB-15.3
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** EPIC-19 (Supabase Auth Migration), SKB-15.1 (REST Agent API)

---

## User Story

As a system administrator, I want API key management and rate limiting for the Agent API, So that I can control access, prevent abuse, and audit all agent actions across the Symbio ecosystem.

---

## Acceptance Criteria

- [ ] **API Key Management UI:**
  - Settings page at `/settings/api-keys`
  - Generate new API key with name and scope (read-only or read-write)
  - Display key once (never stored plaintext)
  - List all keys with: name, prefix (first 8 chars), scopes, created_at, last_used_at
  - Revoke key action (soft delete via `revoked_at` timestamp)
- [ ] **API Key Storage:**
  - `api_keys` table with: `id`, `user_id`, `tenant_id`, `key_hash` (bcrypt), `key_prefix`, `name`, `scopes[]`, `created_at`, `last_used_at`, `revoked_at`
  - Key format: `skb_live_` + 32 random characters (e.g., `skb_live_a1b2c3d4e5f6...`)
  - Hash stored with bcrypt (cost factor 10)
- [ ] **Supabase JWT Validation:**
  - Middleware validates JWT signature using Supabase public key
  - Extract `user_id` and `tenant_id` (or custom claims) from JWT
  - Reject if JWT expired or invalid
- [ ] **Rate Limiting:**
  - Redis-backed sliding window rate limiter
  - 100 requests per minute per API key or user_id
  - Return `429 Too Many Requests` with `Retry-After` header
  - Response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- [ ] **Scoped Permissions:**
  - Read-only keys: Only allow GET requests
  - Read-write keys: Allow GET, POST, PUT, DELETE
  - Return 403 if scope violation
- [ ] **Audit Logging:**
  - `audit_logs` table: `id`, `tenant_id`, `user_id`, `api_key_id`, `action`, `resource`, `resource_id`, `details` (JSON), `created_at`
  - Log all mutations: CREATE_PAGE, UPDATE_PAGE, DELETE_PAGE
  - Sanitize request body (redact sensitive fields like passwords)
  - Retention: 90 days (auto-delete old logs)
- [ ] **Auth Middleware:**
  - Replace placeholder `withAgentAuth` from SKB-15.1 with real implementation
  - Support both Bearer token types: JWT and API key
  - Extract tenant_id and user_id for all requests
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Authentication & Rate Limiting Architecture
──────────────────────────────────────────────

Request Flow:
┌─────────────────────────────────────────────────────────────────────┐
│  1. Agent Request                                                    │
│     POST /api/agent/pages                                            │
│     Authorization: Bearer skb_live_a1b2c3d4...                       │
│     { title: "New Page", markdown: "..." }                           │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  2. Auth Middleware (withAgentAuth)                                  │
│                                                                       │
│     Extract token type:                                              │
│       if (token.startsWith('skb_'))     → API Key                    │
│       else                               → Supabase JWT              │
│                                                                       │
│     API Key Flow:                                                    │
│       1. Hash token with bcrypt                                      │
│       2. Query api_keys table for matching hash                      │
│       3. Check revoked_at is null                                    │
│       4. Update last_used_at                                         │
│       5. Extract tenant_id, user_id, scopes                          │
│                                                                       │
│     Supabase JWT Flow:                                               │
│       1. Verify JWT signature with Supabase public key               │
│       2. Check expiration (exp claim)                                │
│       3. Extract user_id from sub claim                              │
│       4. Extract tenant_id from custom claim or lookup in DB         │
│       5. Scopes: full read-write access                              │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  3. Rate Limiter Check                                               │
│                                                                       │
│     Key: rate_limit:{api_key_id or user_id}                          │
│     Algorithm: Sliding Window (Redis)                                │
│                                                                       │
│     redis.multi()                                                    │
│       .incr(key)                                                     │
│       .expire(key, 60)  // 60 seconds                                │
│       .exec()                                                        │
│                                                                       │
│     if (count > 100) {                                               │
│       return 429 Too Many Requests                                   │
│       Headers: {                                                     │
│         'X-RateLimit-Limit': 100,                                    │
│         'X-RateLimit-Remaining': 0,                                  │
│         'X-RateLimit-Reset': timestamp,                              │
│         'Retry-After': seconds_until_reset                           │
│       }                                                              │
│     }                                                                │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  4. Scope Check                                                      │
│                                                                       │
│     if (scopes.includes('read') && method === 'GET') {               │
│       // Allow                                                       │
│     } else if (scopes.includes('write') && ['POST','PUT'].includes(method)) {
│       // Allow                                                       │
│     } else {                                                         │
│       return 403 Forbidden                                           │
│     }                                                                │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  5. Execute API Handler                                              │
│     (from SKB-15.1)                                                  │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  6. Audit Log (if mutation)                                          │
│                                                                       │
│     if (['POST', 'PUT', 'DELETE'].includes(method)) {                │
│       await prisma.auditLog.create({                                 │
│         data: {                                                      │
│           tenantId,                                                  │
│           userId,                                                    │
│           apiKeyId,                                                  │
│           action: 'CREATE_PAGE',                                     │
│           resource: 'pages',                                         │
│           resourceId: page.id,                                       │
│           details: sanitizeRequestBody(body)                         │
│         }                                                            │
│       });                                                            │
│     }                                                                │
└─────────────────────────────────────────────────────────────────────┘

API Key Management UI:
┌─────────────────────────────────────────────────────────────────────┐
│  /settings/api-keys                                                  │
│                                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Your API Keys                              [+ Generate New Key]│ │
│  │                                                                 │ │
│  │  ┌────────────────────────────────────────────────────────────┐│ │
│  │  │  Production Agent (skb_live_a1b2c3d4...)                   ││ │
│  │  │  Scopes: read, write                                       ││ │
│  │  │  Created: 2026-02-22  Last used: 2 hours ago               ││ │
│  │  │                                      [Revoke]               ││ │
│  │  └────────────────────────────────────────────────────────────┘│ │
│  │                                                                 │ │
│  │  ┌────────────────────────────────────────────────────────────┐│ │
│  │  │  Read-Only Key (skb_live_x9y8z7w6...)                      ││ │
│  │  │  Scopes: read                                              ││ │
│  │  │  Created: 2026-02-15  Last used: never                     ││ │
│  │  │                                      [Revoke]               ││ │
│  │  └────────────────────────────────────────────────────────────┘│ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Generate New Key Modal:                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Key name: [Production Agent            ]                      │ │
│  │  Scopes:   [x] Read   [x] Write                                │ │
│  │                                                                 │ │
│  │                              [Cancel]  [Generate]               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Key Created Success:                                                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Your API key (save this — you won't see it again!):           │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │ skb_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8         📋│ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  │                                                                 │ │
│  │                                             [Done]              │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Update Prisma Schema

**File: `prisma/schema.prisma`** (modifications)

```prisma
// Update existing ApiKey model
model ApiKey {
  id         String    @id @default(uuid())
  userId     String    @map("user_id")
  tenantId   String    @map("tenant_id")
  keyHash    String    @map("key_hash")
  keyPrefix  String    @map("key_prefix")  // First 8 chars for display
  name       String
  scopes     String[]  @default(["read"])  // "read" or "read,write"
  createdAt  DateTime  @default(now()) @map("created_at")
  lastUsedAt DateTime? @map("last_used_at")
  revokedAt  DateTime? @map("revoked_at")

  // Relations
  tenant    Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  auditLogs AuditLog[]

  // Indexes
  @@index([tenantId, id], map: "idx_api_keys_tenant_id_id")
  @@index([tenantId], map: "idx_api_keys_tenant_id")
  @@index([keyHash], map: "idx_api_keys_key_hash")
  @@map("api_keys")
}

// New AuditLog model
model AuditLog {
  id         String   @id @default(uuid())
  tenantId   String   @map("tenant_id")
  userId     String?  @map("user_id")
  apiKeyId   String?  @map("api_key_id")
  action     String   // CREATE_PAGE, UPDATE_PAGE, DELETE_PAGE, etc.
  resource   String   // pages, blocks, databases
  resourceId String?  @map("resource_id")
  details    Json?    // Sanitized request body
  createdAt  DateTime @default(now()) @map("created_at")

  // Relations
  tenant Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User?   @relation(fields: [userId], references: [id], onDelete: SetNull)
  apiKey ApiKey? @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)

  // Indexes
  @@index([tenantId, createdAt], map: "idx_audit_logs_tenant_created")
  @@index([userId], map: "idx_audit_logs_user")
  @@index([apiKeyId], map: "idx_audit_logs_api_key")
  @@map("audit_logs")
}
```

**Migration:**

```bash
npx prisma migrate dev --name add_agent_auth
```

---

### Step 2: Implement Auth Middleware (Real Version)

**File: `src/lib/agent/auth.ts`** (replace placeholder from SKB-15.1)

```typescript
import { NextRequest } from 'next/server';
import { errorResponse } from '@/lib/apiResponse';
import { prisma } from '@/lib/db';
import { verifySupabaseJWT } from './jwt';
import { checkRateLimit } from './ratelimit';
import bcrypt from 'bcryptjs';

export interface AgentContext {
  tenantId: string;
  userId: string;
  apiKeyId?: string;
  scopes: string[];
}

export function withAgentAuth<T>(
  handler: (req: NextRequest, ctx: AgentContext, params?: any) => Promise<T>
) {
  return async (req: NextRequest, params?: any): Promise<T> => {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(
        'UNAUTHORIZED',
        'Missing or invalid Authorization header',
        undefined,
        401
      ) as T;
    }

    const token = authHeader.substring(7);
    let ctx: AgentContext;

    try {
      // Determine token type
      if (token.startsWith('skb_')) {
        // API Key authentication
        ctx = await authenticateApiKey(token);
      } else {
        // Supabase JWT authentication
        ctx = await authenticateJWT(token);
      }

      // Check rate limit
      const rateLimitKey = ctx.apiKeyId || ctx.userId;
      const { allowed, remaining, resetAt } = await checkRateLimit(rateLimitKey);

      if (!allowed) {
        return errorResponse(
          'RATE_LIMIT_EXCEEDED',
          'Too many requests',
          { retry_after: Math.ceil((resetAt - Date.now()) / 1000) },
          429,
          {
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.floor(resetAt / 1000).toString(),
            'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
          }
        ) as T;
      }

      // Check scope for method
      const method = req.method;
      if (method === 'GET' && !ctx.scopes.includes('read')) {
        return errorResponse('FORBIDDEN', 'Insufficient permissions (read scope required)', undefined, 403) as T;
      }
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && !ctx.scopes.includes('write')) {
        return errorResponse('FORBIDDEN', 'Insufficient permissions (write scope required)', undefined, 403) as T;
      }

      // Execute handler
      const response = await handler(req, ctx, params);

      // Add rate limit headers to response
      if (response instanceof Response) {
        response.headers.set('X-RateLimit-Limit', '100');
        response.headers.set('X-RateLimit-Remaining', remaining.toString());
        response.headers.set('X-RateLimit-Reset', Math.floor(resetAt / 1000).toString());
      }

      return response;
    } catch (error: any) {
      console.error('Agent auth error:', error);
      return errorResponse('UNAUTHORIZED', error.message, undefined, 401) as T;
    }
  };
}

async function authenticateApiKey(token: string): Promise<AgentContext> {
  // Hash the token
  const keyHash = await bcrypt.hash(token, 10);

  // Find matching API key
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
    },
    include: {
      user: true,
    },
  });

  if (!apiKey) {
    throw new Error('Invalid API key');
  }

  // Update last_used_at
  await prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    tenantId: apiKey.tenantId,
    userId: apiKey.userId,
    apiKeyId: apiKey.id,
    scopes: apiKey.scopes,
  };
}

async function authenticateJWT(token: string): Promise<AgentContext> {
  // Verify Supabase JWT
  const payload = await verifySupabaseJWT(token);

  if (!payload || !payload.sub) {
    throw new Error('Invalid JWT');
  }

  // Extract user_id from sub claim
  const userId = payload.sub;

  // Get user and tenant_id
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    tenantId: user.tenantId,
    userId,
    scopes: ['read', 'write'], // JWT has full access
  };
}
```

---

### Step 3: Implement JWT Validation

**File: `src/lib/agent/jwt.ts`**

```typescript
import jwt from 'jsonwebtoken';

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

export async function verifySupabaseJWT(token: string): Promise<any> {
  if (!SUPABASE_JWT_SECRET) {
    throw new Error('SUPABASE_JWT_SECRET not configured');
  }

  try {
    const payload = jwt.verify(token, SUPABASE_JWT_SECRET, {
      algorithms: ['HS256'],
    });
    return payload;
  } catch (error: any) {
    throw new Error(`JWT verification failed: ${error.message}`);
  }
}
```

---

### Step 4: Implement Rate Limiter

**File: `src/lib/agent/ratelimit.ts`**

```typescript
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

const RATE_LIMIT = 100; // requests per minute
const WINDOW_MS = 60 * 1000; // 1 minute

export async function checkRateLimit(
  key: string
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const rateLimitKey = `rate_limit:${key}`;
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  // Sliding window using sorted set
  const multi = redis.multi();
  multi.zremrangebyscore(rateLimitKey, 0, windowStart); // Remove old entries
  multi.zadd(rateLimitKey, now, `${now}`); // Add current request
  multi.zcard(rateLimitKey); // Count requests in window
  multi.expire(rateLimitKey, 60); // TTL 60 seconds

  const results = await multi.exec();
  const count = results?.[2]?.[1] as number || 0;

  const allowed = count <= RATE_LIMIT;
  const remaining = Math.max(0, RATE_LIMIT - count);
  const resetAt = now + WINDOW_MS;

  return { allowed, remaining, resetAt };
}
```

---

### Step 5: Implement Audit Logging

**File: `src/lib/agent/audit.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { AgentContext } from './auth';

export async function logAgentAction(
  ctx: AgentContext,
  action: string,
  resource: string,
  resourceId?: string,
  details?: any
) {
  await prisma.auditLog.create({
    data: {
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      apiKeyId: ctx.apiKeyId,
      action,
      resource,
      resourceId,
      details: sanitizeDetails(details),
    },
  });
}

function sanitizeDetails(details: any): any {
  if (!details) return null;

  // Redact sensitive fields
  const sanitized = { ...details };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'api_key'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}
```

**Update Agent API endpoints to log mutations:**

```typescript
// Example: POST /api/agent/pages
import { logAgentAction } from '@/lib/agent/audit';

export const POST = withAgentAuth(async (req, ctx) => {
  // ... create page logic ...

  // Log action
  await logAgentAction(ctx, 'CREATE_PAGE', 'pages', page.id, { title, parent_id });

  return successResponse(page, undefined, 201);
});
```

---

### Step 6: Build API Key Management UI

**File: `src/app/settings/api-keys/page.tsx`**

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function ApiKeysPage() {
  const [keys, setKeys] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  async function generateKey(name: string, scopes: string[]) {
    const response = await fetch('/api/settings/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scopes }),
    });
    const data = await response.json();
    setNewKey(data.data.key);
    setShowModal(false);
    // Refresh keys list
  }

  async function revokeKey(id: string) {
    await fetch(`/api/settings/api-keys/${id}`, { method: 'DELETE' });
    // Refresh keys list
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">API Keys</h1>
        <Button onClick={() => setShowModal(true)}>Generate New Key</Button>
      </div>

      <div className="space-y-4">
        {keys.map((key: any) => (
          <div key={key.id} className="border p-4 rounded">
            <div className="flex justify-between">
              <div>
                <h3 className="font-semibold">{key.name}</h3>
                <p className="text-sm text-gray-600">{key.keyPrefix}...</p>
                <p className="text-sm">Scopes: {key.scopes.join(', ')}</p>
                <p className="text-sm">Last used: {key.lastUsedAt || 'never'}</p>
              </div>
              <Button variant="destructive" onClick={() => revokeKey(key.id)}>
                Revoke
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for generating new key */}
      {showModal && <GenerateKeyModal onGenerate={generateKey} onClose={() => setShowModal(false)} />}

      {/* Success modal showing new key */}
      {newKey && <KeyCreatedModal apiKey={newKey} onClose={() => setNewKey(null)} />}
    </div>
  );
}
```

**File: `src/app/api/settings/api-keys/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { withTenant } from '@/lib/auth/withTenant';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

export const POST = withTenant(async (req, ctx) => {
  const { name, scopes } = await req.json();

  // Generate API key
  const key = `skb_live_${randomBytes(16).toString('hex')}`;
  const keyHash = await bcrypt.hash(key, 10);
  const keyPrefix = key.substring(0, 15); // "skb_live_a1b2c3"

  // Store in database
  const apiKey = await prisma.apiKey.create({
    data: {
      userId: ctx.userId,
      tenantId: ctx.tenantId,
      keyHash,
      keyPrefix,
      name,
      scopes,
    },
  });

  // Return key ONCE (never store plaintext)
  return successResponse(
    { id: apiKey.id, key, keyPrefix, name, scopes },
    undefined,
    201
  );
});

export const GET = withTenant(async (req, ctx) => {
  const keys = await prisma.apiKey.findMany({
    where: { tenantId: ctx.tenantId, revokedAt: null },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });

  return successResponse(keys);
});
```

---

## Testing Requirements

### Unit Tests

```typescript
import { checkRateLimit } from '@/lib/agent/ratelimit';

describe('Rate Limiter', () => {
  it('should allow requests under limit', async () => {
    for (let i = 0; i < 50; i++) {
      const { allowed } = await checkRateLimit('test-key');
      expect(allowed).toBe(true);
    }
  });

  it('should block after 100 requests', async () => {
    for (let i = 0; i < 100; i++) {
      await checkRateLimit('test-key-2');
    }
    const { allowed } = await checkRateLimit('test-key-2');
    expect(allowed).toBe(false);
  });
});
```

---

### Integration Tests

```bash
# Generate API key
curl -X POST http://localhost:3000/api/settings/api-keys \
  -H "Cookie: next-auth.session-token=..." \
  -d '{"name":"Test Key","scopes":["read","write"]}'

# Expected: 201 with { key: "skb_live_...", ... }

# Use API key
curl http://localhost:3000/api/agent/pages \
  -H "Authorization: Bearer skb_live_..."

# Expected: 200 with pages list

# Hit rate limit (100+ requests)
for i in {1..101}; do
  curl http://localhost:3000/api/agent/pages \
    -H "Authorization: Bearer skb_live_..."
done

# Expected: Last request returns 429 with Retry-After header
```

---

### E2E Tests

1. Generate API key via UI
2. Copy key
3. Make 50 API requests → all succeed
4. Make 51st request after 1 minute → succeeds (window reset)
5. Revoke key via UI
6. Make request with revoked key → 401 Unauthorized

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `prisma/schema.prisma` |
| MODIFY | `src/lib/agent/auth.ts` (replace placeholder) |
| CREATE | `src/lib/agent/jwt.ts` |
| CREATE | `src/lib/agent/ratelimit.ts` |
| CREATE | `src/lib/agent/audit.ts` |
| CREATE | `src/app/settings/api-keys/page.tsx` |
| CREATE | `src/app/api/settings/api-keys/route.ts` |
| CREATE | `src/app/api/settings/api-keys/[id]/route.ts` |
| CREATE | `src/__tests__/lib/agent/ratelimit.test.ts` |
| MODIFY | `.env.example` (add REDIS_URL, SUPABASE_JWT_SECRET) |
| MODIFY | `docker-compose.yml` (add Redis service) |

---

## Dev Notes

### Security Best Practices
- API keys never stored in plaintext
- bcrypt cost factor 10 for hashing
- Audit logs retain 90 days then auto-delete
- Rate limit enforced before any DB queries

### Redis Setup
Add to `docker-compose.yml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

### Future Enhancements
- Per-key rate limits (override default 100/min)
- Audit log viewer UI in settings
- Webhook alerts for rate limit violations
- IP-based rate limiting (in addition to key-based)

---

**Last Updated:** 2026-02-22
