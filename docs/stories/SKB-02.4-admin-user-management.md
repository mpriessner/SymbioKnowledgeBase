# SKB-02.4: Admin User Management

**Epic:** EPIC-02 — Authentication & Multi-Tenancy
**Story ID:** SKB-02.4
**Story Points:** 3
**Priority:** High
**Status:** Draft
**Depends On:** SKB-02.2 (Tenant isolation middleware must be in place)

---

## User Story

**As a** platform administrator,
**I want to** create and manage user accounts,
**So that** I can onboard new researchers to the platform.

---

## Acceptance Criteria

- [ ] Only users with `role = 'ADMIN'` can access `/api/users` endpoints
- [ ] Non-admin users receive 403 FORBIDDEN when calling admin endpoints
- [ ] Admin can list all users via `GET /api/users`
- [ ] Admin can create a new user via `POST /api/users` (with name, email, password, optional role)
- [ ] Each newly created user automatically gets a new tenant
- [ ] Admin can update a user's name and role via `PUT /api/users/[id]`
- [ ] Admin can deactivate a user via `DELETE /api/users/[id]` (soft delete via `deactivatedAt` timestamp)
- [ ] Deactivated users cannot log in (NextAuth authorize function checks deactivation status)
- [ ] Admin cannot deactivate their own account
- [ ] `withAdmin()` wrapper builds on `withTenant()` and adds a role check for `ADMIN`
- [ ] All API responses follow the standard envelope: `{ data, meta }` / `{ error, meta }`
- [ ] Passwords are never returned in any user management API response
- [ ] Input validation via Zod schemas for all create and update operations
- [ ] Email uniqueness is enforced — creating a user with an existing email returns 409

---

## Architecture Overview

```
Admin User (role = ADMIN)
        │
        │  GET /api/users
        │  POST /api/users
        │  PUT /api/users/:id
        │  DELETE /api/users/:id
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  withAdmin() Wrapper                                     │
│                                                          │
│  1. Call withTenant() → resolve TenantContext             │
│     (handles 401 if unauthenticated)                     │
│                                                          │
│  2. Check ctx.role === 'ADMIN'                           │
│     If not → 403 FORBIDDEN                               │
│                                                          │
│  3. Pass request + context to handler                    │
│                                                          │
└──────────────────────┬───────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────┐
│  Admin API Route Handler                                 │
│                                                          │
│  GET /api/users                                          │
│    → prisma.user.findMany()                              │
│    → Return { data: users[], meta: { total, ... } }     │
│                                                          │
│  POST /api/users                                         │
│    → Validate input (Zod)                                │
│    → Check email uniqueness                              │
│    → bcrypt.hash(password, 10)                           │
│    → prisma.$transaction:                                │
│        → create tenant                                   │
│        → create user                                     │
│    → Return { data: user, meta }                         │
│                                                          │
│  PUT /api/users/:id                                      │
│    → Validate input (Zod)                                │
│    → prisma.user.update(...)                             │
│    → Return { data: user, meta }                         │
│                                                          │
│  DELETE /api/users/:id                                   │
│    → Check not self-deactivation                         │
│    → prisma.user.update({ deactivatedAt: new Date() })  │
│    → Return { data: user, meta }                         │
│                                                          │
└──────────────────────────────────────────────────────────┘

Auth Flow with Deactivation Check:
──────────────────────────────────

  Login Attempt
        │
        ▼
  CredentialsProvider.authorize()
        │
        ├─ Find user by email
        │
        ├─ User not found? → Return null (login fails)
        │
        ├─ user.deactivatedAt is set? → Return null (login fails)
        │
        ├─ Password mismatch? → Return null (login fails)
        │
        └─ All checks pass → Return user object (login succeeds)
```

---

## Implementation Steps

### Step 1: Create Zod validation schemas for user management

**File: `src/lib/validation/users.ts`**

```typescript
import { z } from 'zod';

export const createUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim(),
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email must be 255 characters or less')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be 128 characters or less'),
  role: z
    .enum(['USER', 'ADMIN'], {
      errorMap: () => ({ message: 'Role must be USER or ADMIN' }),
    })
    .optional()
    .default('USER'),
});

export const updateUserSchema = z.object({
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be 100 characters or less')
    .trim()
    .optional(),
  role: z
    .enum(['USER', 'ADMIN'], {
      errorMap: () => ({ message: 'Role must be USER or ADMIN' }),
    })
    .optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
```

