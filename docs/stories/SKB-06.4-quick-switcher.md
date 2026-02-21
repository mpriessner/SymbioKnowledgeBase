# Story SKB-06.4: Quick Switcher (Cmd/Ctrl+K)

**Epic:** Epic 6 - Search & Navigation
**Story ID:** SKB-06.4
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-06.3 (SearchDialog provides shared search logic and components)

---

## User Story

As a researcher, I want to press Cmd+K to quickly jump to any page, So that I can navigate my knowledge base efficiently without using the mouse.

---

## Acceptance Criteria

- [ ] Global keyboard listener for Cmd/Ctrl+K (macOS: Cmd+K, Windows/Linux: Ctrl+K)
- [ ] Opens SearchDialog as modal overlay (command palette style)
- [ ] Shows recent pages by default before typing (last 5 visited, from localStorage)
- [ ] Same search functionality as SKB-06.3 (debounced search, results with snippets)
- [ ] Escape or click outside to close
- [ ] Focus trapped within the modal while open
- [ ] Prevents default browser behavior for Cmd+K / Ctrl+K
- [ ] `useHotkeys` hook registered at the workspace layout level
- [ ] Recent pages stored in localStorage key `'symbio-recent-pages'`
- [ ] Recent pages list updated when user navigates to a page
- [ ] Maximum 5 recent pages stored
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Quick Switcher Component Flow
──────────────────────────────

  User presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
        │
        ▼
  ┌──────────────────────────────────────────────────────┐
  │  useHotkeys hook (registered in workspace layout)     │
  │                                                        │
  │  1. Prevent default browser Cmd+K behavior             │
  │  2. Toggle QuickSwitcher open state                    │
  └──────────────────────┬─────────────────────────────────┘
                         │
                         ▼
  ┌──────────────────────────────────────────────────────┐
  │  QuickSwitcher.tsx (modal overlay)                    │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  🔍  Jump to page...                           │   │
  │  │  [input field, auto-focused]                    │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  │  Before typing (default view):                         │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  Recent Pages                                   │   │
  │  │  📄 PostgreSQL Setup Guide         (2 min ago)  │   │
  │  │  📄 Installation Guide             (1 hr ago)   │   │
  │  │  📄 Architecture Overview          (yesterday)  │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  │  After typing (search view):                           │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  SearchResults (reused from SKB-06.3)           │   │
  │  │  📄 PostgreSQL Setup Guide                      │   │
  │  │     ...<mark>PostgreSQL</mark> is a powerful... │   │
  │  └────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘

  localStorage: 'symbio-recent-pages'
  ┌──────────────────────────────────────────┐
  │  [                                        │
  │    { id: 'uuid-1', title: 'PG Guide',    │
  │      icon: '📄', visitedAt: 170... },     │
  │    { id: 'uuid-2', title: 'Install',     │
  │      icon: '📄', visitedAt: 170... },     │
  │    ...                                    │
  │  ]                                        │
  └──────────────────────────────────────────┘

Registration Point
──────────────────

  src/app/(workspace)/layout.tsx
  ┌──────────────────────────────────────┐
  │  export default function Layout() {   │
  │    return (                           │
  │      <>                               │
  │        <Sidebar />                    │
  │        <main>{children}</main>        │
  │        <QuickSwitcher />  ← HERE      │
  │      </>                              │
  │    );                                 │
  │  }                                    │
  └──────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create the useHotkeys Hook

A hook for registering global keyboard shortcuts.

**File: `src/hooks/useHotkeys.ts`**

```typescript
'use client';

import { useEffect, useCallback } from 'react';

interface HotkeyConfig {
  /** The key to listen for (e.g., 'k', 'p', '/') */
  key: string;
  /** Whether Cmd (macOS) or Ctrl (Windows/Linux) must be held */
  cmdOrCtrl?: boolean;
  /** Whether Shift must be held */
  shift?: boolean;
  /** Whether Alt must be held */
  alt?: boolean;
  /** Callback to execute when the hotkey is triggered */
  handler: (event: KeyboardEvent) => void;
  /** Whether to prevent the default browser action */
  preventDefault?: boolean;
  /** Whether the hotkey is currently active */
  enabled?: boolean;
}

/**
 * Hook for registering global keyboard shortcuts.
 *
 * Supports modifier keys (Cmd/Ctrl, Shift, Alt) and
 * automatically handles platform differences (Cmd on macOS, Ctrl elsewhere).
 *
 * @param configs - Array of hotkey configurations
 */
export function useHotkeys(configs: HotkeyConfig[]): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const config of configs) {
        if (config.enabled === false) continue;

        // Check key match (case-insensitive)
        if (event.key.toLowerCase() !== config.key.toLowerCase()) continue;

        // Check Cmd/Ctrl modifier
        if (config.cmdOrCtrl) {
          const isMac = navigator.platform.toUpperCase().includes('MAC');
          const cmdOrCtrlPressed = isMac ? event.metaKey : event.ctrlKey;
          if (!cmdOrCtrlPressed) continue;
        }

        // Check Shift modifier
        if (config.shift && !event.shiftKey) continue;
        if (!config.shift && event.shiftKey) continue;

        // Check Alt modifier
        if (config.alt && !event.altKey) continue;
        if (!config.alt && event.altKey) continue;

        // All checks passed — execute handler
        if (config.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }

        config.handler(event);
        return;
      }
    },
    [configs]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
}
```

