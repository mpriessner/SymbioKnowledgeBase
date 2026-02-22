# Story SKB-17.5: Presence Indicators

**Epic:** Epic 17 - Teamspaces
**Story ID:** SKB-17.5
**Story Points:** 8 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-17.2 (sidebar team sections), SKB-17.3 (page sharing — presence only matters for shared pages)

---

## User Story

As a team member, I want to see who is currently viewing or editing a shared page, So that I can avoid edit conflicts and coordinate with teammates in real-time.

---

## Acceptance Criteria

1. **Presence Tracking**
   - [ ] Client sends heartbeat every 5 seconds while page is open: `POST /api/pages/:id/presence/heartbeat`
   - [ ] Server updates `PagePresence.lastHeartbeat` timestamp to current time
   - [ ] Heartbeat stops when user navigates away or closes page

2. **Presence Data Model**
   - [ ] New `PagePresence` table: `id`, `pageId`, `userId`, `tenantId`, `lastHeartbeat` (timestamp)
   - [ ] Unique index on `(pageId, userId)` — one presence record per user per page
   - [ ] Upsert on heartbeat: create if not exists, update lastHeartbeat if exists

3. **Presence Query**
   - [ ] `GET /api/pages/:id/presence` returns users with `lastHeartbeat` within last 10 seconds
   - [ ] Response: `{ data: [{ userId, userName, userAvatar, lastSeen }], meta }`
   - [ ] Excludes current user (you don't need to see yourself)
   - [ ] Scoped by tenant_id

4. **Presence Indicators UI**
   - [ ] Avatar dots in page header (right side, before Share button)
   - [ ] Stacked avatars (overlapping circles with user initials or photo)
   - [ ] Max 5 visible avatars, "+N more" indicator if > 5 users
   - [ ] Tooltip on hover: "Name is viewing"
   - [ ] Polls `GET /api/pages/:id/presence` every 5 seconds while page is open

5. **Editing Indicator**
   - [ ] If user has `isEditing: true` in presence (updated on block edit), show pencil icon on avatar
   - [ ] "X is editing" text label below page title
   - [ ] Highlight editing user's avatar with pulsing border

6. **Cleanup**
   - [ ] Background job (cron or edge function) removes presence records older than 1 minute
   - [ ] Or: lazy cleanup on query (filter out records with `lastHeartbeat < now() - 1 minute`)

7. **Performance**
   - [ ] Heartbeat API is lightweight (no heavy queries)
   - [ ] Presence query joins with users table (fetch name, avatar in one query)
   - [ ] Client debounces rapid heartbeats (max 1 per 5 seconds)

---

## Technical Implementation Notes

### Prisma Schema

**File: `prisma/schema.prisma`**

```prisma
model PagePresence {
  id            String   @id @default(uuid())
  pageId        String   @map("page_id")
  userId        String   @map("user_id")
  tenantId      String   @map("tenant_id")
  lastHeartbeat DateTime @map("last_heartbeat") @default(now())
  isEditing     Boolean  @default(false) @map("is_editing")

  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  page   Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Indexes
  @@unique([pageId, userId], map: "uq_page_presence_page_user")
  @@index([pageId], map: "idx_page_presence_page_id")
  @@index([lastHeartbeat], map: "idx_page_presence_last_heartbeat")

  @@map("page_presence")
}

// Update Page model
model Page {
  // ... existing fields ...
  presenceRecords PagePresence[]
}

// Update User model
model User {
  // ... existing fields ...
  presenceRecords PagePresence[]
}

// Update Tenant model
model Tenant {
  // ... existing fields ...
  presenceRecords PagePresence[]
}
```

---

### API Endpoint: Heartbeat

**File: `src/app/api/pages/[id]/presence/heartbeat/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenant } from '@/lib/auth/withTenant';
import { prisma } from '@/lib/db';

const heartbeatSchema = z.object({
  isEditing: z.boolean().default(false),
});

export const POST = withTenant(async (req: NextRequest, { tenantId, userId, params }) => {
  const { id: pageId } = params;
  const body = await req.json();
  const parsed = heartbeatSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', meta: { timestamp: new Date().toISOString() } },
      { status: 400 }
    );
  }

  // Verify page exists and user has access
  const page = await prisma.page.findUnique({
    where: { id: pageId, tenantId },
  });

  if (!page) {
    return NextResponse.json(
      { error: 'Page not found', meta: { timestamp: new Date().toISOString() } },
      { status: 404 }
    );
  }

  // Upsert presence record
  await prisma.pagePresence.upsert({
    where: {
      pageId_userId: { pageId, userId },
    },
    create: {
      pageId,
      userId,
      tenantId,
      lastHeartbeat: new Date(),
      isEditing: parsed.data.isEditing,
    },
    update: {
      lastHeartbeat: new Date(),
      isEditing: parsed.data.isEditing,
    },
  });

  return NextResponse.json({
    data: { success: true },
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

### API Endpoint: Get Presence

**File: `src/app/api/pages/[id]/presence/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/auth/withTenant';
import { prisma } from '@/lib/db';

export const GET = withTenant(async (req: NextRequest, { tenantId, userId, params }) => {
  const { id: pageId } = params;

  // Fetch active users (lastHeartbeat within 10 seconds)
  const cutoffTime = new Date(Date.now() - 10 * 1000); // 10 seconds ago

  const presenceRecords = await prisma.pagePresence.findMany({
    where: {
      pageId,
      tenantId,
      userId: { not: userId }, // Exclude current user
      lastHeartbeat: { gte: cutoffTime },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  const data = presenceRecords.map((record) => ({
    userId: record.userId,
    userName: record.user.name || record.user.email,
    userAvatar: null, // TODO: Add avatar URL if User model has it
    lastSeen: record.lastHeartbeat.toISOString(),
    isEditing: record.isEditing,
  }));

  return NextResponse.json({
    data,
    meta: { timestamp: new Date().toISOString() },
  });
});
```

---

### Presence Hook (Client)

**File: `src/hooks/usePresence.ts`**

```typescript
import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';

interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar: string | null;
  lastSeen: string;
  isEditing: boolean;
}

async function sendHeartbeat(pageId: string, isEditing: boolean) {
  await fetch(`/api/pages/${pageId}/presence/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isEditing }),
  });
}

async function fetchPresence(pageId: string): Promise<PresenceUser[]> {
  const res = await fetch(`/api/pages/${pageId}/presence`);
  if (!res.ok) throw new Error('Failed to fetch presence');
  const json = await res.json();
  return json.data;
}

export function usePresence(pageId: string, isEditing = false) {
  const { mutate: heartbeat } = useMutation({
    mutationFn: () => sendHeartbeat(pageId, isEditing),
  });

  const { data: activeUsers } = useQuery({
    queryKey: ['presence', pageId],
    queryFn: () => fetchPresence(pageId),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Send heartbeat every 5 seconds
  useEffect(() => {
    heartbeat(); // Send initial heartbeat
    const interval = setInterval(() => {
      heartbeat();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [pageId, isEditing, heartbeat]);

  return { activeUsers };
}
```

---

### Presence Indicators Component

**File: `src/components/page/PresenceIndicators.tsx`**

```typescript
'use client';

import { usePresence } from '@/hooks/usePresence';
import { Avatar } from '@/components/ui/Avatar';
import { Pencil } from 'lucide-react';

interface PresenceIndicatorsProps {
  pageId: string;
  isEditing?: boolean;
}

export function PresenceIndicators({ pageId, isEditing = false }: PresenceIndicatorsProps) {
  const { activeUsers } = usePresence(pageId, isEditing);

  if (!activeUsers || activeUsers.length === 0) return null;

  const visibleUsers = activeUsers.slice(0, 5);
  const overflowCount = Math.max(0, activeUsers.length - 5);
  const editingUsers = activeUsers.filter((u) => u.isEditing);

  return (
    <div className="flex items-center gap-2">
      {/* Avatar Stack */}
      <div className="flex -space-x-2">
        {visibleUsers.map((user) => (
          <div
            key={user.userId}
            className={`relative ${user.isEditing ? 'ring-2 ring-blue-500 animate-pulse' : ''}`}
            title={`${user.userName}${user.isEditing ? ' (editing)' : ' (viewing)'}`}
          >
            <Avatar name={user.userName} size="sm" />
            {user.isEditing && (
              <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-0.5">
                <Pencil className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>
        ))}
        {overflowCount > 0 && (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-xs text-[var(--color-text-secondary)]">
            +{overflowCount}
          </div>
        )}
      </div>

      {/* Editing Indicator */}
      {editingUsers.length > 0 && (
        <span className="text-xs text-[var(--color-text-secondary)]">
          {editingUsers[0].userName}{' '}
          {editingUsers.length > 1 && `and ${editingUsers.length - 1} other${editingUsers.length > 2 ? 's' : ''}`}{' '}
          editing
        </span>
      )}
    </div>
  );
}
```

---

### Usage in Page Header

**File: `src/app/(workspace)/pages/[id]/page.tsx`** (modify header)

```typescript
import { PresenceIndicators } from '@/components/page/PresenceIndicators';

// In page header JSX:
<div className="flex items-center gap-4">
  <PresenceIndicators pageId={page.id} isEditing={isCurrentlyEditing} />
  <ShareButton pageId={page.id} />
</div>
```

---

## Test Scenarios

### Unit Tests: `src/__tests__/hooks/usePresence.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePresence } from '@/hooks/usePresence';

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ mutate: vi.fn() }),
  useQuery: () => ({ data: [] }),
}));

