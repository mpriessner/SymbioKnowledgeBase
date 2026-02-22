# Story SKB-17.1: Teamspace Data Model

**Epic:** Epic 17 - Teamspaces
**Story ID:** SKB-17.1
**Story Points:** 8 | **Priority:** Critical | **Status:** Planned
**Depends On:** EPIC-02 (auth and tenant isolation must exist)

---

## User Story

As a backend developer, I want to implement the teamspace data model with Prisma, So that pages can be organized into team-shared workspaces with role-based access control.

---

## Acceptance Criteria

1. **Teamspace Model**
   - [ ] `Teamspace` model with fields: `id` (UUID), `tenantId` (FK to tenants), `name` (string), `icon` (nullable string for emoji), `createdAt` (timestamp)
   - [ ] Unique index on `(tenantId, name)` — no duplicate team names within a tenant
   - [ ] Cascade delete: deleting a tenant deletes all its teamspaces

2. **TeamspaceMember Model**
   - [ ] `TeamspaceMember` model with fields: `id` (UUID), `teamspaceId` (FK to teamspaces), `userId` (FK to users), `role` (enum: OWNER, ADMIN, MEMBER, GUEST), `createdAt` (timestamp)
   - [ ] Unique index on `(teamspaceId, userId)` — user can only be added once per teamspace
   - [ ] Composite index on `(teamspaceId, role)` for permission queries
   - [ ] Cascade delete: deleting a teamspace deletes all its members

3. **Page Model Update**
   - [ ] Add `teamspaceId` field to `Page` model (nullable UUID, FK to teamspaces)
   - [ ] Index on `(tenantId, teamspaceId)` for efficient page queries by team
   - [ ] `teamspaceId = null` means private page (visible only to creator)
   - [ ] `teamspaceId = X` means team page (visible to all members of teamspace X)
   - [ ] Cascade behavior: deleting a teamspace sets `teamspaceId = null` for all its pages (NOT cascade delete — preserve pages)

4. **Migration**
   - [ ] Prisma migration file generated: `prisma migrate dev --name add_teamspaces`
   - [ ] Migration is idempotent and safe to run multiple times
   - [ ] All existing pages have `teamspaceId = null` after migration (all pages remain private)

5. **API Routes - Teamspace CRUD**
   - [ ] `POST /api/teamspaces` — Create teamspace (requires auth)
     - Request body: `{ name: string, icon?: string }`
     - Creates teamspace with `tenantId` from session
     - Automatically adds creator as OWNER in `teamspace_members`
     - Returns: `{ data: { id, tenantId, name, icon, createdAt, role: "OWNER" }, meta }`
   - [ ] `GET /api/teamspaces` — List user's teamspaces (requires auth)
     - Query params: none
     - Returns only teamspaces where user is a member (via `teamspace_members` join)
     - Returns: `{ data: [{ id, name, icon, role, memberCount }], meta }`
   - [ ] `PATCH /api/teamspaces/:id` — Update teamspace (requires ADMIN or OWNER role)
     - Request body: `{ name?: string, icon?: string }`
     - Validates user has ADMIN or OWNER role in teamspace
     - Returns: `{ data: { id, tenantId, name, icon }, meta }`
   - [ ] `DELETE /api/teamspaces/:id` — Delete teamspace (requires OWNER role)
     - Validates user is OWNER of teamspace
     - Sets all pages' `teamspaceId = null` before deleting teamspace
     - Deletes teamspace and all members via cascade
     - Returns: `{ data: { success: true }, meta }`

