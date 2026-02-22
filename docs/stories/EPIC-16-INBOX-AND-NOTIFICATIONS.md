# Epic 16: Inbox & Notifications

**Epic ID:** EPIC-16
**Created:** 2026-02-22
**Total Story Points:** 21
**Priority:** Medium
**Status:** Planned

---

## Epic Overview

Epic 16 delivers an inbox system for notifications between workspace members and from AI agents. Users receive notifications for page mentions, page updates by collaborators, agent-created content, and system announcements. The inbox provides a centralized location to track all activity relevant to the user.

This epic enables collaboration awareness and agent transparency — users know when agents create/modify content on their behalf, and team members stay informed of each other's work.

---

## Business Value

- **Collaboration Awareness:** Users see when teammates update shared pages or mention them in documents
- **Agent Transparency:** Users are notified when AI agents create or modify pages, maintaining human oversight
- **Reduced Context Switching:** Centralized notification inbox eliminates need to check email or Slack for knowledge base updates
- **@-Mention Support:** Direct user tagging in pages (`@username`) creates notifications, enabling async collaboration
- **System Communication:** Admins can broadcast feature announcements or maintenance notices

---

## Architecture Summary

```
┌────────────────────────────────────────────────────────────────────┐
│                     Inbox & Notifications Architecture              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Notification Triggers                                          ││
│  │                                                                 ││
│  │  1. Page Mention:                                               ││
│  │     User types @username in editor                              ││
│  │     → createNotification(PAGE_MENTION, targetUserId, pageId)    ││
│  │                                                                 ││
│  │  2. Page Update (by collaborator):                              ││
│  │     User saves page → get all users with access                 ││
│  │     → createNotification(PAGE_UPDATE, each userId, pageId)      ││
│  │                                                                 ││
│  │  3. Agent Created Page:                                          ││
│  │     Agent API POST /pages                                        ││
│  │     → createNotification(AGENT_CREATED, userId, pageId)         ││
│  │                                                                 ││
│  │  4. System Notification:                                         ││
│  │     Admin sends broadcast                                        ││
│  │     → createNotification(SYSTEM, all userIds)                   ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Database Schema                                                ││
│  │                                                                 ││
│  │  model Notification {                                           ││
│  │    id           String   @id @default(uuid())                   ││
│  │    tenantId     String                                          ││
│  │    userId       String   // Recipient                           ││
│  │    type         NotificationType                                ││
│  │    title        String   // "John updated Project Roadmap"      ││
│  │    body         String?  // Optional detail text                ││
│  │    pageId       String?  // Link to relevant page               ││
│  │    sourceUserId String?  // Who triggered it                    ││
│  │    read         Boolean  @default(false)                        ││
│  │    createdAt    DateTime @default(now())                        ││
│  │  }                                                              ││
│  │                                                                 ││
│  │  enum NotificationType {                                        ││
│  │    PAGE_MENTION    // @-mentioned in a page                     ││
│  │    PAGE_UPDATE     // Collaborator updated shared page          ││
│  │    AGENT_CREATED   // Agent created/updated content             ││
│  │    SYSTEM          // Admin announcement                        ││
│  │  }                                                              ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Inbox UI (/inbox)                                              ││
│  │                                                                 ││
│  │  Sidebar:                                                       ││
│  │    [🏠 Home] [🔍 Search] [📊 Graph]                             ││
│  │    [📬 Inbox (3)] ← Badge shows unread count                    ││
│  │                                                                 ││
│  │  Inbox Page:                                                    ││
│  │  ┌──────────────────────────────────────────────────────────┐  ││
│  │  │  Notifications                    [Mark all as read]      │  ││
│  │  │                                                            │  ││
│  │  │  Today                                                     │  ││
│  │  │  ┌────────────────────────────────────────────────────┐   │  ││
│  │  │  │ 🤖 Agent created "Meeting Notes 2026-02-22"        │   │  ││
│  │  │  │    2 hours ago                                      │   │  ││
│  │  │  └────────────────────────────────────────────────────┘   │  ││
│  │  │                                                            │  ││
│  │  │  ┌────────────────────────────────────────────────────┐   │  ││
│  │  │  │ 📝 John mentioned you in "Project Roadmap"         │   │  ││
│  │  │  │    5 hours ago                                      │   │  ││
│  │  │  └────────────────────────────────────────────────────┘   │  ││
│  │  │                                                            │  ││
│  │  │  Yesterday                                                 │  ││
│  │  │  ┌────────────────────────────────────────────────────┐   │  ││
│  │  │  │ 🔔 System: New feature - Agent API now available   │   │  ││
│  │  │  │    1 day ago                                        │   │  ││
│  │  │  └────────────────────────────────────────────────────┘   │  ││
│  │  │                                                            │  ││
│  │  │  (Older read notifications shown with dimmed style)       │  ││
│  │  └──────────────────────────────────────────────────────────┘  ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │  Real-Time Updates                                              ││
│  │                                                                 ││
│  │  Polling Strategy (MVP):                                        ││
│  │    setInterval(() => {                                          ││
│  │      fetch('/api/notifications/unread-count')                   ││
│  │        .then(updateBadge);                                      ││
│  │    }, 30000); // Every 30 seconds                               ││
│  │                                                                 ││
│  │  Future Enhancement:                                            ││
│  │    WebSocket or SSE for instant notifications                   ││
│  └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-16.1: Notification Data Model — 5 points, High

**Delivers:** Prisma schema for `Notification` model with fields: `id`, `tenant_id`, `user_id`, `type`, `title`, `body`, `page_id`, `source_user_id`, `read`, `created_at`. `NotificationType` enum: `PAGE_MENTION`, `PAGE_UPDATE`, `AGENT_CREATED`, `SYSTEM`. API routes:
- `GET /api/notifications` — list user's notifications with pagination and filtering
- `GET /api/notifications/unread-count` — get unread count for badge
- `PATCH /api/notifications/:id/read` — mark single notification as read
- `POST /api/notifications/read-all` — mark all user's notifications as read

All queries scoped by `tenant_id` and `user_id`. Indexes on `(tenant_id, user_id, created_at)` and `(tenant_id, user_id, read)`.

**Depends on:** None (foundational story)

---

### SKB-16.2: Inbox UI — 8 points, High

**Delivers:** Inbox page at `/inbox` with notification list grouped by date (Today, Yesterday, This Week, Older). Each notification shows: icon (based on type), title, timestamp (relative format: "2 hours ago"), and click-to-navigate to referenced page. Mark as read on click. "Mark all as read" button. Empty state when no notifications. Sidebar "Inbox" nav link with unread badge count. Real-time updates via polling every 30s (fetches unread count and updates badge). Unread notifications styled with bold text and blue background, read notifications dimmed with gray text.

**Depends on:** SKB-16.1 (notification API must exist)

---

### SKB-16.3: Notification Triggers — 8 points, Medium

**Delivers:** Auto-create notifications when:
1. **Page Updated by Collaborator:** When user saves page, find all other users with access to that page (same `tenant_id`), create `PAGE_UPDATE` notification for each with title "{user.name} updated {page.title}"
2. **User Mentioned:** Detect `@username` or `@user-id` in TipTap editor content, create `PAGE_MENTION` notification for mentioned user with title "{user.name} mentioned you in {page.title}"
3. **Agent Created/Updated Page:** In Agent API `POST /api/agent/pages` and `PUT /api/agent/pages/:id`, create `AGENT_CREATED` notification for page owner with title "Agent created {page.title}" or "Agent updated {page.title}"
4. **System Notification:** Admin API endpoint `POST /api/admin/notifications/broadcast` to send `SYSTEM` notification to all users in tenant

Trigger logic implemented in API route handlers (`/api/pages/:id/blocks`, `/api/agent/pages`, etc.). Utility function `createNotification(type, userId, pageId?, sourceUserId?)` in `src/lib/notifications/create.ts`.

**Depends on:** SKB-16.1 (notification model must exist), EPIC-15 (Agent API must exist for agent triggers)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 16.1 | Notification model validation; API response format | Create notification, fetch via API, mark as read | Full notification lifecycle via UI and API |
| 16.2 | UI component rendering; badge count calculation | Navigate to /inbox, see notifications, mark as read | User receives notification, clicks, navigates to page |
| 16.3 | Trigger functions called with correct args | Update page → notification created; mention user → notification created | Two users: User A mentions User B, User B sees notification in inbox |

---

## Implementation Order

```
16.1 → 16.2 → 16.3