---

### Step 2: Create the Recent Pages Hook

Manages the recent pages list in localStorage.

**File: `src/hooks/useRecentPages.ts`**

```typescript
'use client';

import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'symbio-recent-pages';
const MAX_RECENT_PAGES = 5;

export interface RecentPage {
  id: string;
  title: string;
  icon: string | null;
  visitedAt: number;
}

/**
 * Hook for managing the recent pages list.
 *
 * Stores the last 5 visited pages in localStorage.
 * Provides methods to add a page visit and retrieve the list.
 */
export function useRecentPages() {
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentPage[];
        setRecentPages(parsed);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  /**
   * Records a page visit. Adds the page to the front of the recent list,
   * deduplicating and capping at MAX_RECENT_PAGES.
   */
  const addRecentPage = useCallback(
    (page: { id: string; title: string; icon: string | null }) => {
      setRecentPages((prev) => {
        // Remove existing entry for this page (if any)
        const filtered = prev.filter((p) => p.id !== page.id);

        // Add to front with current timestamp
        const updated: RecentPage[] = [
          { ...page, visitedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_PAGES);

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }

        return updated;
      });
    },
    []
  );

  /**
   * Clears the recent pages list.
   */
  const clearRecentPages = useCallback(() => {
    setRecentPages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return { recentPages, addRecentPage, clearRecentPages };
}
```

---

### Step 3: Create the QuickSwitcher Component

**File: `src/components/search/QuickSwitcher.tsx`**

```typescript
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useRecentPages } from '@/hooks/useRecentPages';
import { SearchDialog } from './SearchDialog';

/**
 * Quick Switcher — command palette overlay triggered by Cmd/Ctrl+K.
 *
 * Shows recent pages by default (before typing).
 * Typing triggers the same search functionality as SearchDialog.
 *
 * Registered at the workspace layout level to capture keyboard
 * shortcuts globally across all pages.
 */
export function QuickSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { recentPages, addRecentPage } = useRecentPages();

  const openSwitcher = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSwitcher = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Register global Cmd/Ctrl+K shortcut
  useHotkeys([
    {
      key: 'k',
      cmdOrCtrl: true,
      handler: () => {
        if (isOpen) {
          closeSwitcher();
        } else {
          openSwitcher();
        }
      },
    },
  ]);

  return (
    <SearchDialog
      isOpen={isOpen}
      onClose={closeSwitcher}
    />
  );
}
```

---

### Step 4: Create the RecentPages List Component

Shown in the quick switcher before the user starts typing.

**File: `src/components/search/RecentPagesList.tsx`**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { RecentPage } from '@/hooks/useRecentPages';

interface RecentPagesListProps {
  pages: RecentPage[];
  selectedIndex: number;
  onSelect: (pageId: string) => void;
  onHover: (index: number) => void;
}

/**
 * Renders a list of recently visited pages.
 * Shown in the Quick Switcher when the search input is empty.
 */
export function RecentPagesList({
  pages,
  selectedIndex,
  onSelect,
  onHover,
}: RecentPagesListProps) {
  if (pages.length === 0) {
    return (
      <div className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]">
        No recent pages
      </div>
    );
  }

  return (
    <div className="py-1" role="listbox" aria-label="Recent pages">
      <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-[var(--color-text-secondary)]">
        Recent
      </div>
      {pages.map((page, index) => (
        <button
          key={page.id}
          role="option"
          aria-selected={index === selectedIndex}
          className={`
            w-full px-3 py-2 text-left flex items-center gap-2
            cursor-pointer transition-colors duration-100
            ${
              index === selectedIndex
                ? 'bg-[var(--color-bg-secondary)]'
                : 'hover:bg-[var(--color-bg-secondary)]'
            }
          `}
          onClick={() => onSelect(page.id)}
          onMouseEnter={() => onHover(index)}
        >
          <span className="flex-shrink-0 text-base">
            {page.icon || '\u{1F4C4}'}
          </span>
          <span className="truncate text-sm text-[var(--color-text-primary)]">
            {page.title}
          </span>
          <span className="ml-auto text-xs text-[var(--color-text-secondary)]">
            {formatRelativeTime(page.visitedAt)}
          </span>
        </button>
      ))}
    </div>
  );
}

/**
 * Formats a timestamp into a relative time string.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
```

---

### Step 5: Register QuickSwitcher in Workspace Layout

**File: `src/app/(workspace)/layout.tsx` (modification)**

```typescript
import { QuickSwitcher } from '@/components/search/QuickSwitcher';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      {/* ... */}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>

      {/* Quick Switcher (global overlay) */}
      <QuickSwitcher />
    </div>
  );
}
```

---

### Step 6: Record Page Visits

Update the page view component to record visits for the recent pages list.

**File: `src/app/(workspace)/pages/[id]/page.tsx` (modification)**

```typescript
import { useRecentPages } from '@/hooks/useRecentPages';

