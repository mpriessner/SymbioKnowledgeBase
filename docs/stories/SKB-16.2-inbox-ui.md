# Story SKB-16.2: Inbox UI

**Epic:** Epic 16 - Inbox & Notifications
**Story ID:** SKB-16.2
**Story Points:** 8 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-16.1 (Notification API must exist)

---

## User Story

As a user, I want a visual inbox to see all my notifications grouped by date, So that I can quickly scan recent activity and navigate to relevant pages with one click.

---

## Acceptance Criteria

- [ ] **Inbox Page (`/inbox`):**
  - Route accessible from sidebar "Inbox" link
  - Page title: "Notifications"
  - "Mark all as read" button in header
  - Empty state when no notifications: "No notifications yet" with icon
- [ ] **Notification List:**
  - Grouped by date: "Today", "Yesterday", "This Week", "Older"
  - Each notification shows:
    - Icon (emoji based on type: 🤖 AGENT_CREATED, 📝 PAGE_MENTION, 🔔 PAGE_UPDATE, 🔔 SYSTEM)
    - Title (bold if unread, gray if read)
    - Relative timestamp ("2 hours ago", "3 days ago")
    - Blue background highlight if unread
  - Click notification → mark as read + navigate to linked page (if `page_id` exists)
  - Pagination: Load 50 notifications initially, "Load more" button at bottom
- [ ] **Sidebar Integration:**
  - "Inbox" link in main navigation
  - Unread badge count (red circle with number) next to Inbox link
  - Badge updates in real-time via polling (every 30s)
- [ ] **Real-Time Updates:**
  - Poll `/api/notifications/unread-count` every 30 seconds
  - Update badge count and notification list
  - Use `useEffect` hook with cleanup on unmount
- [ ] **Responsive Design:**
  - Mobile: Full-width notification list, tap to expand
  - Desktop: Centered content, max-width 800px
- [ ] **Accessibility:**
  - Semantic HTML (`<nav>`, `<main>`, `<button>`)
  - Keyboard navigation (Tab, Enter to activate)
  - ARIA labels for badge count ("3 unread notifications")
- [ ] TypeScript strict mode — no `any` types
- [ ] Loading states: Skeleton loaders for notifications while fetching

---

## Architecture Overview

```
Inbox UI Architecture
─────────────────────────

Page Structure:
┌─────────────────────────────────────────────────────────────────────┐
│  /inbox                                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Notifications                              [Mark all as read]  │ │
│  │  ──────────────────────────────────────────────────────────────│ │
│  │                                                                 │ │
│  │  Today                                                          │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ 🤖 Agent created "Meeting Notes 2026-02-22"             │  │ │
│  │  │    2 hours ago                                           │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ 📝 John mentioned you in "Project Roadmap"               │  │ │
│  │  │    5 hours ago                                           │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  Yesterday                                                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │ 🔔 Sarah updated "Research Notes"                        │  │ │
│  │  │    1 day ago                                             │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                                                                 │ │
│  │  [Load more...]                                                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Sidebar Integration:
┌─────────────────────────────────────────────────────────────────────┐
│  Sidebar                                                             │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  [🏠 Home]                                                      │ │
│  │  [🔍 Search]                                                    │ │
│  │  [📊 Graph View]                                                │ │
│  │  [📬 Inbox (3)]  ← Badge with unread count                     │ │
│  │  ─────────────                                                  │ │
│  │  Pages                                                          │ │
│  │    [📄 Page 1]                                                  │ │
│  │    [📄 Page 2]                                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘

Component Hierarchy:
┌─────────────────────────────────────────────────────────────────────┐
│  InboxPage (/inbox)                                                  │
│    ├─ useNotifications() hook                                        │
│    │    ├─ Fetch notifications on mount                             │
│    │    ├─ Poll unread count every 30s                              │
│    │    └─ Mark as read on click                                    │
│    │                                                                 │
│    ├─ NotificationList                                               │
│    │    ├─ groupByDate(notifications)                               │
│    │    ├─ DateGroup (Today, Yesterday, etc.)                       │
│    │    │    └─ NotificationItem (multiple)                         │
│    │    │         ├─ Icon                                           │
│    │    │         ├─ Title                                          │
│    │    │         ├─ Timestamp                                      │
│    │    │         └─ onClick handler                                │
│    │    └─ LoadMoreButton                                           │
│    │                                                                 │
│    └─ EmptyState (if no notifications)                              │
└─────────────────────────────────────────────────────────────────────┘

Real-Time Update Flow:
┌─────────────────────────────────────────────────────────────────────┐
│  1. Component mounts                                                 │
│     useEffect(() => {                                                │
│       // Initial fetch                                               │
│       fetchUnreadCount();                                            │
│                                                                       │
│       // Start polling                                               │
│       const interval = setInterval(() => {                           │
│         fetchUnreadCount();                                          │
│       }, 30000); // 30 seconds                                       │
│                                                                       │
│       // Cleanup on unmount                                          │
│       return () => clearInterval(interval);                          │
│     }, []);                                                          │
└─────────────────────────────────────────────────────────────────────┘

Styling States:
┌─────────────────────────────────────────────────────────────────────┐
│  Unread:                                                             │
│    bg-blue-50 dark:bg-blue-900/20                                    │
│    border-l-4 border-blue-500                                        │
│    font-semibold                                                     │
│                                                                       │
│  Read:                                                               │
│    bg-white dark:bg-gray-800                                         │
│    text-gray-600 dark:text-gray-400                                  │
│    font-normal                                                       │
│                                                                       │
│  Hover:                                                              │
│    cursor-pointer                                                    │
│    bg-gray-50 dark:bg-gray-700                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Inbox Page

**File: `src/app/inbox/page.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { NotificationList } from '@/components/inbox/NotificationList';
import { EmptyState } from '@/components/inbox/EmptyState';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  page_id?: string;
  source_user_name?: string;
  read: boolean;
  created_at: string;
}

