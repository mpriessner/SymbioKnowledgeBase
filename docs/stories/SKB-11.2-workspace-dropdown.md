# Story SKB-11.2: Workspace Dropdown

**Epic:** Epic 11 - Sidebar Restructure & Home Page Dashboard
**Story ID:** SKB-11.2
**Story Points:** 3 | **Priority:** Medium | **Status:** Done
**Depends On:** None

---

## User Story

As a user, I want to click the workspace name in the sidebar to access settings and log out, So that I can manage my account without leaving the current page.

---

## Acceptance Criteria

1. **Trigger Button**
   - [ ] Displays workspace name: "SymbioKnowledgeBase"
   - [ ] Shows chevron icon that rotates 180° when open
   - [ ] Full width with left-aligned text
   - [ ] Hover state: `hover:bg-[var(--sidebar-hover)]`
   - [ ] Click toggles dropdown open/closed
   - [ ] `aria-label="Workspace menu"` and `aria-expanded` attribute

2. **Dropdown Menu**
   - [ ] Appears below trigger button, aligned to left
   - [ ] Full width with `min-w-[240px]`
   - [ ] Positioned absolutely: `left-0 top-full mt-1`
   - [ ] Border: `border-[var(--border-default)]`
   - [ ] Background: `bg-[var(--bg-primary)]`
   - [ ] Shadow: `shadow-lg`
   - [ ] z-index: `z-50`
   - [ ] `role="menu"` for accessibility

3. **Menu Content**
   - [ ] **Current workspace section** (top, with bottom border):
     - Checkmark icon (accent color)
     - Workspace name: "SymbioKnowledgeBase"
   - [ ] **Settings button**:
     - Gear icon + "Settings" text
     - Calls `onOpenSettings()` prop
     - Hover: `hover:bg-[var(--bg-hover)]`
     - `role="menuitem"`
   - [ ] **Divider** (border-t)
   - [ ] **Log out button**:
     - Log out icon + "Log out" text
     - Calls `signOut({ callbackUrl: "/login" })`
     - Hover: `hover:bg-[var(--bg-hover)]`
     - `role="menuitem"`

4. **Close Behavior**
   - [ ] Closes on outside click (ref-based detection)
   - [ ] Closes on Escape key press
   - [ ] Closes when Settings or Log out is clicked

5. **TypeScript**
   - [ ] Props interface defined: `{ onOpenSettings: () => void }`
   - [ ] All event handlers properly typed
   - [ ] No `any` types

---

## Technical Implementation Notes

### File: `src/components/workspace/WorkspaceDropdown.tsx` (new file)

```typescript
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";

interface WorkspaceDropdownProps {
  onOpenSettings: () => void;
}

export function WorkspaceDropdown({ onOpenSettings }: WorkspaceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    },
    []
  );

  const handleSettingsClick = () => {
    setIsOpen(false);
    onOpenSettings();
  };

  const handleLogout = async () => {
    setIsOpen(false);
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded px-2 py-1.5 text-sm font-semibold
          text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-colors w-full"
        aria-label="Workspace menu"
        aria-expanded={isOpen}
      >
        <span className="flex-1 text-left truncate">SymbioKnowledgeBase</span>
        <svg
          className={`w-4 h-4 text-[var(--sidebar-text-secondary)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-full min-w-[240px] rounded-md
            border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg"
          role="menu"
        >
          {/* Current workspace */}
          <div className="px-3 py-2 border-b border-[var(--border-default)]">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-[var(--accent-primary)]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium text-[var(--text-primary)]">
                SymbioKnowledgeBase
              </span>
            </div>
          </div>

          {/* Settings */}
          <button
            onClick={handleSettingsClick}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)]
              hover:bg-[var(--bg-hover)] transition-colors"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-[var(--text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>Settings</span>
          </button>

          <div className="my-1 border-t border-[var(--border-default)]" />

          {/* Log out */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--text-primary)]
              hover:bg-[var(--bg-hover)] transition-colors"
            role="menuitem"
          >
            <svg
              className="w-4 h-4 text-[var(--text-secondary)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
              />
            </svg>
            <span>Log out</span>
          </button>
        </div>
      )}
    </div>
  );
}
```

**Event Flow:**

1. **Open dropdown:**
   - User clicks trigger button
   - `setIsOpen(true)`
   - Menu renders below button

2. **Close via outside click:**
   - User clicks anywhere outside `containerRef`
   - `mousedown` listener detects click outside
   - `setIsOpen(false)`

3. **Close via Escape key:**
   - User presses Escape while dropdown is focused
   - `handleKeyDown` detects `e.key === "Escape"`
   - `setIsOpen(false)`

4. **Close via menu action:**
   - User clicks Settings or Log out
   - Handler closes menu first (`setIsOpen(false)`)
   - Then executes action (`onOpenSettings()` or `signOut()`)

**Outside Click Detection Pattern:**

This pattern uses a ref to detect clicks outside the component:

```typescript
const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!isOpen) return; // Only listen when open

  function handleClick(e: MouseEvent) {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
    }
  }

  document.addEventListener("mousedown", handleClick);
  return () => document.removeEventListener("mousedown", handleClick);
}, [isOpen]);
```

- `mousedown` fires before `click`, preventing menu from immediately reopening
- `contains()` checks if click target is inside the ref element
- Effect cleanup removes listener when menu closes or component unmounts

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/workspace/WorkspaceDropdown.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkspaceDropdown } from '@/components/workspace/WorkspaceDropdown';
import { signOut } from 'next-auth/react';

vi.mock('next-auth/react');

describe('WorkspaceDropdown', () => {
  const mockOnOpenSettings = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render trigger button with workspace name', () => {
    render(<WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />);
    expect(screen.getByText('SymbioKnowledgeBase')).toBeInTheDocument();
    expect(screen.getByLabelText('Workspace menu')).toBeInTheDocument();
  });

  it('should toggle dropdown on button click', () => {
    render(<WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />);
    const trigger = screen.getByLabelText('Workspace menu');

    // Initially closed
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    // Open
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Close
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should call onOpenSettings when Settings clicked', () => {
    render(<WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />);
    const trigger = screen.getByLabelText('Workspace menu');
    fireEvent.click(trigger);

    const settingsButton = screen.getByText('Settings');
    fireEvent.click(settingsButton);

    expect(mockOnOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(); // Menu closes
  });

  it('should call signOut when Log out clicked', async () => {
    render(<WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />);
    const trigger = screen.getByLabelText('Workspace menu');
    fireEvent.click(trigger);

    const logoutButton = screen.getByText('Log out');
    fireEvent.click(logoutButton);

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/login' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument(); // Menu closes
  });

  it('should close on outside click', async () => {
    render(
      <div>
        <WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />
        <div data-testid="outside">Outside element</div>
      </div>
    );

    const trigger = screen.getByLabelText('Workspace menu');
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Click outside
    const outside = screen.getByTestId('outside');
    fireEvent.mouseDown(outside);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  it('should close on Escape key', () => {
    render(<WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />);
    const trigger = screen.getByLabelText('Workspace menu');
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    // Press Escape
    fireEvent.keyDown(trigger.parentElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('should rotate chevron icon when open', () => {
    render(<WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />);
    const trigger = screen.getByLabelText('Workspace menu');
    const chevron = trigger.querySelector('svg');

    expect(chevron).not.toHaveClass('rotate-180');

    fireEvent.click(trigger);
    expect(chevron).toHaveClass('rotate-180');
  });

  it('should have correct ARIA attributes', () => {
    render(<WorkspaceDropdown onOpenSettings={mockOnOpenSettings} />);
    const trigger = screen.getByLabelText('Workspace menu');

    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
```