6. **API Routes - Member Management**
   - [ ] `POST /api/teamspaces/:id/members` — Add member (requires ADMIN or OWNER)
     - Request body: `{ userId: string, role: "ADMIN" | "MEMBER" | "GUEST" }` (cannot add as OWNER via API)
     - Validates user has ADMIN or OWNER role in teamspace
     - Validates target user exists in same tenant
     - Returns 409 if user is already a member
     - Returns: `{ data: { id, teamspaceId, userId, role }, meta }`
   - [ ] `DELETE /api/teamspaces/:id/members/:userId` — Remove member (requires ADMIN or OWNER)
     - Validates requester has ADMIN or OWNER role
     - Cannot remove the last OWNER (returns 400 error)
     - Cannot remove self if you are OWNER and there are no other OWNERs
     - Returns: `{ data: { success: true }, meta }`
   - [ ] `PATCH /api/teamspaces/:id/members/:userId` — Update member role (requires OWNER)
     - Request body: `{ role: "OWNER" | "ADMIN" | "MEMBER" | "GUEST" }`
     - Only OWNER can change roles
     - Transferring OWNER role demotes current OWNER to ADMIN automatically
     - Returns: `{ data: { id, teamspaceId, userId, role }, meta }`

7. **Page Query Updates**
   - [ ] `GET /api/pages` updated to include teamspace filtering:
     - Returns pages where (`teamspaceId IS NULL AND creatorId = userId`) OR (`teamspaceId IN (SELECT teamspaceId FROM teamspace_members WHERE userId = X)`)
     - Optional query param: `?teamspaceId=X` to filter by specific teamspace
     - Optional query param: `?private=true` to filter only private pages (teamspaceId IS NULL)
   - [ ] `GET /api/pages/:id` validates user has access:
     - If page.teamspaceId IS NULL, only creator can access
     - If page.teamspaceId IS NOT NULL, user must be a member of that teamspace

8. **Validation**
   - [ ] Zod schemas for all request bodies
   - [ ] Teamspace name: 1-100 characters, no leading/trailing whitespace
   - [ ] Icon: single emoji or null
   - [ ] Role enum validation: only OWNER, ADMIN, MEMBER, GUEST allowed
   - [ ] All tenant_id scoping verified in tests

---

## Technical Implementation Notes

### Prisma Schema Updates

**File: `prisma/schema.prisma`**

```prisma
enum TeamspaceRole {
  OWNER
  ADMIN
  MEMBER
  GUEST
}

model Teamspace {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  name      String
  icon      String?
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  tenant  Tenant              @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  members TeamspaceMember[]
  pages   Page[]

  // Indexes
  @@unique([tenantId, name], map: "uq_teamspaces_tenant_name")
  @@index([tenantId], map: "idx_teamspaces_tenant_id")

  @@map("teamspaces")
}

model TeamspaceMember {
  id          String        @id @default(uuid())
  teamspaceId String        @map("teamspace_id")
  userId      String        @map("user_id")
  role        TeamspaceRole @default(MEMBER)
  createdAt   DateTime      @default(now()) @map("created_at")

  // Relations
  teamspace Teamspace @relation(fields: [teamspaceId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Indexes
  @@unique([teamspaceId, userId], map: "uq_teamspace_members_teamspace_user")
  @@index([teamspaceId, role], map: "idx_teamspace_members_teamspace_role")
  @@index([userId], map: "idx_teamspace_members_user_id")

  @@map("teamspace_members")
}

// Update Page model
model Page {
  // ... existing fields ...
  teamspaceId String? @map("teamspace_id")

  // Relations
  teamspace Teamspace? @relation(fields: [teamspaceId], references: [id], onDelete: SetNull)

  // Indexes (add to existing indexes)
  @@index([tenantId, teamspaceId], map: "idx_pages_tenant_teamspace")
}

// Update User model to add relation
model User {
  // ... existing fields ...
  teamspaceMembers TeamspaceMember[]
}

// Update Tenant model to add relation
model Tenant {
  // ... existing fields ...
  teamspaces Teamspace[]
}
```

---

### API Endpoint: Create Teamspace

