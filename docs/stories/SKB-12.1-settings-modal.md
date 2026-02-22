# Story SKB-12.1: Settings Modal

**Epic:** Epic 12 - Settings & Account Management
**Story ID:** SKB-12.1
**Story Points:** 5 | **Priority:** High | **Status:** Done
**Depends On:** SKB-09.1 (useTheme hook), SKB-12.2 (SessionProvider integration)

---

## User Story

As a user, I want a settings modal where I can view my account information and change my appearance preferences, So that I can customize my workspace experience.

---

## Acceptance Criteria

1. **Modal Structure**
   - [ ] Rendered via `createPortal(content, document.body)` to document.body
   - [ ] Full-screen overlay: `fixed inset-0 z-[100]`
   - [ ] Backdrop with blur: `bg-[var(--overlay)] backdrop-blur-sm`
   - [ ] Centered modal container: `max-w-5xl max-h-[90vh]`
   - [ ] Rounded corners, shadow: `rounded-lg shadow-2xl`
   - [ ] Flex layout: left sidebar + main content

2. **Close Mechanisms**
   - [ ] Close button (X icon) in top-right corner
   - [ ] Escape key closes modal
   - [ ] Event listener cleanup on unmount
   - [ ] Calls `onClose()` prop when closed

3. **Body Scroll Prevention**
   - [ ] Set `document.body.style.overflow = "hidden"` when open
   - [ ] Restore `document.body.style.overflow = ""` when closed
   - [ ] Cleanup in useEffect return function

4. **Left Sidebar Navigation**
   - [ ] Width: `w-60`, background: `bg-[var(--bg-secondary)]`
   - [ ] Two sections:
     - ACCOUNT section: "Preferences" button
     - WORKSPACE section: "General" button
   - [ ] Section headers: uppercase, small font, secondary color
   - [ ] Active button: `bg-[var(--bg-hover)]` background, primary text, font-medium
   - [ ] Inactive buttons: secondary text, hover background
   - [ ] Click button sets `activeSection` state

5. **Preferences Section (Account)**
   - [ ] Heading: "Preferences" (2xl, semibold)
   - [ ] **Account info card:**
     - Section header: "Account" (small, medium, secondary)
     - Display name from `session.user.name || "Not set"`
     - Display email from `session.user.email || "Not set"`
     - Border bottom separator
   - [ ] **Appearance section:**
     - Section header: "Appearance"
     - Description text: "Choose how SymbioKnowledgeBase looks to you"
     - Grid: 3 columns, 3 theme cards
   - [ ] **Theme cards:**
     - Light card: white background, yellow sun icon, "Light" label
     - Dark card: dark gray background, blue moon icon, "Dark" label
     - System card: gradient background, monitor icon, "System" label
     - Active card: blue border, checkmark in top-right corner
     - Inactive cards: gray border, hover effect
     - Click card calls `setTheme(theme)` from useTheme

6. **Workspace Section**
   - [ ] Heading: "Workspace Settings" (2xl, semibold)
   - [ ] **General section:**
     - Section header: "General"
     - Workspace name input (disabled, value="SymbioKnowledgeBase")
     - Helper text: "Workspace name customization coming soon"

7. **Hydration Safety**
   - [ ] `mounted` state initialized to `false`
   - [ ] `useEffect(() => setMounted(true), [])` runs after hydration
   - [ ] Return `null` if `!isOpen || !mounted`
   - [ ] Prevents portal rendering during SSR

8. **TypeScript**
   - [ ] Props interface: `{ isOpen: boolean; onClose: () => void }`
   - [ ] State type: `"account-preferences" | "workspace-general"`
   - [ ] All event handlers properly typed

---

## Technical Implementation Notes

