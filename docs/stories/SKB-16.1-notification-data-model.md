# Story SKB-16.1: Notification Data Model

**Epic:** Epic 16 - Inbox & Notifications
**Story ID:** SKB-16.1
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** None

---

## User Story

As a user, I want a database-backed notification system, So that I can receive and track updates about pages, mentions, and agent actions even when I'm offline.

---

## Acceptance Criteria

- [ ] **Prisma Schema:**
  - `Notification` model with fields: `id`, `tenant_id`, `user_id`, `type`, `title`, `body`, `page_id`, `source_user_id`, `read`, `created_at`
  - `NotificationType` enum: `PAGE_MENTION`, `PAGE_UPDATE`, `AGENT_CREATED`, `SYSTEM`
  - Relations: `tenant`, `user` (recipient), `page`, `sourceUser` (who triggered)
  - Indexes: `(tenant_id, user_id, created_at)`, `(tenant_id, user_id, read)`
- [ ] **API Endpoints:**
  - `GET /api/notifications` — list notifications with pagination, filtering by read status
  - `GET /api/notifications/unread-count` — return count of unread notifications
  - `PATCH /api/notifications/:id/read` — mark notification as read
  - `POST /api/notifications/read-all` — mark all user's notifications as read
- [ ] **Query Performance:**
  - Unread count query executes in <50ms (indexed)
  - Notification list query returns 50 items in <100ms
- [ ] **Validation:**
  - User can only access their own notifications (filtered by `user_id` from session)
  - All queries scoped by `tenant_id`
  - `page_id` and `source_user_id` are optional (nullable)
- [ ] **Response Format:**
  - Standard envelope: `{ data, meta }`
  - Notification includes: `id`, `type`, `title`, `body`, `page_id`, `page_title`, `source_user_name`, `read`, `created_at`
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Notification Data Model Architecture
────────────────────────────────────────

Database Schema:
┌─────────────────────────────────────────────────────────────────────┐
│  notifications                                                       │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  id               uuid       PRIMARY KEY                        │ │
│  │  tenant_id        uuid       FOREIGN KEY → tenants.id          │ │
│  │  user_id          uuid       FOREIGN KEY → users.id (recipient)│ │
│  │  type             enum       PAGE_MENTION | PAGE_UPDATE | ...  │ │
│  │  title            string     "John mentioned you in Roadmap"   │ │
│  │  body             string?    Optional detail text              │ │
│  │  page_id          uuid?      FOREIGN KEY → pages.id (nullable) │ │
│  │  source_user_id   uuid?      FOREIGN KEY → users.id (nullable) │ │
│  │  read             boolean    DEFAULT false                     │ │
│  │  created_at       timestamp  DEFAULT now()                     │ │
│  │                                                                 │ │
│  │  Indexes:                                                       │ │
│  │    idx_notifications_user_created (tenant_id, user_id, created_at)│
│  │    idx_notifications_user_read (tenant_id, user_id, read)      │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

API Endpoints:
┌─────────────────────────────────────────────────────────────────────┐
│  GET /api/notifications                                              │
│    Query params:                                                     │
│      - limit: number (default 50, max 100)                           │
│      - offset: number (default 0)                                    │
│      - read: boolean? (filter by read status)                        │
│                                                                       │
│    Response:                                                         │
│      {                                                               │
│        data: [                                                       │
│          {                                                           │
│            id: "uuid",                                               │
│            type: "PAGE_MENTION",                                     │
│            title: "John mentioned you in Project Roadmap",           │
│            body: null,                                               │
│            page_id: "uuid",                                          │
│            page_title: "Project Roadmap",                            │
│            source_user_id: "uuid",                                   │
│            source_user_name: "John Doe",                             │
│            read: false,                                              │
│            created_at: "2026-02-22T10:00:00Z"                        │
│          }                                                           │
│        ],                                                            │
│        meta: {                                                       │
│          total: 42,                                                  │
│          limit: 50,                                                  │
│          offset: 0,                                                  │
│          unread_count: 3                                             │
│        }                                                             │
│      }                                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  GET /api/notifications/unread-count                                 │
│    Response:                                                         │
│      {                                                               │
│        data: { count: 3 },                                           │
│        meta: { timestamp: "..." }                                    │
│      }                                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  PATCH /api/notifications/:id/read                                   │
│    Response:                                                         │
│      {                                                               │
│        data: { id: "uuid", read: true },                             │
│        meta: { timestamp: "..." }                                    │
│      }                                                               │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  POST /api/notifications/read-all                                    │
│    Response:                                                         │
│      {                                                               │
│        data: { marked_read: 5 },                                     │
│        meta: { timestamp: "..." }                                    │
│      }                                                               │
└─────────────────────────────────────────────────────────────────────┘