**File: `src/app/api/teamspaces/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/auth/withTenant';
import { prisma } from '@/lib/db';

const createTeamspaceSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  icon: z.string().emoji().nullable().optional(),
});

export const POST = withTenant(async (req: NextRequest, { tenantId, userId }) => {
  const body = await req.json();
  const parsed = createTeamspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors, meta: { timestamp: new Date().toISOString() } },
      { status: 400 }
    );
  }

  const { name, icon } = parsed.data;

  // Check for duplicate name within tenant
  const existing = await prisma.teamspace.findUnique({
    where: {
      tenantId_name: { tenantId, name },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: 'A teamspace with this name already exists', meta: { timestamp: new Date().toISOString() } },
      { status: 409 }
    );
  }

  // Create teamspace and add creator as OWNER (transaction)
  const teamspace = await prisma.$transaction(async (tx) => {
    const newTeamspace = await tx.teamspace.create({
      data: {
        tenantId,
        name,
        icon: icon ?? null,
      },
    });

    await tx.teamspaceMember.create({
      data: {
        teamspaceId: newTeamspace.id,
        userId,
        role: 'OWNER',
      },
    });

    return newTeamspace;
  });

  return NextResponse.json(
    {
      data: {
        id: teamspace.id,
        tenantId: teamspace.tenantId,
        name: teamspace.name,
        icon: teamspace.icon,
        createdAt: teamspace.createdAt.toISOString(),
        role: 'OWNER',
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
});

export const GET = withTenant(async (req: NextRequest, { tenantId, userId }) => {
  // Fetch teamspaces where user is a member
  const teamspaces = await prisma.teamspace.findMany({
    where: {
      tenantId,
      members: {
        some: { userId },
      },
    },
    include: {
      members: {
        where: { userId },
        select: { role: true },
      },
      _count: {
        select: { members: true },
      },
    },
  });

  const data = teamspaces.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
    role: t.members[0].role,
    memberCount: t._count.members,
  }));

  return NextResponse.json({
    data,
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

### API Endpoint: Update/Delete Teamspace

**File: `src/app/api/teamspaces/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/auth/withTenant';
import { prisma } from '@/lib/db';

const updateTeamspaceSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  icon: z.string().emoji().nullable().optional(),
});

export const PATCH = withTenant(async (req: NextRequest, { tenantId, userId, params }) => {
  const { id } = params;
  const body = await req.json();
  const parsed = updateTeamspaceSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors, meta: { timestamp: new Date().toISOString() } },
      { status: 400 }
    );
  }

  // Check user has ADMIN or OWNER role
  const member = await prisma.teamspaceMember.findUnique({
    where: {
      teamspaceId_userId: { teamspaceId: id, userId },
    },
  });

  if (!member || !['ADMIN', 'OWNER'].includes(member.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions', meta: { timestamp: new Date().toISOString() } },
      { status: 403 }
    );
  }

  // Update teamspace
  const teamspace = await prisma.teamspace.update({
    where: {
      id,
      tenantId, // Tenant isolation
    },
    data: parsed.data,
  });

  return NextResponse.json({
    data: {
      id: teamspace.id,
      tenantId: teamspace.tenantId,
      name: teamspace.name,
      icon: teamspace.icon,
    },
    meta: { timestamp: new Date().toISOString() },
  });
});