### File: `src/components/workspace/SettingsModal.tsx` (new file)

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useSession } from "next-auth/react";
import { useTheme } from "@/hooks/useTheme";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = "account-preferences" | "workspace-general";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account-preferences");
  const [mounted, setMounted] = useState(false);
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();

  // Hydration-safe mounting
  useEffect(() => {
    setMounted(true);
  }, []);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  // Body scroll prevention and keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm">
      <div className="relative w-full h-full max-w-5xl max-h-[90vh] m-4 bg-[var(--bg-primary)] rounded-lg shadow-2xl flex overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded p-2 text-[var(--text-secondary)]
            hover:bg-[var(--bg-secondary)] transition-colors"
          aria-label="Close settings"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Left sidebar navigation */}
        <aside className="w-60 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 overflow-y-auto">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Settings</h2>

          {/* Account section */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Account
            </h3>
            <button
              onClick={() => setActiveSection("account-preferences")}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                activeSection === "account-preferences"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              Preferences
            </button>
          </div>

          {/* Workspace section */}
          <div>
            <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Workspace
            </h3>
            <button
              onClick={() => setActiveSection("workspace-general")}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                activeSection === "workspace-general"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              General
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeSection === "account-preferences" && (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
                Preferences
              </h1>

              {/* User info */}
              {session?.user && (
                <div className="mb-8 pb-8 border-b border-[var(--border-default)]">
                  <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                    Account
                  </h2>
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">Name:</span> {session.user.name || "Not set"}
                    </p>
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">Email:</span> {session.user.email || "Not set"}
                    </p>
                  </div>
                </div>
              )}

              {/* Theme selector */}
              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                  Appearance
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Choose how SymbioKnowledgeBase looks to you
                </p>

                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {/* Light theme */}
                  <button
                    onClick={() => setTheme("light")}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      theme === "light"
                        ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                        : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    {theme === "light" && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="w-4 h-4 text-[var(--accent-primary)]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-md bg-white border border-gray-300 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-yellow-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Light</span>
                  </button>

                  {/* Dark theme */}
                  <button
                    onClick={() => setTheme("dark")}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      theme === "dark"
                        ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                        : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    {theme === "dark" && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="w-4 h-4 text-[var(--accent-primary)]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-md bg-gray-900 border border-gray-700 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Dark</span>
                  </button>

                  {/* System theme */}
                  <button
                    onClick={() => setTheme("system")}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      theme === "system"
                        ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                        : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    {theme === "system" && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="w-4 h-4 text-[var(--accent-primary)]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-md bg-gradient-to-br from-white to-gray-900 border border-gray-400 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">System</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "workspace-general" && (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
                Workspace Settings
              </h1>

              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                  General
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                      Workspace Name
                    </label>
                    <div className="max-w-md">
                      <input
                        type="text"
                        value="SymbioKnowledgeBase"
                        disabled
                        className="w-full px-3 py-2 rounded-md border border-[var(--border-default)]
                          bg-[var(--bg-secondary)] text-[var(--text-primary)]
                          opacity-60 cursor-not-allowed text-sm"
                      />
                      <p className="text-xs text-[var(--text-secondary)] mt-2">
                        Workspace name customization coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
```

**Key Implementation Details:**

1. **Portal Rendering:**
   ```typescript
   return createPortal(modalContent, document.body);
   ```
   This renders the modal at the root of the DOM, outside the normal React component tree. Benefits:
   - Modal appears above all other content (z-index stacking context)
   - Not affected by parent overflow/transform properties
   - Can overlay the entire viewport

2. **Hydration Safety:**
   ```typescript
   const [mounted, setMounted] = useState(false);
   useEffect(() => setMounted(true), []);
   if (!isOpen || !mounted) return null;
   ```
   `createPortal` requires `document.body` which doesn't exist during SSR. The `mounted` guard ensures the portal only renders after hydration completes.

3. **Body Scroll Prevention:**
   ```typescript
   useEffect(() => {
     if (isOpen) {
       document.body.style.overflow = "hidden";
     } else {
       document.body.style.overflow = "";
     }
     return () => { document.body.style.overflow = ""; };
   }, [isOpen]);
   ```
   Prevents background page from scrolling while modal is open. Cleanup ensures scroll is restored even if component unmounts unexpectedly.

4. **Keyboard Navigation:**
   ```typescript
   const handleKeyDown = useCallback((e: KeyboardEvent) => {
     if (e.key === "Escape") onClose();
   }, [onClose]);

   useEffect(() => {
     if (isOpen) {
       document.addEventListener("keydown", handleKeyDown);
     }
     return () => document.removeEventListener("keydown", handleKeyDown);
   }, [isOpen, handleKeyDown]);
   ```
   Standard Escape-to-close pattern. `useCallback` ensures handler reference stays stable.

---

## Test Scenarios

### Unit Tests: `src/__tests__/components/workspace/SettingsModal.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '@/components/workspace/SettingsModal';
import { useSession } from 'next-auth/react';
import { useTheme } from '@/hooks/useTheme';

vi.mock('next-auth/react');
vi.mock('@/hooks/useTheme');

describe('SettingsModal', () => {
  const mockOnClose = vi.fn();
  const mockSetTheme = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { name: 'Test User', email: 'test@example.com' } },
    });
    vi.mocked(useTheme).mockReturnValue({
      theme: 'light',
      setTheme: mockSetTheme,
    });
  });

  it('should not render when isOpen is false', () => {
    render(<SettingsModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should display user name and email', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });

  it('should display theme cards with active checkmark', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText('Light')).toBeInTheDocument();
    expect(screen.getByText('Dark')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();

    // Light theme should have checkmark
    const lightCard = screen.getByText('Light').closest('button');
    expect(lightCard).toContainHTML('path d="M9 16.17'); // Checkmark SVG
  });

  it('should call setTheme when theme card clicked', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    const darkCard = screen.getByText('Dark');
    fireEvent.click(darkCard);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('should switch to workspace section', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    const generalButton = screen.getByText('General');
    fireEvent.click(generalButton);
    expect(screen.getByText('Workspace Settings')).toBeInTheDocument();
  });

  it('should close on X button click', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    const closeButton = screen.getByLabelText('Close settings');
    fireEvent.click(closeButton);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should close on Escape key', () => {
    render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should prevent body scroll when open', () => {
    const { rerender } = render(<SettingsModal isOpen={true} onClose={mockOnClose} />);
    expect(document.body.style.overflow).toBe('hidden');

    rerender(<SettingsModal isOpen={false} onClose={mockOnClose} />);
    expect(document.body.style.overflow).toBe('');
  });
});
```

### Integration Tests

**Test: SettingsModal with real useSession and useTheme**
- Mount with real session data from NextAuth
- Verify user info displays correctly
- Click theme card, verify theme changes in app
- Verify body scroll restored after close

### E2E Tests

**Test: User changes theme via settings**
```typescript
test('user can change theme in settings', async ({ page }) => {
  await page.goto('/home');
  await page.click('text=SymbioKnowledgeBase');
  await page.click('text=Settings');

  // Modal opens
  await expect(page.locator('text=Preferences')).toBeVisible();

  // Click dark theme
  await page.click('text=Dark');

  // Verify theme applied
  await expect(page.locator('html')).toHaveClass(/dark/);

  // Close modal
  await page.keyboard.press('Escape');
  await expect(page.locator('text=Preferences')).not.toBeVisible();
});
```

---

## Dependencies

**Hooks:**
- `useSession()` — NextAuth session data (requires SessionProvider)
- `useTheme()` — theme state from EPIC-09
- `useState`, `useEffect`, `useCallback` — React hooks

**Libraries:**
- `react-dom` — `createPortal` function
- `next-auth/react` — `useSession` hook

---

## Dev Notes

### Why createPortal?

Without `createPortal`, the modal would render inside the Sidebar component's DOM hierarchy. This causes issues:

1. **Z-index conflicts:** Parent elements with `z-index` create stacking contexts that trap children
2. **Overflow clipping:** Parent `overflow: hidden` would clip the modal
3. **Transform issues:** Parent CSS transforms create new containing blocks

`createPortal` solves all of these by rendering at `document.body` level.

### Hydration Safety Pattern

The `mounted` state pattern is required for any component that uses browser-only APIs (`document`, `window`) in render:

```typescript
const [mounted, setMounted] = useState(false);
useEffect(() => setMounted(true), []);
if (!mounted) return null;
```

Without this:
1. Server renders: `createPortal(content, document.body)` → Error: `document is not defined`
2. With guard: Server renders `null`, client hydrates and renders portal

This is a common Next.js pattern for client-only components.

### Theme Card Design

The theme cards use a 12x12 preview box with theme-representative colors:
- **Light:** White background (simulates light theme)
- **Dark:** Dark gray background (simulates dark theme)
- **System:** Gradient from white to dark (represents auto-switching)

The checkmark appears absolutely positioned in the top-right corner, only on the active theme. This matches Notion's design.

### Future Enhancements

Potential additions to settings modal:
- Profile picture upload
- Password change
- Two-factor authentication
- Email preferences / notifications
- Workspace member management
- Billing settings
- Export data

The current structure (left nav with sections) accommodates all of these without layout changes.

---

**Last Updated:** 2026-02-22