describe('usePresence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should send heartbeat on mount', () => {
    const { result } = renderHook(() => usePresence('page-123'));
    expect(result.current).toBeDefined();
    // Heartbeat should be called immediately
  });

  it('should send heartbeat every 5 seconds', async () => {
    renderHook(() => usePresence('page-123'));
    vi.advanceTimersByTime(5000);
    // Expect heartbeat to be called again
  });
});
```

### Integration Tests: `src/__tests__/api/pages/presence/route.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '@/app/api/pages/[id]/presence/route';
import { prisma } from '@/lib/db';
import { mockAuthContext } from '@/test-utils/mockAuth';

describe('POST /api/pages/:id/presence/heartbeat', () => {
  it('should create presence record on first heartbeat', async () => {
    const { tenantId, userId } = mockAuthContext();
    const page = await prisma.page.create({
      data: { tenantId, title: 'Test Page' },
    });

    const req = new Request(`http://localhost/api/pages/${page.id}/presence/heartbeat`, {
      method: 'POST',
      body: JSON.stringify({ isEditing: false }),
    });

    const response = await POST(req, { tenantId, userId, params: { id: page.id } });
    expect(response.status).toBe(200);

    const presence = await prisma.pagePresence.findUnique({
      where: { pageId_userId: { pageId: page.id, userId } },
    });
    expect(presence).toBeTruthy();
  });
});