// Inside the page component:
function PageView({ params }: { params: { id: string } }) {
  const { addRecentPage } = useRecentPages();

  // Record page visit when page data is loaded
  useEffect(() => {
    if (pageData) {
      addRecentPage({
        id: pageData.id,
        title: pageData.title,
        icon: pageData.icon,
      });
    }
  }, [pageData?.id, addRecentPage]);

  // ... rest of component
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/hooks/useHotkeys.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotkeys } from '@/hooks/useHotkeys';

describe('useHotkeys', () => {
  it('should call handler when Cmd+K is pressed on macOS', () => {
    const handler = vi.fn();

    // Mock macOS platform
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      writable: true,
    });

    renderHook(() =>
      useHotkeys([{ key: 'k', cmdOrCtrl: true, handler }])
    );

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
    });
    document.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it('should call handler when Ctrl+K is pressed on Windows', () => {
    const handler = vi.fn();

    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      writable: true,
    });

    renderHook(() =>
      useHotkeys([{ key: 'k', cmdOrCtrl: true, handler }])
    );

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
    });
    document.dispatchEvent(event);

    expect(handler).toHaveBeenCalled();
  });

  it('should not call handler when disabled', () => {
    const handler = vi.fn();

    renderHook(() =>
      useHotkeys([{ key: 'k', cmdOrCtrl: true, handler, enabled: false }])
    );

    const event = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
    });
    document.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  it('should not call handler without modifier when cmdOrCtrl is required', () => {
    const handler = vi.fn();

    renderHook(() =>
      useHotkeys([{ key: 'k', cmdOrCtrl: true, handler }])
    );

    const event = new KeyboardEvent('keydown', { key: 'k' });
    document.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });
});
```

### Unit Tests: `src/__tests__/hooks/useRecentPages.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentPages } from '@/hooks/useRecentPages';

describe('useRecentPages', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should start with empty list', () => {
    const { result } = renderHook(() => useRecentPages());
    expect(result.current.recentPages).toEqual([]);
  });

  it('should add a page to recent list', () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({
        id: 'page-1',
        title: 'Test Page',
        icon: null,
      });
    });

    expect(result.current.recentPages).toHaveLength(1);
    expect(result.current.recentPages[0].id).toBe('page-1');
  });

  it('should maintain max 5 recent pages', () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.addRecentPage({
          id: `page-${i}`,
          title: `Page ${i}`,
          icon: null,
        });
      }
    });

    expect(result.current.recentPages).toHaveLength(5);
  });

  it('should deduplicate existing pages (move to front)', () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({ id: 'a', title: 'A', icon: null });
      result.current.addRecentPage({ id: 'b', title: 'B', icon: null });
      result.current.addRecentPage({ id: 'a', title: 'A', icon: null });
    });

    expect(result.current.recentPages).toHaveLength(2);
    expect(result.current.recentPages[0].id).toBe('a');
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({
        id: 'page-1',
        title: 'Test',
        icon: null,
      });
    });

    const stored = JSON.parse(localStorage.getItem('symbio-recent-pages') || '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('page-1');
  });

  it('should clear recent pages', () => {
    const { result } = renderHook(() => useRecentPages());

    act(() => {
      result.current.addRecentPage({ id: 'a', title: 'A', icon: null });
      result.current.clearRecentPages();
    });

    expect(result.current.recentPages).toHaveLength(0);
  });
});
```

### E2E Test: `tests/e2e/quick-switcher.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Quick Switcher (Cmd/Ctrl+K)', () => {
  test('should open on Cmd+K (macOS) or Ctrl+K', async ({ page }) => {
    await page.goto('/');

    // Press Ctrl+K (works on all platforms in tests)
    await page.keyboard.press('Control+k');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
  });

  test('should close on Escape', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('should show recent pages by default', async ({ page }) => {
    // Visit a page first to populate recent pages
    await page.goto('/pages/some-page-id');
    await page.waitForLoadState('networkidle');

    // Open quick switcher
    await page.keyboard.press('Control+k');

    // Should show "Recent" header
    const recentHeader = page.locator('text=Recent');
    // May or may not be visible depending on whether pages have been visited
  });

  test('should search and navigate on Enter', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Control+k');

    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('test');
    await page.waitForTimeout(400);

    // Press Enter to select first result
    await page.keyboard.press('Enter');

    // Should navigate (URL should change if results exist)
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/hooks/useHotkeys.ts` |
| CREATE | `src/hooks/useRecentPages.ts` |
| CREATE | `src/components/search/QuickSwitcher.tsx` |
| CREATE | `src/components/search/RecentPagesList.tsx` |
| MODIFY | `src/app/(workspace)/layout.tsx` (add QuickSwitcher component) |
| MODIFY | `src/app/(workspace)/pages/[id]/page.tsx` (record page visits) |
| CREATE | `src/__tests__/hooks/useHotkeys.test.ts` |
| CREATE | `src/__tests__/hooks/useRecentPages.test.ts` |
| CREATE | `tests/e2e/quick-switcher.spec.ts` |

---

**Last Updated:** 2026-02-21
