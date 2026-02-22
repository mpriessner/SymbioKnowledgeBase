# Story SKB-16.3: Notification Triggers

**Epic:** Epic 16 - Inbox & Notifications
**Story ID:** SKB-16.3
**Story Points:** 8 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-16.1 (Notification model), EPIC-15 (Agent API for agent triggers)

---

## User Story

As a user, I want to automatically receive notifications when teammates update shared pages, mention me, or when agents create content, So that I stay informed of all relevant activity without manual checking.

---

## Acceptance Criteria

- [ ] **Page Update Trigger:**
  - When user saves page (`PUT /api/pages/:id/blocks`), find all collaborators (users in same tenant)
  - Create `PAGE_UPDATE` notification for each user (excluding the author)
  - Title: `"{user.name} updated {page.title}"`
  - Include `page_id` and `source_user_id`
- [ ] **Page Mention Trigger:**
  - Parse TipTap content for `@username` or `@user-id` mentions
  - Create `PAGE_MENTION` notification for mentioned user
  - Title: `"{user.name} mentioned you in {page.title}"`
  - Only trigger if mention is new (not already in previous version)
- [ ] **Agent Created Page Trigger:**
  - When Agent API creates page (`POST /api/agent/pages`), create `AGENT_CREATED` notification
  - Recipient: User who owns the API key
  - Title: `"Agent created {page.title}"`
  - Include `page_id`, no `source_user_id` (agent action)
- [ ] **Agent Updated Page Trigger:**
  - When Agent API updates page (`PUT /api/agent/pages/:id`), create `AGENT_CREATED` notification
  - Title: `"Agent updated {page.title}"`
- [ ] **System Notification (Admin Only):**
  - Admin endpoint: `POST /api/admin/notifications/broadcast`
  - Accepts: `{ title, body, type: 'SYSTEM' }`
  - Creates notification for all users in all tenants (or specific tenant)
  - Use case: Feature announcements, maintenance notices
- [ ] **Trigger Resilience:**
  - Notification failures logged but don't block primary operations
  - Use try/catch around notification creation
  - No duplicate notifications (check if similar notification already exists)
- [ ] **Performance:**
  - Notification creation doesn't add >50ms latency to page save
  - Batch create notifications if multiple users (use `createMany`)
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Notification Trigger Architecture
──────────────────────────────────

Trigger Points:
┌─────────────────────────────────────────────────────────────────────┐
│  1. Page Update Trigger                                              │
│                                                                       │
│     PUT /api/pages/:id/blocks                                        │
│       ↓                                                              │
│     Save TipTap content to database                                  │
│       ↓                                                              │
│     await triggerPageUpdateNotifications({                           │
│       pageId,                                                        │
│       tenantId,                                                      │
│       updatedBy: ctx.userId                                          │
│     });                                                              │
│       ↓                                                              │
│     // Find all users in tenant (excluding updater)                  │
│     const users = await prisma.user.findMany({                       │
│       where: { tenantId, id: { not: updatedBy } }                    │
│     });                                                              │
│       ↓                                                              │
│     // Create notifications                                          │
│     await prisma.notification.createMany({                           │
│       data: users.map(user => ({                                     │
│         userId: user.id,                                             │
│         type: 'PAGE_UPDATE',                                         │
│         title: `${updaterName} updated ${pageTitle}`,                │
│         pageId,                                                      │
│         sourceUserId: updatedBy                                      │
│       }))                                                            │
│     });                                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  2. Page Mention Trigger                                             │
│                                                                       │
│     TipTap editor content:                                           │
│       "Let's discuss this with @john and @sarah"                     │
│       ↓                                                              │
│     Extract mentions from content:                                   │
│       extractMentions(content) → ['@john', '@sarah']                 │
│       ↓                                                              │
│     Resolve usernames to user IDs:                                   │
│       const users = await prisma.user.findMany({                     │
│         where: {                                                     │
│           tenantId,                                                  │
│           name: { in: ['john', 'sarah'] }                            │
│         }                                                            │
│       });                                                            │
│       ↓                                                              │
│     Create PAGE_MENTION notifications:                               │
│       await prisma.notification.createMany({                         │
│         data: users.map(user => ({                                   │
│           userId: user.id,                                           │
│           type: 'PAGE_MENTION',                                      │
│           title: `${authorName} mentioned you in ${pageTitle}`,      │
│           pageId,                                                    │
│           sourceUserId: authorId                                     │
│         }))                                                          │
│       });                                                            │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  3. Agent Created/Updated Trigger                                    │
│                                                                       │
│     POST /api/agent/pages (from Agent API)                           │
│       ↓                                                              │
│     Create page in database                                          │
│       ↓                                                              │
│     await createNotification({                                       │
│       tenantId: ctx.tenantId,                                        │
│       userId: ctx.userId,  // API key owner                          │
│       type: 'AGENT_CREATED',                                         │
│       title: `Agent created ${page.title}`,                          │
│       pageId: page.id                                                │
│       // sourceUserId: null (agent action)                           │
│     });                                                              │
│                                                                       │
│     PUT /api/agent/pages/:id                                         │
│       ↓                                                              │
│     Update page content                                              │
│       ↓                                                              │
│     await createNotification({                                       │
│       type: 'AGENT_CREATED',                                         │
│       title: `Agent updated ${page.title}`,                          │
│       ...                                                            │
│     });                                                              │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  4. System Notification Broadcast                                    │
│                                                                       │
│     POST /api/admin/notifications/broadcast                          │
│     {                                                                │
│       title: "New feature: Agent API now available!",                │
│       body: "Check out the new Agent API at /api/agent",             │
│       tenantId?: "specific-tenant-id" // Optional                    │
│     }                                                                │
│       ↓                                                              │
│     // Get all users (in tenant or globally)                         │
│     const users = await prisma.user.findMany({                       │
│       where: tenantId ? { tenantId } : {}                            │
│     });                                                              │
│       ↓                                                              │
│     // Create SYSTEM notifications                                   │
│     await prisma.notification.createMany({                           │
│       data: users.map(user => ({                                     │
│         tenantId: user.tenantId,                                     │
│         userId: user.id,                                             │
│         type: 'SYSTEM',                                              │
│         title,                                                       │
│         body                                                         │
│       }))                                                            │
│     });                                                              │
└─────────────────────────────────────────────────────────────────────┘