### Step 2: Create withAdmin() middleware wrapper

**File: `src/lib/withAdmin.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTenantContext, AuthenticationError } from '@/lib/tenantContext';
import type { TenantContext } from '@/types/auth';

/**
 * Type for an admin API route handler that receives tenant context.
 */
type AdminHandler = (
  request: NextRequest,
  context: TenantContext
) => Promise<NextResponse>;

/**
 * Type for an admin API route handler with route params.
 */
type AdminHandlerWithParams = (
  request: NextRequest,
  context: TenantContext,
  params: Record<string, string>
) => Promise<NextResponse>;

/**
 * Wrapper function for admin-only API route handlers.
 *
 * Builds on top of getTenantContext() from the tenant isolation middleware.
 * After resolving the tenant context, it checks that the user's role is ADMIN.
 * If not, it returns a 403 FORBIDDEN response.
 *
 * Usage (without route params):
 *
 *   export const GET = withAdmin(async (req, ctx) => {
 *     const users = await prisma.user.findMany();
 *     return NextResponse.json({ data: users, meta: { ... } });
 *   });
 *
 * Usage (with route params):
 *
 *   export const PUT = withAdmin(async (req, ctx, params) => {
 *     const user = await prisma.user.update({
 *       where: { id: params.id },
 *       data: { ... },
 *     });
 *     return NextResponse.json({ data: user, meta: { ... } });
 *   });
 */
export function withAdmin(handler: AdminHandler): (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withAdmin(handler: AdminHandlerWithParams): (
  request: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

export function withAdmin(
  handler: AdminHandler | AdminHandlerWithParams
) {
  return async (
    request: NextRequest,
    routeContext?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    try {
      // Step 1: Resolve tenant context (handles 401 for unauthenticated)
      const tenantCtx = await getTenantContext(request);

      // Step 2: Check admin role
      if (tenantCtx.role !== 'ADMIN') {
        return NextResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Admin access required. Your role does not permit this action.',
            },
            meta: { timestamp: new Date().toISOString() },
          },
          { status: 403 }
        );
      }

      // Step 3: Call the handler with tenant context
      if (routeContext?.params) {
        const params = await routeContext.params;
        return await (handler as AdminHandlerWithParams)(
          request,
          tenantCtx,
          params
        );
      }

      return await (handler as AdminHandler)(request, tenantCtx);
    } catch (error) {
      if (error instanceof AuthenticationError) {
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

      console.error('Unexpected error in withAdmin:', error);
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

### Step 3: Create user list and create endpoints

**File: `src/app/api/users/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { withAdmin } from '@/lib/withAdmin';
import { createUserSchema } from '@/lib/validation/users';

// GET /api/users — List all users (admin only)
export const GET = withAdmin(async (req: NextRequest, ctx) => {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
        deactivatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.user.count(),
  ]);

  const formattedUsers = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    createdAt: user.createdAt.toISOString(),
    isDeactivated: user.deactivatedAt !== null,
    deactivatedAt: user.deactivatedAt?.toISOString() || null,
  }));

  return NextResponse.json({
    data: formattedUsers,
    meta: {
      total,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    },
  });
});

// POST /api/users — Create a new user with a new tenant (admin only)
export const POST = withAdmin(async (req: NextRequest, ctx) => {
  const body = await req.json();

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user data',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 400 }
    );
  }

  const { name, email, password, role } = parsed.data;

  // Check for existing user with this email
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return NextResponse.json(
      {
        error: {
          code: 'CONFLICT',
          message: 'A user with this email already exists',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 409 }
    );
  }

  // Hash password with bcrypt cost factor 10
  const passwordHash = await bcrypt.hash(password, 10);

  // Create tenant and user in a transaction
  const result = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: `${name}'s Workspace`,
      },
    });

    const user = await tx.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        tenantId: tenant.id,
      },
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: tenant.id,
      createdAt: user.createdAt.toISOString(),
      isDeactivated: false,
      deactivatedAt: null,
    };
  });

  return NextResponse.json(
    {
      data: result,
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
});
```

### Step 4: Create user update and deactivate endpoints

**File: `src/app/api/users/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAdmin } from '@/lib/withAdmin';
import { updateUserSchema } from '@/lib/validation/users';