### Integration Tests

**Test: Dropdown integrates with Sidebar parent**
- Mount `<Sidebar>` with WorkspaceDropdown
- Click workspace name
- Verify dropdown opens
- Click Settings
- Verify SettingsModal opens

### E2E Tests

**Test: User logs out via workspace dropdown**
```typescript
test('user can log out from workspace dropdown', async ({ page }) => {
  await page.goto('/home');
  await page.click('text=SymbioKnowledgeBase');
  await page.click('text=Log out');
  await expect(page).toHaveURL('/login');
});
```

**Test: User opens settings via workspace dropdown**
```typescript
test('user can open settings from workspace dropdown', async ({ page }) => {
  await page.goto('/home');
  await page.click('text=SymbioKnowledgeBase');
  await page.click('text=Settings');
  await expect(page.locator('[data-testid="settings-modal"]')).toBeVisible();
});
```

---

## Dependencies

**Technical:**
- `next-auth/react` — `signOut()` function
- React `useState`, `useRef`, `useEffect`, `useCallback` hooks

**Integration:**
- Used by `Sidebar.tsx` via `onOpenSettings` prop callback
- Opens `SettingsModal` component when Settings is clicked

---

## Dev Notes

### Why `mousedown` Instead of `click`?

The outside click detection uses `mousedown` instead of `click` to prevent a race condition:

1. User clicks trigger button → menu opens
2. If we used `click` listener, the same click event would propagate to document
3. Document listener would immediately close the menu
4. Result: menu never appears

With `mousedown`:
1. User presses mouse down on trigger → menu opens
2. User releases mouse (click completes)
3. Next click outside triggers `mousedown` on document → menu closes

### Chevron Icon Rotation

The chevron icon uses `transition-transform` with conditional `rotate-180` class:

```tsx
<svg className={`... transition-transform ${isOpen ? "rotate-180" : ""}`}>
```

This creates a smooth 180° rotation animation when the dropdown opens/closes.

### Accessibility

- `aria-label="Workspace menu"` — screen reader label
- `aria-expanded={isOpen}` — announces state to screen readers
- `role="menu"` on dropdown — semantic menu container
- `role="menuitem"` on buttons — semantic menu items
- Escape key support — standard menu behavior

### Future Enhancement: Multiple Workspaces

Currently hardcoded to "SymbioKnowledgeBase", but the component structure supports future enhancement:

```typescript
interface WorkspaceDropdownProps {
  currentWorkspace: { id: string; name: string };
  workspaces: Array<{ id: string; name: string }>;
  onSwitchWorkspace: (id: string) => void;
  onOpenSettings: () => void;
}
```

The current workspace section could list all workspaces with checkmarks on the active one.

---

**Last Updated:** 2026-02-22
