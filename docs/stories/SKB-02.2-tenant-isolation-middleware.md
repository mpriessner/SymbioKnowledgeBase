# SKB-02.2: Tenant Isolation Middleware

**Epic:** EPIC-02 — Authentication & Multi-Tenancy
**Story ID:** SKB-02.2
**Story Points:** 3
**Priority:** Critical
**Status:** Draft
**Depends On:** SKB-02.1 (NextAuth.js session must be functional)

---

## User Story

**As a** platform administrator,
**I want** every API request to be scoped to the authenticated user's tenant,
**So that** users can never access another user's data.

---

## Acceptance Criteria

- [ ] `getTenantContext(request)` extracts `tenantId`, `userId`, and `role` from a NextAuth.js JWT session
- [ ] `getTenantContext(request)` extracts `tenantId`, `userId`, and `role` from an API key `Authorization: Bearer <key>` header
- [ ] If the request has both a session cookie and an API key header, the API key takes precedence (AI agent requests may pass through browser contexts)
- [ ] If neither session nor API key is present, `getTenantContext()` throws an error that results in a 401 UNAUTHORIZED response
- [ ] If an API key is revoked (has `revoked_at` set), `getTenantContext()` throws 401
- [ ] The `TenantContext` type is `{ tenantId: string; userId: string; role: string }`
- [ ] `withTenant(handler)` is a wrapper function that automatically calls `getTenantContext()` and passes the result to the handler
- [ ] `withTenant(handler)` returns a 401 UNAUTHORIZED response with the standard error envelope when authentication fails
- [ ] Every API route handler that accesses tenant-scoped data uses `withTenant()` or calls `getTenantContext()` directly
- [ ] The `TenantContext` is passed to all Prisma queries as a `where` clause filter on `tenantId`
- [ ] Standard API error envelope `{ error: { code, message }, meta: { timestamp } }` is used for all auth failures

---

## Architecture Overview

```
Incoming API Request
        │
        │  Has Cookie?          Has Authorization header?
        │  ┌─────────┐          ┌────────────────────────┐
        │  │ Yes      │          │ Yes: Bearer <key>      │
        │  │          │          │                        │
        │  ▼          │          ▼                        │
┌──────────────┐      │   ┌──────────────────┐           │
│ getToken()   │      │   │ resolveApiKey()  │           │
│ (NextAuth    │      │   │                  │           │
│  JWT from    │      │   │ - Extract key    │           │
│  cookie)     │      │   │ - SHA-256 hash   │           │
│              │      │   │ - Lookup in DB   │           │
│ Returns:     │      │   │ - Check revoked  │           │
│ { userId,    │      │   │                  │           │
│   tenantId,  │      │   │ Returns:         │           │
│   role }     │      │   │ { tenantId,      │           │
└──────┬───────┘      │   │   userId, role } │           │
       │              │   └────────┬─────────┘           │
       │              │            │                      │
       │  No ─────────┘   No ─────┘                      │
       │                                                  │
       ▼                                                  │
┌──────────────────────────────────────┐                  │
│  Priority Resolution                 │                  │
│                                      │                  │
│  1. API key (if Authorization        │                  │
│     header present)                  │                  │
│  2. JWT session (if cookie present)  │                  │
│  3. Neither → 401 UNAUTHORIZED       │                  │
│                                      │                  │
│  Result: TenantContext               │                  │
│  { tenantId, userId, role }          │                  │
└──────────────┬───────────────────────┘                  │
               │                                          │
               ▼                                          │
┌──────────────────────────────────────┐                  │
│  withTenant() Wrapper                │                  │
│                                      │                  │
│  export const GET = withTenant(      │                  │
│    async (req, ctx) => {             │                  │
│      // ctx.tenantId is available    │                  │
│      // ctx.userId is available      │                  │
│      // ctx.role is available        │                  │
│      const pages = await prisma      │                  │
│        .page.findMany({              │                  │
│          where: {                    │                  │
│            tenantId: ctx.tenantId    │                  │
│          }                           │                  │
│        });                           │                  │
│      return NextResponse.json({      │                  │
│        data: pages, meta: {...}      │                  │
│      });                             │                  │
│    }                                 │                  │
│  );                                  │                  │
└──────────────────────────────────────┘                  │
```

---

## Implementation Steps

### Step 1: Create the TenantContext type

This type was defined in SKB-02.1 at `src/types/auth.ts` but is re-documented here for clarity:

```typescript
// Already in src/types/auth.ts from SKB-02.1
export interface TenantContext {
  tenantId: string;
  userId: string;
  role: string;
}
```

### Step 2: Create the API key resolution utility

This function will be used by `getTenantContext()` to resolve API keys. The full API key system is built in SKB-02.3, but the resolution function is needed here for the tenant context middleware.

