# Story SKB-11.1: Sidebar Restructure

**Epic:** Epic 11 - Sidebar Restructure & Home Page Dashboard
**Story ID:** SKB-11.1
**Story Points:** 8 | **Priority:** High | **Status:** Done
**Depends On:** SKB-09.1 (CSS custom properties), SKB-11.2 (WorkspaceDropdown component)

---

## User Story

As a user, I want a Notion-style sidebar with clear sections for navigation, recent pages, and my page tree, So that I can quickly access my workspace and find pages efficiently.

---

## Acceptance Criteria

1. **Workspace Header Section (Fixed at Top)**
   - [ ] `<WorkspaceDropdown>` component showing workspace name with settings/logout menu
   - [ ] Collapse sidebar button (chevron icon) that calls `useSidebarCollapse().toggle()`
   - [ ] Creation dropdown button (+ icon) with menu containing: Page, Database, AI Meeting Notes
   - [ ] Creation menu closes on outside click (ref-based `mousedown` listener)
   - [ ] Creation menu positioned absolutely with shadow and border

2. **Top Navigation Section (Fixed Below Header)**
   - [ ] Search bar button showing "Search" text and keyboard shortcut (⌘K on Mac, Ctrl+K on others)
   - [ ] Search button dispatches synthetic `KeyboardEvent` to trigger global QuickSwitcher
   - [ ] Home link with house icon, navigates to `/home`
   - [ ] Graph link with graph icon, navigates to `/graph`
   - [ ] Active link highlighting via `usePathname()`: `bg-[var(--sidebar-active)]` and `font-medium`
   - [ ] Inactive links: `text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]`

3. **Recents Section (Scrollable)**
   - [ ] Section label: "RECENTS" (uppercase, small, semibold, secondary color)
   - [ ] Display up to 5 pages from `useRecentPages()` hook
   - [ ] Each item shows emoji icon, title, truncated with ellipsis
   - [ ] Click item navigates to `/pages/{id}`
   - [ ] Hover state: `hover:bg-[var(--sidebar-hover)]`
   - [ ] Only render section if `recentPages.length > 0`

4. **Private Section (Scrollable)**
   - [ ] Section label: "PRIVATE" (uppercase, small, semibold, secondary color)
   - [ ] Contains existing `<DndSidebarTree>` component with full DnD functionality
   - [ ] Tree renders below label with no additional styling changes

5. **Settings Footer (Fixed at Bottom)**
   - [ ] Settings button with gear icon and "Settings" text
   - [ ] Click opens `<SettingsModal>` via state: `setIsSettingsOpen(true)`
   - [ ] Border top: `border-t border-[var(--border-default)]`
   - [ ] Hover state: `hover:text-[var(--sidebar-text)]`

6. **Hydration Fix**
   - [ ] Platform detection (`isMac` state) uses `useEffect` instead of inline `navigator.platform`
   - [ ] Prevents "Text content did not match" hydration warnings
   - [ ] Initial state: `false`, set to actual value after mount

7. **Fragment Wrapper**
   - [ ] Sidebar and SettingsModal wrapped in `<>...</>` Fragment
   - [ ] Allows SettingsModal portal to render at document.body level

8. **TypeScript**
   - [ ] All types explicitly defined
   - [ ] No `any` types
   - [ ] Event handlers properly typed

---

## Technical Implementation Notes

### File: `src/components/workspace/Sidebar.tsx` (modification)

**Imports:**
```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { DndSidebarTree } from "@/components/workspace/DndSidebarTree";
import { WorkspaceDropdown } from "@/components/workspace/WorkspaceDropdown";
import { SettingsModal } from "@/components/workspace/SettingsModal";
import { usePageTree } from "@/hooks/usePageTree";
import { useCreatePage } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse";
```

**State Variables:**
- `isSettingsOpen: boolean` — controls SettingsModal visibility
- `showCreateMenu: boolean` — controls creation dropdown menu visibility
- `isMac: boolean` — platform detection for keyboard shortcut display (hydration-safe)