Query Flow:
┌─────────────────────────────────────────────────────────────────────┐
│  1. User requests /api/notifications                                 │
│     ↓                                                                │
│  2. withTenant middleware extracts tenant_id, user_id               │
│     ↓                                                                │
│  3. Query notifications WHERE tenant_id = X AND user_id = Y         │
│     ↓                                                                │
│  4. Join pages table to get page_title                               │
│     ↓                                                                │
│  5. Join users table to get source_user_name                         │
│     ↓                                                                │
│  6. Order by created_at DESC                                         │
│     ↓                                                                │
│  7. Return formatted response                                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Update Prisma Schema

**File: `prisma/schema.prisma`** (additions)

```prisma
// Notification type enum
enum NotificationType {
  PAGE_MENTION
  PAGE_UPDATE
  AGENT_CREATED
  SYSTEM
}

// Notification model
model Notification {
  id           String           @id @default(uuid())
  tenantId     String           @map("tenant_id")
  userId       String           @map("user_id")
  type         NotificationType
  title        String
  body         String?
  pageId       String?          @map("page_id")
  sourceUserId String?          @map("source_user_id")
  read         Boolean          @default(false)
  createdAt    DateTime         @default(now()) @map("created_at")

  // Relations
  tenant     Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user       User   @relation("NotificationRecipient", fields: [userId], references: [id], onDelete: Cascade)
  page       Page?  @relation(fields: [pageId], references: [id], onDelete: SetNull)
  sourceUser User?  @relation("NotificationSource", fields: [sourceUserId], references: [id], onDelete: SetNull)

  // Indexes
  @@index([tenantId, userId, createdAt], map: "idx_notifications_user_created")
  @@index([tenantId, userId, read], map: "idx_notifications_user_read")
  @@map("notifications")
}

// Update User model (add notification relations)
model User {
  // ... existing fields ...
  receivedNotifications Notification[] @relation("NotificationRecipient")
  sentNotifications     Notification[] @relation("NotificationSource")
}

// Update Tenant model
model Tenant {
  // ... existing fields ...
  notifications Notification[]
}

// Update Page model
model Page {
  // ... existing fields ...
  notifications Notification[]
}
```

**Run migration:**

```bash
npx prisma migrate dev --name add_notifications
```

---

### Step 2: Create Notification API Routes

**File: `src/app/api/notifications/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/auth/withTenant';
import { listResponse, errorResponse } from '@/lib/apiResponse';
import { z } from 'zod';
import type { TenantContext } from '@/types/auth';

const listNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  read: z.coerce.boolean().optional(),
});

export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());

      const parsed = listNotificationsSchema.safeParse(queryParams);
      if (!parsed.success) {
        return errorResponse('VALIDATION_ERROR', 'Invalid query parameters',
          parsed.error.flatten().fieldErrors, 400);
      }

      const { limit, offset, read } = parsed.data;

      const where: any = {
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      };

      if (read !== undefined) {
        where.read = read;
      }

      const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
          where,
          include: {
            page: { select: { title: true } },
            sourceUser: { select: { name: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({
          where: { ...where, read: false },
        }),
      ]);

      const formatted = notifications.map(n => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        page_id: n.pageId,
        page_title: n.page?.title,
        source_user_id: n.sourceUserId,
        source_user_name: n.sourceUser?.name || n.sourceUser?.email,
        read: n.read,
        created_at: n.createdAt.toISOString(),
      }));

      return listResponse(formatted, total, limit, offset, {
        unread_count: unreadCount,
      });
    } catch (error) {
      console.error('GET /api/notifications error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

**File: `src/app/api/notifications/unread-count/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/auth/withTenant';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import type { TenantContext } from '@/types/auth';