// GET /api/users/:id — Get a single user (admin only)
export const GET = withAdmin(async (req: NextRequest, ctx, params) => {
  const { id } = params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
      createdAt: true,
      deactivatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      createdAt: user.createdAt.toISOString(),
      isDeactivated: user.deactivatedAt !== null,
      deactivatedAt: user.deactivatedAt?.toISOString() || null,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

// PUT /api/users/:id — Update user name and/or role (admin only)
export const PUT = withAdmin(async (req: NextRequest, ctx, params) => {
  const { id } = params;

  const body = await req.json();
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid user data',
          details: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 400 }
    );
  }

  // Check that the user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 404 }
    );
  }

  // Build update data from parsed input (only include provided fields)
  const updateData: Record<string, string> = {};
  if (parsed.data.name !== undefined) {
    updateData.name = parsed.data.name;
  }
  if (parsed.data.role !== undefined) {
    updateData.role = parsed.data.role;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No fields to update. Provide at least one of: name, role.',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 400 }
    );
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
      createdAt: true,
      deactivatedAt: true,
    },
  });

  return NextResponse.json({
    data: {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      tenantId: updatedUser.tenantId,
      createdAt: updatedUser.createdAt.toISOString(),
      isDeactivated: updatedUser.deactivatedAt !== null,
      deactivatedAt: updatedUser.deactivatedAt?.toISOString() || null,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

// DELETE /api/users/:id — Deactivate a user (admin only, soft delete)
export const DELETE = withAdmin(async (req: NextRequest, ctx, params) => {
  const { id } = params;

  // Prevent admin from deactivating themselves
  if (id === ctx.userId) {
    return NextResponse.json(
      {
        error: {
          code: 'FORBIDDEN',
          message: 'You cannot deactivate your own account',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 403 }
    );
  }

  // Check that the user exists
  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    return NextResponse.json(
      {
        error: {
          code: 'NOT_FOUND',
          message: 'User not found',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 404 }
    );
  }

  if (existingUser.deactivatedAt) {
    return NextResponse.json(
      {
        error: {
          code: 'CONFLICT',
          message: 'User is already deactivated',
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 409 }
    );
  }

  // Soft-delete by setting deactivatedAt
  const deactivatedUser = await prisma.user.update({
    where: { id },
    data: { deactivatedAt: new Date() },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      tenantId: true,
      createdAt: true,
      deactivatedAt: true,
    },
  });

  return NextResponse.json({
    data: {
      id: deactivatedUser.id,
      name: deactivatedUser.name,
      email: deactivatedUser.email,
      role: deactivatedUser.role,
      tenantId: deactivatedUser.tenantId,
      createdAt: deactivatedUser.createdAt.toISOString(),
      isDeactivated: true,
      deactivatedAt: deactivatedUser.deactivatedAt!.toISOString(),
    },
    meta: { timestamp: new Date().toISOString() },
  });
});
```

### Step 5: Update NextAuth.js authorize to check deactivation

**File: `src/lib/auth.ts` (modify the authorize function from SKB-02.1)**

The `authorize` function in `src/lib/auth.ts` must be updated to check for deactivated users:

```typescript
// Inside CredentialsProvider authorize function:
async authorize(credentials) {
  const parsed = loginSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }

  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    return null;
  }

  // Check if user is deactivated
  if (user.deactivatedAt) {
    return null;
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    role: user.role,
  };
},
```

---

## Testing Requirements

### Unit Tests

**File: `tests/unit/auth/withAdmin.test.ts`**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock tenantContext module
vi.mock('@/lib/tenantContext', () => ({
  getTenantContext: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {
    statusCode: number;
    errorCode: string;
    constructor(message: string, statusCode = 401, errorCode = 'UNAUTHORIZED') {
      super(message);
      this.statusCode = statusCode;
      this.errorCode = errorCode;
    }
  },
}));

import { getTenantContext, AuthenticationError } from '@/lib/tenantContext';
import { withAdmin } from '@/lib/withAdmin';

const mockedGetTenantContext = vi.mocked(getTenantContext);

function createMockRequest(): NextRequest {
  return new NextRequest('http://localhost:3000/api/users');
}

describe('withAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows ADMIN role to proceed', async () => {
    mockedGetTenantContext.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: 'ADMIN',
    });

    const handler = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 })
    );

    const wrappedHandler = withAdmin(handler);
    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(200);
    expect(handler).toHaveBeenCalledWith(req, {
      tenantId: 'tenant-1',
      userId: 'admin-1',
      role: 'ADMIN',
    });
  });

  it('rejects USER role with 403', async () => {
    mockedGetTenantContext.mockResolvedValue({
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: 'USER',
    });

    const handler = vi.fn();
    const wrappedHandler = withAdmin(handler);

    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when not authenticated', async () => {
    mockedGetTenantContext.mockRejectedValue(
      new AuthenticationError('Authentication required')
    );

    const handler = vi.fn();
    const wrappedHandler = withAdmin(handler);

    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 500 for unexpected errors', async () => {
    mockedGetTenantContext.mockRejectedValue(
      new Error('Database connection failed')
    );

    const handler = vi.fn();
    const wrappedHandler = withAdmin(handler);

    const req = createMockRequest();
    const response = await wrappedHandler(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
```

**File: `tests/unit/auth/userValidation.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createUserSchema, updateUserSchema } from '@/lib/validation/users';

describe('createUserSchema', () => {
  it('accepts valid user data with default role', () => {
    const result = createUserSchema.safeParse({
      name: 'Dr. Lisa Chen',
      email: 'lisa@example.com',
      password: 'securepassword123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('USER');
    }
  });

  it('accepts valid user data with explicit ADMIN role', () => {
    const result = createUserSchema.safeParse({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'securepassword123',
      role: 'ADMIN',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.role).toBe('ADMIN');
    }
  });

  it('rejects invalid role', () => {
    const result = createUserSchema.safeParse({
      name: 'User',
      email: 'user@example.com',
      password: 'securepassword123',
      role: 'SUPERADMIN',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createUserSchema.safeParse({
      name: '',
      email: 'user@example.com',
      password: 'securepassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = createUserSchema.safeParse({
      name: 'User',
      email: 'not-an-email',
      password: 'securepassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects short password', () => {
    const result = createUserSchema.safeParse({
      name: 'User',
      email: 'user@example.com',
      password: '1234567',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateUserSchema', () => {
  it('accepts name-only update', () => {
    const result = updateUserSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts role-only update', () => {
    const result = updateUserSchema.safeParse({ role: 'ADMIN' });
    expect(result.success).toBe(true);
  });

  it('accepts both name and role update', () => {
    const result = updateUserSchema.safeParse({
      name: 'New Name',
      role: 'USER',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty object (all fields optional)', () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('rejects invalid role value', () => {
    const result = updateUserSchema.safeParse({ role: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects empty name string', () => {
    const result = updateUserSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });
});
```

### Integration Tests

**File: `tests/api/userManagement.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Admin User Management', () => {
  let adminSessionCookie: string;
  let adminUserId: string;
  let adminTenantId: string;
  let userSessionCookie: string;
  let regularUserId: string;
  let regularTenantId: string;
  let createdUserId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('testpassword123', 10);

    // Create admin user
    const adminTenant = await prisma.tenant.create({
      data: { name: 'Admin Test Tenant' },
    });
    adminTenantId = adminTenant.id;

    const admin = await prisma.user.create({
      data: {
        name: 'Test Admin',
        email: 'test-admin-mgmt@example.com',
        passwordHash,
        role: 'ADMIN',
        tenantId: adminTenant.id,
      },
    });
    adminUserId = admin.id;

    // Create regular user
    const userTenant = await prisma.tenant.create({
      data: { name: 'User Test Tenant' },
    });
    regularTenantId = userTenant.id;

    const user = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test-user-mgmt@example.com',
        passwordHash,
        role: 'USER',
        tenantId: userTenant.id,
      },
    });
    regularUserId = user.id;

    // Login as admin
    const adminLogin = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-admin-mgmt@example.com',
          password: 'testpassword123',
        }),
        redirect: 'manual',
      }
    );
    adminSessionCookie =
      adminLogin.headers.get('set-cookie')?.split(';')[0] || '';

    // Login as regular user
    const userLogin = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-user-mgmt@example.com',
          password: 'testpassword123',
        }),
        redirect: 'manual',
      }
    );
    userSessionCookie =
      userLogin.headers.get('set-cookie')?.split(';')[0] || '';
  });

  afterAll(async () => {
    // Clean up all test data
    const testEmails = [
      'test-admin-mgmt@example.com',
      'test-user-mgmt@example.com',
      'test-created-user@example.com',
    ];
    await prisma.user.deleteMany({
      where: { email: { in: testEmails } },
    });
    // Also clean up the created user if it was made
    if (createdUserId) {
      await prisma.user.deleteMany({ where: { id: createdUserId } });
    }
    await prisma.tenant.deleteMany({
      where: { id: { in: [adminTenantId, regularTenantId] } },
    });
    // Clean up any tenants created during tests
    await prisma.tenant.deleteMany({
      where: { name: { contains: 'test-created' } },
    });
  });

  // --- Authorization Tests ---

  it('returns 403 when non-admin calls GET /api/users', async () => {
    const response = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: userSessionCookie },
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('returns 403 when non-admin calls POST /api/users', async () => {
    const response = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: userSessionCookie,
      },
      body: JSON.stringify({
        name: 'Should Not Create',
        email: 'shouldnot@example.com',
        password: 'password123',
      }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await fetch(`${BASE_URL}/api/users`);
    expect(response.status).toBe(401);
  });

  // --- List Users Tests ---

  it('admin can list all users', async () => {
    const response = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: adminSessionCookie },
    });

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta.total).toBeGreaterThan(0);
    expect(body.meta.timestamp).toBeDefined();

    // Verify no password hashes in response
    body.data.forEach((user: Record<string, unknown>) => {
      expect(user.passwordHash).toBeUndefined();
      expect(user.password).toBeUndefined();
    });
  });

  it('admin can list users with pagination', async () => {
    const response = await fetch(`${BASE_URL}/api/users?limit=1&offset=0`, {
      headers: { Cookie: adminSessionCookie },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.meta.limit).toBe(1);
    expect(body.meta.offset).toBe(0);
  });

  // --- Create User Tests ---

  it('admin can create a new user', async () => {
    const response = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({
        name: 'test-created-user',
        email: 'test-created-user@example.com',
        password: 'securepassword123',
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();

    expect(body.data.id).toBeDefined();
    expect(body.data.name).toBe('test-created-user');
    expect(body.data.email).toBe('test-created-user@example.com');
    expect(body.data.role).toBe('USER');
    expect(body.data.tenantId).toBeDefined();
    expect(body.data.isDeactivated).toBe(false);

    // Verify password not in response
    expect(body.data.password).toBeUndefined();
    expect(body.data.passwordHash).toBeUndefined();

    createdUserId = body.data.id;

    // Verify the new user got their own tenant
    const newUserTenant = await prisma.tenant.findUnique({
      where: { id: body.data.tenantId },
    });
    expect(newUserTenant).toBeDefined();
  });

  it('admin can create a user with ADMIN role', async () => {
    const response = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({
        name: 'New Admin',
        email: 'test-newadmin-mgmt@example.com',
        password: 'securepassword123',
        role: 'ADMIN',
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.data.role).toBe('ADMIN');

    // Clean up
    await prisma.user.delete({ where: { id: body.data.id } });
    await prisma.tenant.delete({ where: { id: body.data.tenantId } });
  });

  it('returns 409 when creating user with existing email', async () => {
    const response = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({
        name: 'Duplicate',
        email: 'test-admin-mgmt@example.com',
        password: 'securepassword123',
      }),
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('returns 400 for invalid create user input', async () => {
    const response = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({
        name: '',
        email: 'invalid',
        password: 'short',
      }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  // --- Update User Tests ---

  it('admin can update a user name', async () => {
    const response = await fetch(
      `${BASE_URL}/api/users/${regularUserId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSessionCookie,
        },
        body: JSON.stringify({ name: 'Updated Name' }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.name).toBe('Updated Name');
  });

  it('admin can update a user role', async () => {
    const response = await fetch(
      `${BASE_URL}/api/users/${regularUserId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSessionCookie,
        },
        body: JSON.stringify({ role: 'ADMIN' }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.role).toBe('ADMIN');

    // Revert back to USER for other tests
    await fetch(`${BASE_URL}/api/users/${regularUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({ role: 'USER' }),
    });
  });

  it('returns 404 when updating non-existent user', async () => {
    const response = await fetch(
      `${BASE_URL}/api/users/00000000-0000-0000-0000-000000000000`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: adminSessionCookie,
        },
        body: JSON.stringify({ name: 'Ghost' }),
      }
    );

    expect(response.status).toBe(404);
  });

  // --- Deactivate User Tests ---

  it('admin cannot deactivate themselves', async () => {
    const response = await fetch(
      `${BASE_URL}/api/users/${adminUserId}`,
      {
        method: 'DELETE',
        headers: { Cookie: adminSessionCookie },
      }
    );

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('own account');
  });

  it('admin can deactivate another user', async () => {
    // Create a user to deactivate
    const createResponse = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({
        name: 'To Be Deactivated',
        email: 'test-deactivate-target@example.com',
        password: 'securepassword123',
      }),
    });
    const { data: newUser } = await createResponse.json();

    // Deactivate the user
    const response = await fetch(`${BASE_URL}/api/users/${newUser.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminSessionCookie },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.isDeactivated).toBe(true);
    expect(body.data.deactivatedAt).toBeDefined();

    // Verify deactivated user cannot log in
    const loginResponse = await fetch(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test-deactivate-target@example.com',
          password: 'securepassword123',
        }),
        redirect: 'manual',
      }
    );
    const location = loginResponse.headers.get('location');
    expect(location).toContain('error');

    // Clean up
    await prisma.user.delete({ where: { id: newUser.id } });
    await prisma.tenant.delete({ where: { id: newUser.tenantId } });
  });

  it('returns 409 when deactivating an already-deactivated user', async () => {
    // Create and deactivate a user
    const createResponse = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminSessionCookie,
      },
      body: JSON.stringify({
        name: 'Double Deactivate',
        email: 'test-double-deactivate@example.com',
        password: 'securepassword123',
      }),
    });
    const { data: newUser } = await createResponse.json();

    // First deactivation
    await fetch(`${BASE_URL}/api/users/${newUser.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminSessionCookie },
    });

    // Second deactivation attempt
    const response = await fetch(`${BASE_URL}/api/users/${newUser.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminSessionCookie },
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');

    // Clean up
    await prisma.user.delete({ where: { id: newUser.id } });
    await prisma.tenant.delete({ where: { id: newUser.tenantId } });
  });

  it('returns 404 when deactivating non-existent user', async () => {
    const response = await fetch(
      `${BASE_URL}/api/users/00000000-0000-0000-0000-000000000000`,
      {
        method: 'DELETE',
        headers: { Cookie: adminSessionCookie },
      }
    );

    expect(response.status).toBe(404);
  });
});
```

---

## Files to Create/Modify

| Action | File Path | Description |
|--------|-----------|-------------|
| Create | `src/lib/validation/users.ts` | Zod schemas for user create and update |
| Create | `src/lib/withAdmin.ts` | Admin role check wrapper for API routes |
| Create | `src/app/api/users/route.ts` | GET (list) and POST (create) user endpoints |
| Create | `src/app/api/users/[id]/route.ts` | GET, PUT, DELETE (deactivate) user endpoints |
| Modify | `src/lib/auth.ts` | Add deactivation check to authorize function |
| Create | `tests/unit/auth/withAdmin.test.ts` | Unit tests for admin middleware |
| Create | `tests/unit/auth/userValidation.test.ts` | Unit tests for user Zod schemas |
| Create | `tests/api/userManagement.test.ts` | Integration tests for admin user management |

---

**Last Updated:** 2026-02-21