export const DELETE = withTenant(async (req: NextRequest, { tenantId, userId, params }) => {
  const { id } = params;

  // Check user is OWNER
  const member = await prisma.teamspaceMember.findUnique({
    where: {
      teamspaceId_userId: { teamspaceId: id, userId },
    },
  });

  if (!member || member.role !== 'OWNER') {
    return NextResponse.json(
      { error: 'Only the owner can delete a teamspace', meta: { timestamp: new Date().toISOString() } },
      { status: 403 }
    );
  }

  // Set all pages' teamspaceId = null, then delete teamspace (transaction)
  await prisma.$transaction(async (tx) => {
    await tx.page.updateMany({
      where: { teamspaceId: id, tenantId },
      data: { teamspaceId: null },
    });

    await tx.teamspace.delete({
      where: { id, tenantId },
    });
  });

  return NextResponse.json({
    data: { success: true },
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

### API Endpoint: Member Management

**File: `src/app/api/teamspaces/[id]/members/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/auth/withTenant';
import { prisma } from '@/lib/db';

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']),
});

export const POST = withTenant(async (req: NextRequest, { tenantId, userId, params }) => {
  const { id: teamspaceId } = params;
  const body = await req.json();
  const parsed = addMemberSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.errors, meta: { timestamp: new Date().toISOString() } },
      { status: 400 }
    );
  }

  // Check requester has ADMIN or OWNER role
  const requesterMember = await prisma.teamspaceMember.findUnique({
    where: {
      teamspaceId_userId: { teamspaceId, userId },
    },
  });

  if (!requesterMember || !['ADMIN', 'OWNER'].includes(requesterMember.role)) {
    return NextResponse.json(
      { error: 'Insufficient permissions', meta: { timestamp: new Date().toISOString() } },
      { status: 403 }
    );
  }

  // Validate target user exists in same tenant
  const targetUser = await prisma.user.findFirst({
    where: { id: parsed.data.userId, tenantId },
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: 'User not found in this tenant', meta: { timestamp: new Date().toISOString() } },
      { status: 404 }
    );
  }

  // Check if already a member
  const existingMember = await prisma.teamspaceMember.findUnique({
    where: {
      teamspaceId_userId: { teamspaceId, userId: parsed.data.userId },
    },
  });

  if (existingMember) {
    return NextResponse.json(
      { error: 'User is already a member of this teamspace', meta: { timestamp: new Date().toISOString() } },
      { status: 409 }
    );
  }

  // Add member
  const member = await prisma.teamspaceMember.create({
    data: {
      teamspaceId,
      userId: parsed.data.userId,
      role: parsed.data.role,
    },
  });

  return NextResponse.json(
    {
      data: {
        id: member.id,
        teamspaceId: member.teamspaceId,
        userId: member.userId,
        role: member.role,
      },
      meta: { timestamp: new Date().toISOString() },
    },
    { status: 201 }
  );
});
```

---

### Validation Schemas

**File: `src/lib/validation/teamspace.ts`**

```typescript
import { z } from 'zod';

export const teamspaceNameSchema = z.string().min(1).max(100).trim();

export const teamspaceIconSchema = z.string().regex(/^\p{Emoji}$/u).nullable();

export const teamspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'GUEST']);

export const createTeamspaceSchema = z.object({
  name: teamspaceNameSchema,
  icon: teamspaceIconSchema.optional(),
});

export const updateTeamspaceSchema = z.object({
  name: teamspaceNameSchema.optional(),
  icon: teamspaceIconSchema.optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(['ADMIN', 'MEMBER', 'GUEST']), // Cannot add as OWNER
});

export const updateMemberRoleSchema = z.object({
  role: teamspaceRoleSchema,
});
```

---

## Test Scenarios

### Unit Tests: `src/__tests__/lib/validation/teamspace.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { createTeamspaceSchema, teamspaceRoleSchema } from '@/lib/validation/teamspace';

describe('Teamspace Validation', () => {
  it('should accept valid teamspace name', () => {
    const result = createTeamspaceSchema.safeParse({ name: 'Research Team' });
    expect(result.success).toBe(true);
  });

  it('should reject empty teamspace name', () => {
    const result = createTeamspaceSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('should trim whitespace from teamspace name', () => {
    const result = createTeamspaceSchema.safeParse({ name: '  Team  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Team');
    }
  });

  it('should accept valid role enum', () => {
    expect(teamspaceRoleSchema.safeParse('OWNER').success).toBe(true);
    expect(teamspaceRoleSchema.safeParse('ADMIN').success).toBe(true);
    expect(teamspaceRoleSchema.safeParse('MEMBER').success).toBe(true);
    expect(teamspaceRoleSchema.safeParse('GUEST').success).toBe(true);
  });

  it('should reject invalid role', () => {
    expect(teamspaceRoleSchema.safeParse('SUPERUSER').success).toBe(false);
  });
});
```

### Integration Tests: `src/__tests__/api/teamspaces/route.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/teamspaces/route';
import { prisma } from '@/lib/db';
import { mockAuthContext } from '@/test-utils/mockAuth';

describe('POST /api/teamspaces', () => {
  beforeEach(async () => {
    // Clean up test data
    await prisma.teamspaceMember.deleteMany();
    await prisma.teamspace.deleteMany();
  });

  it('should create teamspace and add creator as OWNER', async () => {
    const req = new Request('http://localhost/api/teamspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Team', icon: '🚀' }),
    });

    const { tenantId, userId } = mockAuthContext();
    const response = await POST(req, { tenantId, userId });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.data.name).toBe('Test Team');
    expect(data.data.role).toBe('OWNER');

    // Verify member was added
    const member = await prisma.teamspaceMember.findFirst({
      where: { teamspaceId: data.data.id, userId },
    });
    expect(member?.role).toBe('OWNER');
  });

  it('should reject duplicate teamspace name within tenant', async () => {
    const { tenantId, userId } = mockAuthContext();

    // Create first teamspace
    await prisma.teamspace.create({
      data: { tenantId, name: 'Test Team' },
    });

    // Attempt to create duplicate
    const req = new Request('http://localhost/api/teamspaces', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Team' }),
    });

    const response = await POST(req, { tenantId, userId });
    expect(response.status).toBe(409);
  });
});

describe('GET /api/teamspaces', () => {
  it('should return only teamspaces where user is a member', async () => {
    const { tenantId, userId } = mockAuthContext();

    // Create teamspace where user is member
    const teamspace1 = await prisma.teamspace.create({
      data: { tenantId, name: 'Team 1' },
    });
    await prisma.teamspaceMember.create({
      data: { teamspaceId: teamspace1.id, userId, role: 'MEMBER' },
    });

    // Create teamspace where user is NOT a member
    await prisma.teamspace.create({
      data: { tenantId, name: 'Team 2' },
    });

    const req = new Request('http://localhost/api/teamspaces');
    const response = await GET(req, { tenantId, userId });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.length).toBe(1);
    expect(data.data[0].name).toBe('Team 1');
  });
});
```

### E2E Tests: `tests/e2e/teamspaces.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Teamspaces API', () => {
  test('should create teamspace via API', async ({ request }) => {
    const response = await request.post('/api/teamspaces', {
      data: { name: 'E2E Test Team', icon: '🧪' },
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.data.name).toBe('E2E Test Team');
    expect(data.data.role).toBe('OWNER');
  });

  test('should list user teamspaces', async ({ request }) => {
    // Create teamspace
    await request.post('/api/teamspaces', {
      data: { name: 'List Test Team' },
    });

    // List teamspaces
    const response = await request.get('/api/teamspaces');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.data.length).toBeGreaterThanOrEqual(1);
    expect(data.data.some((t) => t.name === 'List Test Team')).toBe(true);
  });
});
```

---

## Dependencies

- **SKB-01.2:** Prisma schema with User, Tenant, Page models must exist
- **SKB-02.2:** Tenant isolation middleware (`withTenant`) must be functional

---

## Dev Notes

### Migration Gotchas

- **Cascade behavior:** When a teamspace is deleted, `page.teamspaceId` is set to NULL (not cascade delete) to preserve pages. Make sure migration uses `onDelete: SetNull` for the foreign key.
- **OWNER constraint:** Ensure at least one OWNER exists per teamspace. API endpoints must enforce this (e.g., cannot remove last OWNER).
- **Tenant isolation:** All queries must include `tenantId` in WHERE clauses. Test with multiple tenants to verify isolation.

### Role Hierarchy

```
OWNER > ADMIN > MEMBER > GUEST

Permissions:
- OWNER: All actions (create, edit, delete, share, manage members, delete team)
- ADMIN: Edit, share, manage members (cannot delete team or transfer ownership)
- MEMBER: Edit and share (cannot manage members)
- GUEST: Read-only
```

### Performance Considerations

- **Index on (tenantId, teamspaceId):** Critical for page queries filtered by team
- **Index on (teamspaceId, userId):** Ensures fast membership checks
- **Page query optimization:** Use `IN (SELECT teamspaceId FROM teamspace_members WHERE userId = X)` subquery or JOIN for efficiency

### Edge Cases

- **Last OWNER removal:** API must prevent removing the last OWNER unless teamspace is being deleted
- **Ownership transfer:** When updating a member to OWNER, automatically demote current OWNER to ADMIN
- **Empty teamspaces:** Deleting a teamspace should not fail if it has pages — pages should revert to private

---

**Last Updated:** 2026-02-22