describe('GET /api/pages/:id/presence', () => {
  it('should return active users within 10s window', async () => {
    const { tenantId, userId } = mockAuthContext();
    const page = await prisma.page.create({
      data: { tenantId, title: 'Test Page' },
    });

    // Create active presence
    await prisma.pagePresence.create({
      data: {
        pageId: page.id,
        userId: 'other-user',
        tenantId,
        lastHeartbeat: new Date(), // Now
      },
    });

    const req = new Request(`http://localhost/api/pages/${page.id}/presence`);
    const response = await GET(req, { tenantId, userId, params: { id: page.id } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.length).toBe(1);
    expect(data.data[0].userId).toBe('other-user');
  });
});
```

### E2E Tests: `tests/e2e/presence.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Presence Indicators', () => {
  test('should show active users on shared page', async ({ page, context }) => {
    // User A opens page
    await page.goto('/pages/123');

    // User B opens same page (in new context)
    const page2 = await context.newPage();
    await page2.goto('/pages/123');

    // User A should see User B's avatar
    await expect(page.locator('[title*="viewing"]')).toBeVisible({ timeout: 10000 });
  });

  test('should show editing indicator', async ({ page }) => {
    await page.goto('/pages/123');

    // Start editing a block
    await page.click('[data-block-id]');
    await page.type('[contenteditable]', 'Editing...');

    // Editing indicator should appear for other users
    // (requires multi-user test setup)
  });
});
```

---

## Dependencies

- **SKB-17.2:** Sidebar team sections (presence only relevant for team pages)
- **SKB-17.3:** Page sharing (presence tracks users on shared pages)

---

## Dev Notes

### Heartbeat Interval

- **Client sends:** Every 5 seconds
- **Server considers active:** Within 10 seconds
- **Cleanup threshold:** 1 minute (old records deleted)

### Performance Optimization

- **Index on lastHeartbeat:** Enables fast queries for active users
- **Upsert instead of insert:** Prevents duplicate records per user
- **Lazy cleanup:** Filter out old records on query (no cron needed initially)

### Edge Cases

- **User closes tab:** Heartbeat stops, presence removed after 10s
- **User goes offline:** Heartbeat fails, presence auto-expires
- **Multiple tabs:** Same user in multiple tabs = single presence record (upsert by pageId + userId)

### Future Enhancements

- **WebSocket:** Replace polling with real-time updates (more efficient)
- **Cursor positions:** Show where each user is editing within the page
- **Activity log:** Track who viewed/edited over time (audit trail)

---

**Last Updated:** 2026-02-22