export default function InboxPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const fetchNotifications = async (append = false) => {
    try {
      const response = await fetch(`/api/notifications?limit=50&offset=${append ? offset : 0}`);
      const data = await response.json();

      if (append) {
        setNotifications(prev => [...prev, ...data.data]);
      } else {
        setNotifications(data.data);
      }

      setHasMore(data.meta.total > (append ? offset : 0) + data.data.length);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAllAsRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.read) {
      try {
        await fetch(`/api/notifications/${notification.id}/read`, { method: 'PATCH' });
        setNotifications(prev =>
          prev.map(n => (n.id === notification.id ? { ...n, read: true } : n))
        );
      } catch (error) {
        console.error('Failed to mark as read:', error);
      }
    }

    // Navigate to page if linked
    if (notification.page_id) {
      router.push(`/${notification.page_id}`);
    }
  };

  const handleLoadMore = () => {
    setOffset(prev => prev + 50);
    fetchNotifications(true);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <Button variant="outline" onClick={handleMarkAllAsRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <NotificationList
            notifications={notifications}
            onNotificationClick={handleNotificationClick}
          />

          {hasMore && (
            <div className="mt-6 text-center">
              <Button variant="outline" onClick={handleLoadMore}>
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

---

### Step 2: Create Notification List Component

**File: `src/components/inbox/NotificationList.tsx`**

```typescript
import { NotificationItem } from './NotificationItem';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  page_id?: string;
  source_user_name?: string;
  read: boolean;
  created_at: string;
}

interface NotificationListProps {
  notifications: Notification[];
  onNotificationClick: (notification: Notification) => void;
}

function groupByDate(notifications: Notification[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, Notification[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  notifications.forEach(notification => {
    const date = new Date(notification.created_at);
    if (date >= today) {
      groups.Today.push(notification);
    } else if (date >= yesterday) {
      groups.Yesterday.push(notification);
    } else if (date >= weekAgo) {
      groups['This Week'].push(notification);
    } else {
      groups.Older.push(notification);
    }
  });

  return groups;
}

export function NotificationList({ notifications, onNotificationClick }: NotificationListProps) {
  const grouped = groupByDate(notifications);

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([label, items]) => {
        if (items.length === 0) return null;

        return (
          <div key={label}>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">
              {label}
            </h2>
            <div className="space-y-2">
              {items.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onClick={() => onNotificationClick(notification)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

---

### Step 3: Create Notification Item Component

**File: `src/components/inbox/NotificationItem.tsx`**

```typescript
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  created_at: string;
}

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
}

function getIcon(type: string): string {
  switch (type) {
    case 'PAGE_MENTION':
      return '📝';
    case 'PAGE_UPDATE':
      return '🔔';
    case 'AGENT_CREATED':
      return '🤖';
    case 'SYSTEM':
      return '🔔';
    default:
      return '📬';
  }
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const timestamp = formatDistanceToNow(new Date(notification.created_at), { addSuffix: true });

  return (
    <div
      onClick={onClick}
      className={`
        p-4 rounded-lg cursor-pointer transition-colors
        ${notification.read
          ? 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400'
          : 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 font-semibold'
        }
        hover:bg-gray-50 dark:hover:bg-gray-700
      `}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{getIcon(notification.type)}</div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${notification.read ? '' : 'font-semibold'}`}>
            {notification.title}
          </p>
          {notification.body && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notification.body}
            </p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {timestamp}
          </p>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 4: Create Empty State Component

**File: `src/components/inbox/EmptyState.tsx`**

```typescript
export function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="text-6xl mb-4">📬</div>
      <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
        No notifications yet
      </h2>
      <p className="text-gray-500 dark:text-gray-400">
        You'll see updates about page mentions, edits, and agent activity here.
      </p>
    </div>
  );
}
```

---

### Step 5: Add Sidebar Integration

**File: `src/components/Sidebar.tsx`** (modifications)

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll unread count every 30 seconds
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const response = await fetch('/api/notifications/unread-count');
        const data = await response.json();
        setUnreadCount(data.data.count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };

    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <aside className="w-64 bg-gray-100 dark:bg-gray-900 h-screen p-4">
      <nav className="space-y-2">
        <NavLink href="/" icon="🏠" label="Home" active={pathname === '/'} />
        <NavLink href="/search" icon="🔍" label="Search" active={pathname === '/search'} />
        <NavLink href="/graph" icon="📊" label="Graph View" active={pathname === '/graph'} />
        <NavLink
          href="/inbox"
          icon="📬"
          label="Inbox"
          active={pathname === '/inbox'}
          badge={unreadCount > 0 ? unreadCount : undefined}
        />

        <div className="border-t border-gray-300 dark:border-gray-700 my-4" />

        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Pages</h3>
        {/* Page tree goes here */}
      </nav>
    </aside>
  );
}

interface NavLinkProps {
  href: string;
  icon: string;
  label: string;
  active: boolean;
  badge?: number;
}

function NavLink({ href, icon, label, active, badge }: NavLinkProps) {
  return (
    <Link
      href={href}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg transition-colors
        ${active
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
          : 'hover:bg-gray-200 dark:hover:bg-gray-800'
        }
      `}
    >
      <span className="text-xl">{icon}</span>
      <span className="flex-1">{label}</span>
      {badge && (
        <span
          className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full"
          aria-label={`${badge} unread notifications`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}
```

---

## Testing Requirements

### Unit Tests

```typescript
import { groupByDate } from '@/components/inbox/NotificationList';

describe('groupByDate', () => {
  it('should group notifications by date', () => {
    const notifications = [
      { created_at: new Date().toISOString(), /* ... */ }, // Today
      { created_at: new Date(Date.now() - 86400000).toISOString(), /* ... */ }, // Yesterday
    ];

    const grouped = groupByDate(notifications);

    expect(grouped.Today).toHaveLength(1);
    expect(grouped.Yesterday).toHaveLength(1);
  });
});
```

---

### Integration Tests

```typescript
describe('InboxPage', () => {
  it('should render notification list', async () => {
    render(<InboxPage />);

    await waitFor(() => {
      expect(screen.getByText('Notifications')).toBeInTheDocument();
    });

    expect(screen.getByText('Today')).toBeInTheDocument();
    // Check for notification items
  });

  it('should mark notification as read on click', async () => {
    render(<InboxPage />);

    const notification = await screen.findByText(/Agent created/);
    fireEvent.click(notification);

    // Verify PATCH request sent
    expect(fetch).toHaveBeenCalledWith('/api/notifications/123/read', { method: 'PATCH' });
  });
});
```

---

### E2E Tests

**Manual test flow:**

1. Create test notification via API
2. Navigate to `/inbox`
3. Verify notification appears in "Today" section
4. Verify unread badge shows in sidebar (count: 1)
5. Click notification
6. Verify navigation to linked page
7. Return to `/inbox`
8. Verify notification now styled as read (gray, not bold)
9. Verify badge count decreased to 0

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/app/inbox/page.tsx` |
| CREATE | `src/components/inbox/NotificationList.tsx` |
| CREATE | `src/components/inbox/NotificationItem.tsx` |
| CREATE | `src/components/inbox/EmptyState.tsx` |
| MODIFY | `src/components/Sidebar.tsx` |
| CREATE | `src/__tests__/components/inbox/NotificationList.test.tsx` |

---

## Dev Notes

### Polling Strategy
- 30-second interval balances real-time feel with server load
- Use `setInterval` with cleanup in `useEffect` to prevent memory leaks
- Future: Replace with WebSocket or Server-Sent Events for instant updates

### Performance Optimization
- Pagination: Load 50 notifications initially, lazy-load more on scroll
- Optimistic UI: Mark as read immediately in local state before API call
- Memoize grouped notifications to avoid recalculating on every render

### Accessibility
- Use semantic HTML: `<nav>`, `<main>`, `<button>`
- Add ARIA labels to badge: `aria-label="3 unread notifications"`
- Keyboard navigation: Tab to focus, Enter to activate

### Styling Decisions
- Unread: Blue background + left border + bold text
- Read: White/gray background + normal text
- Hover: Subtle gray background change
- Dark mode support via Tailwind `dark:` classes

### Future Enhancements (Post-MVP)
- Filter by notification type (show only mentions, only agent actions, etc.)
- Notification sound/toast on new notification (when tab is active)
- Infinite scroll instead of "Load more" button
- Mark as unread action (reverse read status)
- Delete notification action

---

**Last Updated:** 2026-02-22