**File: `src/lib/apiAuth.ts`**

```typescript
import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import type { TenantContext } from '@/types/auth';

/**
 * Hash an API key using SHA-256.
 * The raw key is never stored — only this hash is persisted in the database.
 */
export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Resolve an API key from the Authorization header to a TenantContext.
 *
 * Extracts the Bearer token, hashes it with SHA-256, and looks up
 * the hash in the api_keys table. Returns the associated tenant context
 * or null if the key is invalid, revoked, or not found.
 */
export async function resolveApiKey(
  authHeader: string | null
): Promise<TenantContext | null> {
  if (!authHeader) {
    return null;
  }

  // Extract Bearer token
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return null;
  }

  const rawKey = match[1];
  const keyHash = hashApiKey(rawKey);

  // Look up the hashed key in the database
  const apiKey = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      revokedAt: null, // Only accept non-revoked keys
    },
    include: {
      user: {
        select: {
          id: true,
          tenantId: true,
          role: true,
        },
      },
    },
  });

  if (!apiKey || !apiKey.user) {
    return null;
  }

  // Update last used timestamp (fire-and-forget, no await needed)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Non-critical: log but do not block the request
      console.error(`Failed to update lastUsedAt for API key ${apiKey.id}`);
    });

  return {
    tenantId: apiKey.user.tenantId,
    userId: apiKey.user.id,
    role: apiKey.user.role,
  };
}
```

### Step 3: Create the tenant context extraction function

**File: `src/lib/tenantContext.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { resolveApiKey } from '@/lib/apiAuth';
import type { TenantContext } from '@/types/auth';

/**
 * Error class for authentication failures in tenant context resolution.
 */
export class AuthenticationError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;

  constructor(message: string, statusCode = 401, errorCode = 'UNAUTHORIZED') {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

/**
 * Extract tenant context from the request.
 *
 * Resolution priority:
 * 1. API key (Authorization: Bearer <key>) — takes precedence for AI agent requests
 * 2. NextAuth.js JWT session (from HTTP-only cookie)
 * 3. Neither — throws AuthenticationError (401)
 *
 * @param request - The incoming Next.js request
 * @returns TenantContext with tenantId, userId, and role
 * @throws AuthenticationError if no valid authentication is found
 */
export async function getTenantContext(
  request: NextRequest
): Promise<TenantContext> {
  // 1. Try API key first (takes precedence)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    const apiKeyContext = await resolveApiKey(authHeader);
    if (apiKeyContext) {
      return apiKeyContext;
    }

    // If Authorization header is present but invalid, reject immediately
    // (don't fall through to session — the caller explicitly chose API key auth)
    throw new AuthenticationError(
      'Invalid or revoked API key',
      401,
      'UNAUTHORIZED'
    );
  }

  // 2. Try NextAuth.js JWT session
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (token && token.userId && token.tenantId && token.role) {
    return {
      tenantId: token.tenantId as string,
      userId: token.userId as string,
      role: token.role as string,
    };
  }

  // 3. No valid authentication found
  throw new AuthenticationError(
    'Authentication required. Provide a valid session cookie or API key.',
    401,
    'UNAUTHORIZED'
  );
}

/**
 * Create a standardized 401 error response.
 */
function createAuthErrorResponse(error: AuthenticationError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.errorCode,
        message: error.message,
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: error.statusCode }
  );
}

/**
 * Type for an API route handler that receives tenant context.
 */
type TenantHandler = (
  request: NextRequest,
  context: TenantContext
) => Promise<NextResponse>;

/**
 * Type for a Next.js dynamic route handler with params.
 */
type TenantHandlerWithParams = (
  request: NextRequest,
  context: TenantContext,
  params: Record<string, string>
) => Promise<NextResponse>;

/**
 * Wrapper function that injects tenant context into an API route handler.
 *
 * Usage (without route params):
 *
 *   export const GET = withTenant(async (req, ctx) => {
 *     const pages = await prisma.page.findMany({
 *       where: { tenantId: ctx.tenantId },
 *     });
 *     return NextResponse.json({ data: pages, meta: { ... } });
 *   });
 *
 * Usage (with route params, e.g., /api/pages/[id]):
 *
 *   export const GET = withTenant(async (req, ctx, params) => {
 *     const page = await prisma.page.findFirst({
 *       where: { id: params.id, tenantId: ctx.tenantId },
 *     });
 *     return NextResponse.json({ data: page, meta: { ... } });
 *   });
 */
export function withTenant(handler: TenantHandler): (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withTenant(handler: TenantHandlerWithParams): (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withTenant(
  handler: TenantHandler | TenantHandlerWithParams
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      const tenantCtx = await getTenantContext(request);

      if (routeContext?.params) {
        const params = await routeContext.params;
        return await (handler as TenantHandlerWithParams)(
          request,
          tenantCtx,
          params
        );
      }

      return await (handler as TenantHandler)(request, tenantCtx);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return createAuthErrorResponse(error);
      }

      console.error('Unexpected error in withTenant:', error);
      return NextResponse.json(
        {
          error: {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 500 }
      );
    }
  };
}
```