┌────────┐     ┌────────┐     ┌────────┐
│ 16.1   │────▶│ 16.2   │────▶│ 16.3   │
│ Data   │     │ Inbox  │     │ Triggers│
│ Model  │     │ UI     │     │        │
└────────┘     └────────┘     └────────┘

16.1: Foundation (database schema, API routes)
16.2: User-facing feature (inbox page, badge)
16.3: Automation (notification creation on events)
```

---

## Shared Constraints

- **Multi-Tenant Isolation:** All notifications scoped by `tenant_id` — users only see notifications within their tenant
- **Performance:** Unread count query must be fast (<50ms) — use database index on `(tenant_id, user_id, read)`
- **Privacy:** Users can only see notifications meant for them (`user_id` matches session user)
- **Notification Retention:** Auto-delete read notifications older than 90 days (background cron job)
- **Polling Rate:** 30-second interval for real-time updates (avoid overwhelming server)
- **TypeScript Strict Mode:** No `any` types allowed
- **Error Handling:** Failed notification creation should not block primary operation (log error, continue)

---

## Files Created/Modified by This Epic

### New Files
- `src/app/inbox/page.tsx` — Inbox UI page
- `src/components/inbox/NotificationList.tsx` — Notification list component
- `src/components/inbox/NotificationItem.tsx` — Single notification component
- `src/app/api/notifications/route.ts` — GET (list notifications)
- `src/app/api/notifications/unread-count/route.ts` — GET (unread count)
- `src/app/api/notifications/[id]/read/route.ts` — PATCH (mark as read)
- `src/app/api/notifications/read-all/route.ts` — POST (mark all as read)
- `src/lib/notifications/create.ts` — Utility to create notifications
- `src/lib/notifications/triggers.ts` — Trigger logic for various events
- `src/__tests__/api/notifications/route.test.ts`
- `src/__tests__/lib/notifications/create.test.ts`

### Modified Files
- `prisma/schema.prisma` — Add `Notification` model and `NotificationType` enum
- `src/components/Sidebar.tsx` — Add Inbox link with unread badge
- `src/app/api/pages/[id]/blocks/route.ts` — Add trigger for `PAGE_UPDATE` notification
- `src/app/api/agent/pages/route.ts` — Add trigger for `AGENT_CREATED` notification
- `src/app/layout.tsx` — Add polling hook for unread count

---

## Database Schema Changes

```prisma
enum NotificationType {
  PAGE_MENTION
  PAGE_UPDATE
  AGENT_CREATED
  SYSTEM
}

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

// Update User model to add notification relations
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

---

**Last Updated:** 2026-02-22