**Refs:**
- `createMenuRef: useRef<HTMLDivElement>(null)` — for outside click detection

**Hooks:**
- `useRouter()` — Next.js navigation
- `usePathname()` — current route for active link detection
- `usePageTree()` — fetches page hierarchy
- `useCreatePage()` — mutation for creating new page
- `useRecentPages()` — recent pages from localStorage
- `useSidebarCollapse()` — sidebar collapse state

**Effects:**
1. Platform detection (runs once after mount):
   ```typescript
   useEffect(() => {
     setIsMac(navigator.platform?.includes("Mac") ?? false);
   }, []);
   ```

2. Outside click detection for creation menu:
   ```typescript
   useEffect(() => {
     if (!showCreateMenu) return;
     function handleClick(e: MouseEvent) {
       if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
         setShowCreateMenu(false);
       }
     }
     document.addEventListener("mousedown", handleClick);
     return () => document.removeEventListener("mousedown", handleClick);
   }, [showCreateMenu]);
   ```

**Event Handlers:**
- `handleNewPage()` — closes menu, calls `createPage.mutate()`, navigates on success
- `handleNewDatabase()` — closes menu, navigates to `/databases`
- `handleSearch()` — dispatches synthetic `KeyboardEvent` with `key: "k"`, `metaKey: true`

**Active Link Helper:**
```typescript
const isActive = (path: string) => pathname === path;
```

**Component Structure:**
```tsx
<>
  <aside className="w-64 ...">
    {/* Workspace Header */}
    <div className="flex-shrink-0 border-b ...">
      <WorkspaceDropdown onOpenSettings={() => setIsSettingsOpen(true)} />
      <button onClick={toggleSidebar}>Collapse</button>
      <div ref={createMenuRef}>
        <button onClick={() => setShowCreateMenu(prev => !prev)}>+</button>
        {showCreateMenu && (
          <div className="absolute ...">
            <button onClick={handleNewPage}>Page</button>
            <button onClick={handleNewDatabase}>Database</button>
            <button onClick={handleNewPage}>AI Meeting Notes</button>
          </div>
        )}
      </div>
    </div>

    {/* Top Navigation */}
    <div className="flex-shrink-0 border-b ...">
      <button onClick={handleSearch}>
        Search
        <kbd>{isMac ? "⌘" : "Ctrl+"}K</kbd>
      </button>
      <button onClick={() => router.push("/home")} className={isActive("/home") ? "active" : ""}>
        Home
      </button>
      <button onClick={() => router.push("/graph")} className={isActive("/graph") ? "active" : ""}>
        Graph
      </button>
    </div>

    {/* Scrollable Content */}
    <div className="flex-1 overflow-y-auto">
      {/* Recents Section */}
      {recentPages.length > 0 && (
        <div className="px-2 pt-3 pb-1">
          <span className="uppercase text-[10px]">Recents</span>
          {recentPages.slice(0, 5).map(page => (
            <button key={page.id} onClick={() => router.push(`/pages/${page.id}`)}>
              {page.icon} {page.title}
            </button>
          ))}
        </div>
      )}

      {/* Private Section */}
      <div className="px-2 pt-3 pb-1">
        <span className="uppercase text-[10px]">Private</span>
      </div>
      <DndSidebarTree tree={data.data} />
    </div>

    {/* Settings Footer */}
    <div className="flex-shrink-0 border-t ...">
      <button onClick={() => setIsSettingsOpen(true)}>
        Settings
      </button>
    </div>
  </aside>

  {/* Settings Modal */}
  <SettingsModal
    isOpen={isSettingsOpen}
    onClose={() => setIsSettingsOpen(false)}
  />
</>
```