Mention Detection:
┌─────────────────────────────────────────────────────────────────────┐
│  TipTap JSON with mention node:                                      │
│  {                                                                   │
│    type: 'doc',                                                      │
│    content: [                                                        │
│      {                                                               │
│        type: 'paragraph',                                            │
│        content: [                                                    │
│          { type: 'text', text: 'Let's discuss with ' },              │
│          {                                                           │
│            type: 'mention',                                          │
│            attrs: {                                                  │
│              id: 'user-123',       ← User ID                         │
│              label: '@john'        ← Display name                    │
│            }                                                         │
│          }                                                           │
│        ]                                                             │
│      }                                                               │
│    ]                                                                 │
│  }                                                                   │
│                                                                       │
│  Extract mentions:                                                   │
│    function extractMentions(doc: TipTapDocument): string[] {         │
│      const mentions: string[] = [];                                  │
│      traverse(doc, (node) => {                                       │
│        if (node.type === 'mention') {                                │
│          mentions.push(node.attrs.id);                               │
│        }                                                             │
│      });                                                             │
│      return mentions;                                                │
│    }                                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Trigger Utility Functions

**File: `src/lib/notifications/triggers.ts`**

```typescript
import { prisma } from '@/lib/db';
import type { TipTapDocument } from '@/lib/wikilinks/types';

/**
 * Trigger PAGE_UPDATE notifications when user updates a page
 */
export async function triggerPageUpdateNotifications(options: {
  pageId: string;
  tenantId: string;
  updatedBy: string;
}) {
  try {
    const page = await prisma.page.findUnique({
      where: { id: options.pageId },
      select: { title: true },
    });

    if (!page) return;

    const updater = await prisma.user.findUnique({
      where: { id: options.updatedBy },
      select: { name: true, email: true },
    });

    const updaterName = updater?.name || updater?.email || 'Someone';

    // Find all users in tenant (excluding the updater)
    const users = await prisma.user.findMany({
      where: {
        tenantId: options.tenantId,
        id: { not: options.updatedBy },
      },
      select: { id: true, tenantId: true },
    });

    if (users.length === 0) return;

    // Create notifications for all collaborators
    await prisma.notification.createMany({
      data: users.map(user => ({
        tenantId: user.tenantId,
        userId: user.id,
        type: 'PAGE_UPDATE',
        title: `${updaterName} updated "${page.title}"`,
        pageId: options.pageId,
        sourceUserId: options.updatedBy,
      })),
    });

    console.log(`Created ${users.length} PAGE_UPDATE notifications for page ${options.pageId}`);
  } catch (error) {
    console.error('Failed to trigger page update notifications:', error);
    // Don't throw — notification failures shouldn't block page saves
  }
}

/**
 * Extract user IDs from TipTap mention nodes
 */
function extractMentions(doc: TipTapDocument): string[] {
  const mentions: string[] = [];

  function traverse(node: any) {
    if (node.type === 'mention' && node.attrs?.id) {
      mentions.push(node.attrs.id);
    }
    if (node.content) {
      node.content.forEach(traverse);
    }
  }

  traverse(doc);
  return [...new Set(mentions)]; // Remove duplicates
}

/**
 * Trigger PAGE_MENTION notifications when user mentions someone
 */
export async function triggerPageMentionNotifications(options: {
  pageId: string;
  tenantId: string;
  content: TipTapDocument;
  authorId: string;
}) {
  try {
    const mentionedUserIds = extractMentions(options.content);

    if (mentionedUserIds.length === 0) return;

    const page = await prisma.page.findUnique({
      where: { id: options.pageId },
      select: { title: true },
    });

    const author = await prisma.user.findUnique({
      where: { id: options.authorId },
      select: { name: true, email: true },
    });

    const authorName = author?.name || author?.email || 'Someone';

    // Verify mentioned users exist in tenant
    const users = await prisma.user.findMany({
      where: {
        id: { in: mentionedUserIds },
        tenantId: options.tenantId,
      },
      select: { id: true, tenantId: true },
    });

    if (users.length === 0) return;

    // Create PAGE_MENTION notifications
    await prisma.notification.createMany({
      data: users.map(user => ({
        tenantId: user.tenantId,
        userId: user.id,
        type: 'PAGE_MENTION',
        title: `${authorName} mentioned you in "${page?.title}"`,
        pageId: options.pageId,
        sourceUserId: options.authorId,
      })),
    });

    console.log(`Created ${users.length} PAGE_MENTION notifications for page ${options.pageId}`);
  } catch (error) {
    console.error('Failed to trigger page mention notifications:', error);
  }
}

/**
 * Trigger AGENT_CREATED notification when agent creates/updates page
 */
export async function triggerAgentNotification(options: {
  pageId: string;
  tenantId: string;
  userId: string;
  action: 'created' | 'updated';
}) {
  try {
    const page = await prisma.page.findUnique({
      where: { id: options.pageId },
      select: { title: true },
    });

    if (!page) return;

    await prisma.notification.create({
      data: {
        tenantId: options.tenantId,
        userId: options.userId,
        type: 'AGENT_CREATED',
        title: `Agent ${options.action} "${page.title}"`,
        pageId: options.pageId,
        // sourceUserId: null (agent action)
      },
    });

    console.log(`Created AGENT_CREATED notification for page ${options.pageId}`);
  } catch (error) {
    console.error('Failed to trigger agent notification:', error);
  }
}
```

---

### Step 2: Integrate Triggers into Page API

**File: `src/app/api/pages/[id]/blocks/route.ts`** (modify existing PUT handler)

```typescript
import { triggerPageUpdateNotifications, triggerPageMentionNotifications } from '@/lib/notifications/triggers';

export const PUT = withTenant(
  async (req: NextRequest, ctx: TenantContext, routeContext: { params: Promise<Record<string, string>> }) => {
    const { id: pageId } = await routeContext.params;

    try {
      // ... existing validation and page verification ...

      const content = parsed.data.content as unknown as Prisma.InputJsonValue;

      // ... existing block upsert logic ...

      // Update wikilink page_links index
      await updatePageLinks(pageId, ctx.tenantId, [block.content as unknown as TipTapDocument]);

      // Update full-text search index
      await updateSearchIndex(block.id, block.content as unknown as TipTapDocument);

      // --- NEW: Trigger notifications ---

      // Trigger page update notifications (async, don't await)
      triggerPageUpdateNotifications({
        pageId,
        tenantId: ctx.tenantId,
        updatedBy: ctx.userId,
      });

      // Trigger page mention notifications
      triggerPageMentionNotifications({
        pageId,
        tenantId: ctx.tenantId,
        content: block.content as unknown as TipTapDocument,
        authorId: ctx.userId,
      });

      return successResponse(block);
    } catch (error) {
      console.error('Failed to save document:', error);
      return errorResponse('INTERNAL_ERROR', 'Failed to save document', undefined, 500);
    }
  }
);
```

---

### Step 3: Integrate Triggers into Agent API

**File: `src/app/api/agent/pages/route.ts`** (modify POST handler)

```typescript
import { triggerAgentNotification } from '@/lib/notifications/triggers';

export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      // ... existing page creation logic ...

      const page = await prisma.page.create({
        data: {
          tenantId: ctx.tenantId,
          title,
          icon,
          parentId: parent_id,
          position: nextPosition,
        },
      });

      // Create DOCUMENT block if markdown provided
      if (markdown) {
        const tiptap = markdownToTiptap(markdown);
        await prisma.block.create({
          data: {
            tenantId: ctx.tenantId,
            pageId: page.id,
            type: 'DOCUMENT',
            content: tiptap as any,
            position: 0,
          },
        });
      }

      // --- NEW: Trigger agent notification ---
      triggerAgentNotification({
        pageId: page.id,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'created',
      });

      return successResponse(
        { id: page.id, title: page.title, created_at: page.createdAt.toISOString() },
        undefined,
        201
      );
    } catch (error) {
      console.error('POST /api/agent/pages error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

**File: `src/app/api/agent/pages/[id]/route.ts`** (modify PUT handler)

```typescript
import { triggerAgentNotification } from '@/lib/notifications/triggers';

export const PUT = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: { params: Promise<Record<string, string>> }) => {
    try {
      // ... existing page update logic ...

      // Trigger updated_at on page
      const updatedPage = await prisma.page.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      // --- NEW: Trigger agent notification ---
      triggerAgentNotification({
        pageId: id,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
        action: 'updated',
      });

      return successResponse({
        id: updatedPage.id,
        updated_at: updatedPage.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error('PUT /api/agent/pages/:id error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

### Step 4: Create Admin Broadcast Endpoint

**File: `src/app/api/admin/notifications/broadcast/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { withTenant } from '@/lib/auth/withTenant';
import { successResponse, errorResponse } from '@/lib/apiResponse';
import { z } from 'zod';
import type { TenantContext } from '@/types/auth';

const broadcastSchema = z.object({
  title: z.string().min(1).max(255),
  body: z.string().optional(),
  tenantId: z.string().uuid().optional(), // If provided, only send to this tenant
});

export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      // Verify user is admin
      const user = await prisma.user.findUnique({
        where: { id: ctx.userId },
        select: { role: true },
      });

      if (user?.role !== 'ADMIN') {
        return errorResponse('FORBIDDEN', 'Admin access required', undefined, 403);
      }

      const body = await req.json();
      const parsed = broadcastSchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse('VALIDATION_ERROR', 'Invalid request body',
          parsed.error.flatten().fieldErrors, 400);
      }

      const { title, body: notificationBody, tenantId } = parsed.data;

      // Get all users (filtered by tenant if specified)
      const users = await prisma.user.findMany({
        where: tenantId ? { tenantId } : {},
        select: { id: true, tenantId: true },
      });

      if (users.length === 0) {
        return errorResponse('NOT_FOUND', 'No users found', undefined, 404);
      }

      // Create SYSTEM notifications for all users
      await prisma.notification.createMany({
        data: users.map(user => ({
          tenantId: user.tenantId,
          userId: user.id,
          type: 'SYSTEM',
          title,
          body: notificationBody,
        })),
      });

      return successResponse({
        sent_to: users.length,
        message: `Broadcast sent to ${users.length} users`,
      });
    } catch (error) {
      console.error('POST /api/admin/notifications/broadcast error:', error);
      return errorResponse('INTERNAL_ERROR', 'Internal server error', undefined, 500);
    }
  }
);
```

---

## Testing Requirements

### Unit Tests

**File: `src/__tests__/lib/notifications/triggers.test.ts`**

```typescript
import { triggerPageUpdateNotifications, triggerPageMentionNotifications } from '@/lib/notifications/triggers';
import { prisma } from '@/lib/db';

describe('Notification Triggers', () => {
  describe('triggerPageUpdateNotifications', () => {
    it('should create notifications for all users in tenant', async () => {
      await triggerPageUpdateNotifications({
        pageId: 'page-1',
        tenantId: 'tenant-1',
        updatedBy: 'user-1',
      });

      const notifications = await prisma.notification.findMany({
        where: { pageId: 'page-1', type: 'PAGE_UPDATE' },
      });

      expect(notifications.length).toBeGreaterThan(0);
      expect(notifications[0].sourceUserId).toBe('user-1');
    });

    it('should exclude the updater from notifications', async () => {
      await triggerPageUpdateNotifications({
        pageId: 'page-1',
        tenantId: 'tenant-1',
        updatedBy: 'user-1',
      });

      const updaterNotification = await prisma.notification.findFirst({
        where: { userId: 'user-1', pageId: 'page-1' },
      });

      expect(updaterNotification).toBeNull();
    });
  });

  describe('triggerPageMentionNotifications', () => {
    it('should create notifications for mentioned users', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'mention', attrs: { id: 'user-2' } },
            ],
          },
        ],
      };

      await triggerPageMentionNotifications({
        pageId: 'page-1',
        tenantId: 'tenant-1',
        content,
        authorId: 'user-1',
      });

      const notification = await prisma.notification.findFirst({
        where: { userId: 'user-2', type: 'PAGE_MENTION' },
      });

      expect(notification).toBeDefined();
      expect(notification?.sourceUserId).toBe('user-1');
    });
  });
});
```

---

### Integration Tests

```bash
# 1. Update page as User A
curl -X PUT http://localhost/api/pages/page-1/blocks \
  -H "Cookie: next-auth.session-token=user-a-token" \
  -d '{"content":{"type":"doc","content":[...]}}'

# 2. Check notifications for User B (same tenant)
curl http://localhost/api/notifications \
  -H "Cookie: next-auth.session-token=user-b-token"

# Expected: PAGE_UPDATE notification from User A

# 3. Create page via Agent API
curl -X POST http://localhost/api/agent/pages \
  -H "Authorization: Bearer skb_live_..." \
  -d '{"title":"Agent Page","markdown":"# Test"}'

# 4. Check notifications for API key owner
curl http://localhost/api/notifications \
  -H "Cookie: next-auth.session-token=owner-token"

# Expected: AGENT_CREATED notification

# 5. Broadcast system notification (as admin)
curl -X POST http://localhost/api/admin/notifications/broadcast \
  -H "Cookie: next-auth.session-token=admin-token" \
  -d '{"title":"Maintenance","body":"System update at 10pm"}'

# 6. Check all users' notifications
# Expected: All users see SYSTEM notification
```

---

### E2E Tests

**Multi-user collaboration test:**

1. User A creates page "Team Roadmap"
2. User B logs in → no notifications yet
3. User A updates "Team Roadmap"
4. User B refreshes → sees PAGE_UPDATE notification
5. User B clicks notification → navigates to "Team Roadmap"

**Mention test:**

1. User A edits page and types "@user-b"
2. User B sees PAGE_MENTION notification
3. Notification title includes User A's name and page title

**Agent test:**

1. Agent creates page via API with user's API key
2. User sees AGENT_CREATED notification
3. Agent updates same page
4. User sees second AGENT_CREATED notification (updated)

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/notifications/triggers.ts` |
| MODIFY | `src/app/api/pages/[id]/blocks/route.ts` |
| MODIFY | `src/app/api/agent/pages/route.ts` |
| MODIFY | `src/app/api/agent/pages/[id]/route.ts` |
| CREATE | `src/app/api/admin/notifications/broadcast/route.ts` |
| CREATE | `src/__tests__/lib/notifications/triggers.test.ts` |

---

## Dev Notes

### Trigger Resilience
- All notification creation wrapped in try/catch
- Failures logged but don't throw (primary operation must succeed)
- Use `createMany` for batch notifications (better performance)

### Duplicate Prevention
- Check for existing similar notification before creating
- Example: Don't create PAGE_UPDATE if user already has unread notification for same page from same author
- Use `findFirst` with `where` clause to check

### Performance Considerations
- Notification creation adds ~30ms to page save (acceptable)
- Use `createMany` instead of individual `create` calls
- Don't await notification triggers — fire and forget (but log errors)
- Indexes on `(tenant_id, user_id, read)` keep queries fast

### Mention Detection
- TipTap stores mentions as `{ type: 'mention', attrs: { id, label } }` nodes
- Extract all mention IDs from TipTap JSON
- Resolve IDs to users in current tenant
- Only create notifications for valid, existing users

### System Notifications
- Admin-only endpoint with role check
- Can broadcast to all tenants or specific tenant
- Use cases: feature announcements, maintenance windows, security alerts

### Future Enhancements (Post-MVP)
- Deduplicate notifications (if same page updated 3 times in 5 minutes, only 1 notification)
- Digest mode (group multiple updates into daily summary)
- Notification preferences (user can mute certain types)
- Mention autocomplete in TipTap editor (@-trigger)
- Notification webhooks (send to Slack, Discord, email)

---

**Last Updated:** 2026-02-22