### Step 4: Example usage — sample API route with tenant isolation

**File: Example usage in `src/app/api/pages/route.ts` (illustrative, built in Epic 3)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/tenantContext';

// GET /api/pages — List all pages for the authenticated tenant
export const GET = withTenant(async (req, ctx) => {
  const pages = await prisma.page.findMany({
    where: { tenantId: ctx.tenantId },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({
    data: pages,
    meta: {
      total: pages.length,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/pages — Create a new page for the authenticated tenant
export const POST = withTenant(async (req, ctx) => {
  const body = await req.json();

  const page = await prisma.page.create({
    data: {
      title: body.title || 'Untitled',
      tenantId: ctx.tenantId,
      parentId: body.parentId || null,
      icon: body.icon || null,
      position: 0,
    },
  });

  return NextResponse.json(
    {
      data: page,
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
});
```

**File: Example usage with route params in `src/app/api/pages/[id]/route.ts` (illustrative, built in Epic 3)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/tenantContext';

// GET /api/pages/:id — Get a single page (tenant-scoped)
export const GET = withTenant(async (req, ctx, params) => {
  const page = await prisma.page.findFirst({
    where: {
      id: params.id,
      tenantId: ctx.tenantId, // Tenant isolation enforced
    },
  });

  if (!page) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'Page not found',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: page,
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/auth/tenantContext.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  getTenantContext,
  withTenant,
  AuthenticationError,
} from '@/lib/tenantContext';

// Mock next-auth/jwt
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

// Mock apiAuth
vi.mock('@/lib/apiAuth', () => ({
  resolveApiKey: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
import { resolveApiKey } from '@/lib/apiAuth';

const mockedGetToken = vi.mocked(getToken);
const mockedResolveApiKey = vi.mocked(resolveApiKey);

function createMockRequest(headers: Record<string, string> = {}): NextRequest {
  const headerEntries = Object.entries(headers);
  const headersInit = new Headers();
  headerEntries.forEach(([key, value]) => headersInit.set(key, value));

  return new NextRequest('http://localhost:3000/api/test', {
    headers: headersInit,
  });
}

describe('getTenantContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves tenant context from JWT session', async () => {
    mockedGetToken.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-456',
      role: 'USER',
      sub: 'user-123',
      iat: 0,
      exp: 0,
      jti: '',
    });

    const req = createMockRequest();
    const ctx = await getTenantContext(req);

    expect(ctx).toEqual({
      tenantId: 'tenant-456',
      userId: 'user-123',
      role: 'USER',
    });
  });

  it('resolves tenant context from API key', async () => {
    mockedResolveApiKey.mockResolvedValue({
      tenantId: 'tenant-789',
      userId: 'user-abc',
      role: 'USER',
    });

    const req = createMockRequest({
      authorization: 'Bearer skb_live_abcdef1234567890',
    });
    const ctx = await getTenantContext(req);

    expect(ctx).toEqual({
      tenantId: 'tenant-789',
      userId: 'user-abc',
      role: 'USER',
    });
  });

  it('prioritizes API key over JWT session', async () => {
    mockedGetToken.mockResolvedValue({
      userId: 'session-user',
      tenantId: 'session-tenant',
      role: 'USER',
      sub: 'session-user',
      iat: 0,
      exp: 0,
      jti: '',
    });
    mockedResolveApiKey.mockResolvedValue({
      tenantId: 'apikey-tenant',
      userId: 'apikey-user',
      role: 'USER',
    });

    const req = createMockRequest({
      authorization: 'Bearer skb_live_test',
    });
    const ctx = await getTenantContext(req);

    // API key takes precedence
    expect(ctx.tenantId).toBe('apikey-tenant');
    expect(ctx.userId).toBe('apikey-user');
  });

  it('throws AuthenticationError when no auth is present', async () => {
    mockedGetToken.mockResolvedValue(null);

    const req = createMockRequest();

    await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
    await expect(getTenantContext(req)).rejects.toThrow(
      'Authentication required'
    );
  });

  it('throws AuthenticationError when API key is invalid', async () => {
    mockedResolveApiKey.mockResolvedValue(null);

    const req = createMockRequest({
      authorization: 'Bearer invalid-key',
    });

    await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
    await expect(getTenantContext(req)).rejects.toThrow(
      'Invalid or revoked API key'
    );
  });

  it('throws AuthenticationError when JWT token is missing required fields', async () => {
    mockedGetToken.mockResolvedValue({
      sub: 'user-123',
      iat: 0,
      exp: 0,
      jti: '',
      // Missing userId, tenantId, role
    });

    const req = createMockRequest();

    await expect(getTenantContext(req)).rejects.toThrow(AuthenticationError);
  });
});

describe('withTenant', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes tenant context to handler', async () => {
    mockedGetToken.mockResolvedValue({
      userId: 'user-123',
      tenantId: 'tenant-456',
      role: 'USER',
      sub: 'user-123',
      iat: 0,
      exp: 0,
      jti: '',
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 })
    );

    const wrappedHandler = withTenant(handler);
    const req = createMockRequest();
    await wrappedHandler(req);

    expect(handler).toHaveBeenCalledWith(req, {
      tenantId: 'tenant-456',
      userId: 'user-123',
      role: 'USER',
    });
  });

  it('returns 401 when authentication fails', async () => {
    mockedGetToken.mockResolvedValue(null);

    const handler = vi.fn();
    const wrappedHandler = withTenant(handler);

    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.meta.timestamp).toBeDefined();
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 500 for unexpected errors', async () => {
    mockedGetToken.mockRejectedValue(new Error('Database connection failed'));

    const handler = vi.fn();
    const wrappedHandler = withTenant(handler);

    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
```

### Integration Tests

**File: `tests/api/tenantIsolation.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Tenant Isolation', () => {
  let tenantAId: string;
  let tenantBId: string;
  let userASessionCookie: string;
  let userBSessionCookie: string;

  beforeAll(async () => {
    // Create two separate tenants with users
    const passwordHash = await bcrypt.hash('testpassword123', 10);

    const tenantA = await prisma.tenant.create({
      data: { name: 'Tenant A Test' },
    });
    tenantAId = tenantA.id;

    await prisma.user.create({
      data: {
        name: 'User A',
        email: 'test-isolation-a@example.com',
        passwordHash,
        role: 'USER',
        tenantId: tenantA.id,
      },
    });

    const tenantB = await prisma.tenant.create({
      data: { name: 'Tenant B Test' },
    });
    tenantBId = tenantB.id;

    await prisma.user.create({
      data: {
        name: 'User B',
        email: 'test-isolation-b@example.com',
        passwordHash,
        role: 'USER',
        tenantId: tenantB.id,
      },
    });

    // Login as User A
    const loginA = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-isolation-a@example.com',
          password: 'testpassword123',
        }),
        redirect: 'manual',
      }
    );
    userASessionCookie =
      loginA.headers.get('set-cookie')?.split(';')[0] || '';

    // Login as User B
    const loginB = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-isolation-b@example.com',
          password: 'testpassword123',
        }),
        redirect: 'manual',
      }
    );
    userBSessionCookie =
      loginB.headers.get('set-cookie')?.split(';')[0] || '';
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { email: { startsWith: 'test-isolation-' } },
    });
    await prisma.tenant.deleteMany({
      where: { name: { startsWith: 'Tenant' } },
    });
  });

  it('returns 401 for unauthenticated API requests', async () => {
    const response = await fetch(`${BASE_URL}/api/pages`);
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for invalid API key', async () => {
    const response = await fetch(`${BASE_URL}/api/pages`, {
      headers: {
        Authorization: 'Bearer skb_live_invalidkey1234567890',
      },
    });
    expect(response.status).toBe(401);
  });

  it('user A cannot see user B data (tenant isolation)', async () => {
    // Create a page as User A
    const createResponse = await fetch(`${BASE_URL}/api/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userASessionCookie,
      },
      body: JSON.stringify({ title: 'User A Private Page' }),
    });

    if (createResponse.status === 201) {
      // User B should not see User A's page
      const listResponse = await fetch(`${BASE_URL}/api/pages`, {
        headers: { Cookie: userBSessionCookie },
      });

      const listBody = await listResponse.json();
      const titles = listBody.data?.map(
        (p: { title: string }) => p.title
      ) || [];
      expect(titles).not.toContain('User A Private Page');
    }
  });
});
```

---

## Files to Create/Modify

| Action | File Path | Description |
|--------|-----------|-------------|
| Create | `src/lib/tenantContext.ts` | Tenant context extraction, `getTenantContext()`, `withTenant()` wrapper |
| Create | `src/lib/apiAuth.ts` | API key hashing and resolution (used by tenantContext) |
| Create | `tests/unit/auth/tenantContext.test.ts` | Unit tests for tenant context extraction |
| Create | `tests/api/tenantIsolation.test.ts` | Integration tests for multi-tenant isolation |

---

**Last Updated:** 2026-02-21