**CSS Custom Properties Used:**
- `--sidebar-bg` — sidebar background color
- `--sidebar-text` — primary text color
- `--sidebar-text-secondary` — secondary text color
- `--sidebar-hover` — hover background
- `--sidebar-active` — active link background
- `--border-default` — border color
- `--bg-primary` — dropdown menu background
- `--bg-hover` — menu item hover
- `--text-primary` — menu item text
- `--accent-primary` — icon accent color

**Collapsed Sidebar Behavior:**
- When `isCollapsed` is true, render narrow strip (w-10) with expand button only
- All sections hidden except expand button

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/workspace/Sidebar.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Sidebar } from '@/components/workspace/Sidebar';

// Mock all hooks and child components
vi.mock('next/navigation');
vi.mock('@/hooks/usePageTree');
vi.mock('@/hooks/usePages');
vi.mock('@/hooks/useRecentPages');
vi.mock('@/hooks/useSidebarCollapse');
vi.mock('@/components/workspace/WorkspaceDropdown');
vi.mock('@/components/workspace/SettingsModal');
vi.mock('@/components/workspace/DndSidebarTree');

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all sections when expanded', () => {
    render(<Sidebar />);
    expect(screen.getByText(/Search/i)).toBeInTheDocument();
    expect(screen.getByText(/Home/i)).toBeInTheDocument();
    expect(screen.getByText(/Graph/i)).toBeInTheDocument();
    expect(screen.getByText(/RECENTS/i)).toBeInTheDocument();
    expect(screen.getByText(/PRIVATE/i)).toBeInTheDocument();
    expect(screen.getByText(/Settings/i)).toBeInTheDocument();
  });

  it('should highlight active link based on pathname', () => {
    const mockPathname = '/home';
    vi.mocked(usePathname).mockReturnValue(mockPathname);
    render(<Sidebar />);
    const homeLink = screen.getByText(/Home/i).closest('button');
    expect(homeLink).toHaveClass('bg-[var(--sidebar-active)]');
  });

  it('should open creation menu on + button click', () => {
    render(<Sidebar />);
    const createButton = screen.getByLabelText('Create new');
    fireEvent.click(createButton);
    expect(screen.getByText('Page')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('should close creation menu on outside click', async () => {
    render(<Sidebar />);
    const createButton = screen.getByLabelText('Create new');
    fireEvent.click(createButton);
    expect(screen.getByText('Page')).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);
    await waitFor(() => {
      expect(screen.queryByText('Page')).not.toBeInTheDocument();
    });
  });

  it('should display recent pages', () => {
    const mockRecentPages = [
      { id: '1', title: 'Recent 1', icon: '📄', visitedAt: Date.now() },
      { id: '2', title: 'Recent 2', icon: '📝', visitedAt: Date.now() },
    ];
    vi.mocked(useRecentPages).mockReturnValue({ recentPages: mockRecentPages });
    render(<Sidebar />);
    expect(screen.getByText('Recent 1')).toBeInTheDocument();
    expect(screen.getByText('Recent 2')).toBeInTheDocument();
  });

  it('should display Mac keyboard shortcut after hydration', async () => {
    // Mock Mac platform
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    render(<Sidebar />);
    await waitFor(() => {
      expect(screen.getByText(/⌘K/i)).toBeInTheDocument();
    });
  });

  it('should dispatch keyboard event when search is clicked', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<Sidebar />);
    const searchButton = screen.getByText(/Search/i);
    fireEvent.click(searchButton);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'k',
        metaKey: true,
      })
    );
  });

  it('should open settings modal when footer button clicked', () => {
    render(<Sidebar />);
    const settingsButton = screen.getByText(/Settings/i);
    fireEvent.click(settingsButton);
    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
  });

  it('should create new page and navigate on success', async () => {
    const mockCreatePage = vi.fn();
    const mockPush = vi.fn();
    vi.mocked(useCreatePage).mockReturnValue({ mutate: mockCreatePage });
    vi.mocked(useRouter).mockReturnValue({ push: mockPush });

    render(<Sidebar />);
    const createButton = screen.getByLabelText('Create new');
    fireEvent.click(createButton);
    const pageButton = screen.getByText('Page');
    fireEvent.click(pageButton);

    expect(mockCreatePage).toHaveBeenCalledWith(
      { title: 'Untitled' },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });
});
```

### Integration Tests

**Test: Sidebar sections render correctly with real hooks**
- Mount `<Sidebar>` with mocked API responses
- Verify all sections render in correct order
- Verify recent pages fetched from localStorage

**Test: Active link state updates on navigation**
- Navigate to `/home`
- Verify Home link has active styling
- Navigate to `/graph`
- Verify Graph link has active styling, Home link inactive

### E2E Tests

**Test: User navigates via sidebar**
```typescript
test('user can navigate via sidebar links', async ({ page }) => {
  await page.goto('/home');
  await page.click('text=Graph');
  await expect(page).toHaveURL('/graph');
  await page.click('text=Home');
  await expect(page).toHaveURL('/home');
});
```

**Test: User creates new page via creation menu**
```typescript
test('user can create new page from sidebar', async ({ page }) => {
  await page.goto('/home');
  await page.click('[aria-label="Create new"]');
  await page.click('text=Page');
  await expect(page).toHaveURL(/\/pages\/.+/);
});
```

**Test: Keyboard shortcut displayed correctly**
```typescript
test('keyboard shortcut adapts to OS', async ({ page }) => {
  await page.goto('/home');
  const searchButton = page.locator('text=Search');
  const shortcut = await searchButton.locator('kbd').textContent();
  expect(shortcut).toMatch(/⌘K|Ctrl\+K/);
});
```

---

## Dependencies

**Technical:**
- Next.js `useRouter()` and `usePathname()` hooks
- `useRecentPages()` hook (SKB-11.4)
- `WorkspaceDropdown` component (SKB-11.2)
- `SettingsModal` component (EPIC-12)
- CSS custom properties from EPIC-09

**Data:**
- `usePageTree()` — page hierarchy from API
- `useCreatePage()` — mutation for creating pages
- `useRecentPages()` — recent pages from localStorage
- `useSidebarCollapse()` — collapse state from localStorage

---

## Dev Notes

### Hydration Fix

**Problem:** Initial implementation used:
```typescript
const isMac = navigator.platform?.includes("Mac") ?? false;
```

This caused hydration warnings because `navigator.platform` is only available in the browser, not during SSR. Server renders with `undefined`, browser hydrates with actual value → mismatch.

**Solution:** Move to `useEffect` so it only runs client-side after hydration completes:
```typescript
const [isMac, setIsMac] = useState(false);

useEffect(() => {
  setIsMac(navigator.platform?.includes("Mac") ?? false);
}, []);
```

This means the keyboard shortcut initially shows nothing (or defaults to Ctrl+K), then updates to ⌘K if on Mac. The flash is imperceptible to users.

### Fragment Wrapper

**Reason:** `SettingsModal` uses `createPortal(content, document.body)` to render at the top level of the DOM (for proper z-index stacking above all other content). However, React components can only return a single root element or a Fragment. Since we need to return both `<aside>` and the modal, we wrap them in `<>...</>`.

Without the Fragment, we'd need to return an array `[<aside>, <SettingsModal>]`, which requires explicit keys and is less clean.

### Creation Dropdown Positioning

The creation dropdown is positioned `absolute right-0 top-full mt-1` to align with the right edge of the + button and appear directly below it. The `z-50` ensures it renders above the page tree content.

### Active Link Styling

Active links use `bg-[var(--sidebar-active)]` (slightly darker/lighter background depending on theme) and `font-medium` (semibold weight). This matches Notion's active state design.

Inactive links have no background, use `text-[var(--sidebar-text-secondary)]` (muted text), and show `hover:bg-[var(--sidebar-hover)]` on hover.

---

**Last Updated:** 2026-02-22