export const GET = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const count = await prisma.notification.count({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          read: false,
        },
      });

      return successResponse({ count });
    } catch (error) {
      console.error('GET /api/notifications/unread-count error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

**File: `src/app/api/notifications/[id]/read/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/auth/withTenant';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import type { TenantContext } from '@/types/auth';

export const PATCH = withTenant(
  async (
    req: NextRequest,
    ctx: TenantContext,
    routeContext: { params: Promise<Record<string, string>> }
  ) => {
    try {
      const { id } = await routeContext.params;

      // Verify notification belongs to user
      const notification = await prisma.notification.findFirst({
        where: {
          id,
          tenantId: ctx.tenantId,
          userId: ctx.userId,
        },
      });

      if (!notification) {
        return errorResponse('NOT_FOUND', 'Notification not found', undefined, 404);
      }

      // Mark as read
      const updated = await prisma.notification.update({
        where: { id },
        data: { read: true },
      });

      return successResponse({
        id: updated.id,
        read: updated.read,
      });
    } catch (error) {
      console.error('PATCH /api/notifications/:id/read error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

**File: `src/app/api/notifications/read-all/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/auth/withTenant';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import type { TenantContext } from '@/types/auth';

export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const result = await prisma.notification.updateMany({
        where: {
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          read: false,
        },
        data: { read: true },
      });

      return successResponse({
        marked_read: result.count,
      });
    } catch (error) {
      console.error('POST /api/notifications/read-all error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

### Step 3: Create Utility Function for Creating Notifications

**File: `src/lib/notifications/create.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { NotificationType } from '@/generated/prisma/client';

interface CreateNotificationOptions {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  pageId?: string;
  sourceUserId?: string;
}

export async function createNotification(options: CreateNotificationOptions) {
  try {
    await prisma.notification.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        type: options.type,
        title: options.title,
        body: options.body,
        pageId: options.pageId,
        sourceUserId: options.sourceUserId,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
    // Don't throw — notification failures shouldn't block primary operations
  }
}
```

---

## Testing Requirements

### Unit Tests

**File: `src/__tests__/lib/notifications/create.test.ts`**

```typescript
import { createNotification } from '@/lib/notifications/create';
import { prisma } from '@/lib/db';

describe('createNotification', () => {
  it('should create notification with all fields', async () => {
    await createNotification({
      tenantId: 'tenant-1',
      userId: 'user-1',
      type: 'PAGE_MENTION',
      title: 'Test notification',
      body: 'Body text',
      pageId: 'page-1',
      sourceUserId: 'user-2',
    });

    const notification = await prisma.notification.findFirst({
      where: { userId: 'user-1' },
    });

    expect(notification).toBeDefined();
    expect(notification?.title).toBe('Test notification');
    expect(notification?.read).toBe(false);
  });

  it('should not throw on database error', async () => {
    // Mock prisma to throw error
    jest.spyOn(prisma.notification, 'create').mockRejectedValue(new Error('DB error'));

    // Should not throw
    await expect(createNotification({
      tenantId: 'tenant-1',
      userId: 'user-1',
      type: 'SYSTEM',
      title: 'Test',
    })).resolves.toBeUndefined();
  });
});
```

---

### Integration Tests

**File: `src/__tests__/api/notifications/route.test.ts`**

```typescript
import { GET } from '@/app/api/notifications/route';
import { prisma } from '@/lib/db';

describe('GET /api/notifications', () => {
  beforeEach(async () => {
    // Create test notifications
    await prisma.notification.createMany({
      data: [
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: 'PAGE_MENTION',
          title: 'Test notification 1',
          read: false,
        },
        {
          tenantId: 'tenant-1',
          userId: 'user-1',
          type: 'PAGE_UPDATE',
          title: 'Test notification 2',
          read: true,
        },
      ],
    });
  });

  it('should list all notifications for user', async () => {
    const req = new Request('http://localhost/api/notifications');
    const ctx = { tenantId: 'tenant-1', userId: 'user-1' };

    const response = await GET(req, ctx);
    const json = await response.json();

    expect(json.data).toHaveLength(2);
    expect(json.meta.total).toBe(2);
    expect(json.meta.unread_count).toBe(1);
  });

  it('should filter by read status', async () => {
    const req = new Request('http://localhost/api/notifications?read=false');
    const ctx = { tenantId: 'tenant-1', userId: 'user-1' };

    const response = await GET(req, ctx);
    const json = await response.json();

    expect(json.data).toHaveLength(1);
    expect(json.data[0].read).toBe(false);
  });
});
```

---

### E2E Tests

**Manual test script:**

```bash
# 1. Create notification via direct DB insert
curl -X POST http://localhost/api/test/create-notification \
  -H "Content-Type: application/json" \
  -d '{"type":"PAGE_MENTION","title":"Test mention"}'

# 2. List notifications
curl http://localhost/api/notifications \
  -H "Cookie: next-auth.session-token=..."

# Expected: Array with 1 notification, unread_count: 1

# 3. Get unread count
curl http://localhost/api/notifications/unread-count \
  -H "Cookie: next-auth.session-token=..."

# Expected: { data: { count: 1 } }

# 4. Mark as read
curl -X PATCH http://localhost/api/notifications/{ID}/read \
  -H "Cookie: next-auth.session-token=..."

# Expected: { data: { id: "...", read: true } }

# 5. Get unread count again
curl http://localhost/api/notifications/unread-count \
  -H "Cookie: next-auth.session-token=..."

# Expected: { data: { count: 0 } }

# 6. Mark all as read
curl -X POST http://localhost/api/notifications/read-all \
  -H "Cookie: next-auth.session-token=..."

# Expected: { data: { marked_read: 0 } }
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `prisma/schema.prisma` |
| CREATE | `src/app/api/notifications/route.ts` |
| CREATE | `src/app/api/notifications/unread-count/route.ts` |
| CREATE | `src/app/api/notifications/[id]/read/route.ts` |
| CREATE | `src/app/api/notifications/read-all/route.ts` |
| CREATE | `src/lib/notifications/create.ts` |
| CREATE | `src/__tests__/api/notifications/route.test.ts` |
| CREATE | `src/__tests__/lib/notifications/create.test.ts` |

---

## Dev Notes

### Performance Optimization
- Database indexes on `(tenant_id, user_id, created_at)` and `(tenant_id, user_id, read)` ensure fast queries
- Unread count query uses index-only scan (doesn't need to fetch full rows)
- Limit max page size to 100 to prevent expensive queries

### Security Considerations
- All queries filtered by `tenant_id` AND `user_id` to prevent cross-user access
- Mark as read requires ownership verification (notification.userId === ctx.userId)
- No cascade delete on user — set `sourceUserId` to null if source user deleted

### Error Handling
- Notification creation failures logged but don't throw (use try/catch)
- API routes return standard error envelope for validation errors
- 404 for notification not found or access denied

### Future Enhancements (Post-MVP)
- Add `clicked_at` timestamp to track engagement
- Support notification preferences (user can disable certain types)
- Add email digest option (daily summary of unread notifications)
- Auto-delete read notifications older than 90 days (background cron)

---

**Last Updated:** 2026-02-22
