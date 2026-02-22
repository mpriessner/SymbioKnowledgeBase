# Story SKB-11.3: Home Page Dashboard

**Epic:** Epic 11 - Sidebar Restructure & Home Page Dashboard
**Story ID:** SKB-11.3
**Story Points:** 8 | **Priority:** High | **Status:** Done
**Depends On:** SKB-11.4 (useRecentPages hook)

---

## User Story

As a user, I want a home page dashboard that shows my recent work and quick actions, So that I can quickly resume my last tasks or start new ones without navigating through the page tree.

---

## Acceptance Criteria

1. **Route and Page Setup**
   - [ ] Page at `/app/(workspace)/home/page.tsx`
   - [ ] Marked as `"use client"` (uses client-side hooks)
   - [ ] Exports default `HomePage` component
   - [ ] Centered layout with max-width container

2. **Greeting Section**
   - [ ] Displays "Good {morning|afternoon|evening}" based on current time
   - [ ] Morning: 0:00-11:59, Afternoon: 12:00-17:59, Evening: 18:00-23:59
   - [ ] Helper: `getTimeOfDay()` returns "morning" | "afternoon" | "evening"
   - [ ] Memoized via `useMemo()` to prevent recalculations
   - [ ] Text: `text-4xl font-semibold text-[var(--text-primary)] mb-2`

3. **Recently Visited Section**
   - [ ] Heading: "RECENTLY VISITED" (uppercase, small, secondary color)
   - [ ] Horizontal scrollable carousel: `overflow-x-auto`
   - [ ] Shows pages from `useRecentPages()` hook
   - [ ] Each card:
     - Fixed width: `w-64`
     - Emoji icon (2xl size)
     - Page title (truncated)
     - Relative time via `getRelativeTime()` helper
   - [ ] Helper formats: "5m ago", "3h ago", "2d ago", "just now"
   - [ ] Click card navigates to `/pages/{id}`
   - [ ] Hover state: `hover:bg-[var(--bg-hover)]`
   - [ ] Only render section if `recentPages.length > 0`

4. **Quick Actions Grid**
   - [ ] Heading: "QUICK ACTIONS" (uppercase, small, secondary color)
   - [ ] Grid: 1 column mobile, 3 columns desktop (`grid-cols-1 md:grid-cols-3`)
   - [ ] **New Page card:**
     - Icon: ✏️ emoji
     - Title: "New Page"
     - Description: "Create a blank page"
     - Click navigates to `/pages` to create new page
   - [ ] **Search card:**
     - Icon: 🔍 emoji
     - Title: "Search"
     - Description: "Press Cmd+K"
     - Click dispatches synthetic `KeyboardEvent` with `key: "k"`, `metaKey: true`
   - [ ] **View Graph card:**
     - Icon: 🕸️ emoji
     - Title: "View Graph"
     - Description: "See connections"
     - Click navigates to `/graph`
   - [ ] Hover state: `hover:bg-[var(--bg-hover)]`, title color transitions to accent

5. **All Pages Section**
   - [ ] Heading: "ALL PAGES" (uppercase, small, secondary color)
   - [ ] Fetches via `usePages({ sortBy: "updatedAt", order: "desc" })`
   - [ ] Loading state: skeleton rows (5 animated placeholders)
   - [ ] Empty state:
     - 📝 emoji (4xl size)
     - Message: "No pages yet. Create your first page to get started!"
   - [ ] Each row:
     - Emoji icon (lg size)
     - Page title (truncated)
     - Formatted date: `new Date(page.updatedAt).toLocaleDateString()`
   - [ ] Click row navigates to `/pages/{id}`
   - [ ] Hover state: `hover:bg-[var(--bg-hover)]`, title transitions to accent

6. **Helpers**
   - [ ] `getTimeOfDay(): string` — returns morning/afternoon/evening
   - [ ] `getRelativeTime(timestamp: number): string` — returns "5m ago" format

7. **TypeScript**
   - [ ] All types explicitly defined
   - [ ] No `any` types

---

## Technical Implementation Notes

### File: `src/app/(workspace)/home/page.tsx` (new file)

```typescript
"use client";

import { usePages } from "@/hooks/usePages";
import { useRecentPages } from "@/hooks/useRecentPages";
import { useRouter } from "next/navigation";
import { useMemo } from "react";

function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default function HomePage() {
  const router = useRouter();
  const { recentPages } = useRecentPages();
  const { data: pagesData, isLoading } = usePages({ sortBy: "updatedAt", order: "desc" });

  const timeOfDay = useMemo(() => getTimeOfDay(), []);
  const allPages = pagesData?.data ?? [];

  const handleNavigateToPage = (pageId: string) => {
    router.push(`/pages/${pageId}`);
  };

  const handleNewPage = () => {
    router.push("/pages");
  };

  const handleSearch = () => {
    // Trigger Cmd+K - the QuickSwitcher component handles this globally
    const event = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(event);
  };

  const handleViewGraph = () => {
    router.push("/graph");
  };

  return (
    <div className="flex flex-col items-center px-8 py-12 min-h-screen bg-[var(--bg-primary)]">
      {/* Greeting */}
      <div className="w-full max-w-4xl mb-12">
        <h1 className="text-4xl font-semibold text-[var(--text-primary)] mb-2">
          Good {timeOfDay}
        </h1>
      </div>

      {/* Recently Visited */}
      {recentPages.length > 0 && (
        <section className="w-full max-w-4xl mb-12">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
            Recently visited
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
            {recentPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleNavigateToPage(page.id)}
                className="flex-shrink-0 w-64 p-4 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {page.icon || "📄"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate mb-1 group-hover:text-[var(--accent-primary)] transition-colors">
                      {page.title || "Untitled"}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {getRelativeTime(page.visitedAt)}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <section className="w-full max-w-4xl mb-12">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
          Quick actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            onClick={handleNewPage}
            className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">✏️</div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  New Page
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Create a blank page
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={handleSearch}
            className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">🔍</div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  Search
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Press Cmd+K
                </div>
              </div>
            </div>
          </button>

          <button
            onClick={handleViewGraph}
            className="p-5 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl">🕸️</div>
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                  View Graph
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-0.5">
                  See connections
                </div>
              </div>
            </div>
          </button>
        </div>
      </section>

      {/* All Pages */}
      <section className="w-full max-w-4xl">
        <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-4 uppercase tracking-wide">
          All pages
        </h2>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="h-10 bg-[var(--bg-secondary)] border border-[var(--border-default)] rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : allPages.length === 0 ? (
          <div className="text-center py-12 text-[var(--text-secondary)]">
            <div className="text-4xl mb-3">📝</div>
            <p className="text-sm">No pages yet. Create your first page to get started!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {allPages.map((page) => (
              <button
                key={page.id}
                onClick={() => handleNavigateToPage(page.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[var(--bg-hover)] transition-colors duration-150 text-left group"
              >
                <div className="text-lg flex-shrink-0">
                  {page.icon || "📄"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[var(--text-primary)] truncate group-hover:text-[var(--accent-primary)] transition-colors">
                    {page.title || "Untitled"}
                  </div>
                </div>
                <div className="text-xs text-[var(--text-secondary)] flex-shrink-0">
                  {new Date(page.updatedAt).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

**Time-Based Greeting Logic:**
- `new Date().getHours()` returns 0-23
- Morning: 0-11 (midnight to 11:59 AM)
- Afternoon: 12-17 (noon to 5:59 PM)
- Evening: 18-23 (6:00 PM to 11:59 PM)

**Relative Time Formatting:**
- Calculates difference from current time in milliseconds
- Converts to seconds, minutes, hours, days
- Returns most significant unit: "2d ago" (not "48h ago")
- Shows "just now" for < 1 minute

**Horizontal Scroll Styling:**
```css
overflow-x-auto /* enables horizontal scrolling */
pb-2           /* padding-bottom for scrollbar */
scrollbar-thin /* Tailwind plugin for thin scrollbars */
```

Cards use `flex-shrink-0` to prevent compression and fixed `w-64` width.

---

## Test Scenarios

### Unit Tests: `src/__tests__/app/(workspace)/home/page.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HomePage from '@/app/(workspace)/home/page';

vi.mock('@/hooks/usePages');
vi.mock('@/hooks/useRecentPages');
vi.mock('next/navigation');

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display morning greeting before noon', () => {
    vi.setSystemTime(new Date('2026-02-22T10:00:00'));
    render(<HomePage />);
    expect(screen.getByText(/Good morning/i)).toBeInTheDocument();
  });

  it('should display afternoon greeting between noon and 6pm', () => {
    vi.setSystemTime(new Date('2026-02-22T14:00:00'));
    render(<HomePage />);
    expect(screen.getByText(/Good afternoon/i)).toBeInTheDocument();
  });

  it('should display evening greeting after 6pm', () => {
    vi.setSystemTime(new Date('2026-02-22T20:00:00'));
    render(<HomePage />);
    expect(screen.getByText(/Good evening/i)).toBeInTheDocument();
  });

  it('should display recently visited pages', () => {
    const mockRecentPages = [
      { id: '1', title: 'Recent Page 1', icon: '📄', visitedAt: Date.now() - 3600000 }, // 1h ago
      { id: '2', title: 'Recent Page 2', icon: '📝', visitedAt: Date.now() - 7200000 }, // 2h ago
    ];
    vi.mocked(useRecentPages).mockReturnValue({ recentPages: mockRecentPages });

    render(<HomePage />);
    expect(screen.getByText('Recent Page 1')).toBeInTheDocument();
    expect(screen.getByText('Recent Page 2')).toBeInTheDocument();
    expect(screen.getByText('1h ago')).toBeInTheDocument();
    expect(screen.getByText('2h ago')).toBeInTheDocument();
  });

  it('should display quick action cards', () => {
    render(<HomePage />);
    expect(screen.getByText('New Page')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('View Graph')).toBeInTheDocument();
  });

  it('should navigate to /pages when New Page clicked', () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush });

    render(<HomePage />);
    const newPageButton = screen.getByText('New Page');
    fireEvent.click(newPageButton);

    expect(mockPush).toHaveBeenCalledWith('/pages');
  });

  it('should dispatch keyboard event when Search clicked', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<HomePage />);
    const searchButton = screen.getByText('Search');
    fireEvent.click(searchButton);

    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'k',
        metaKey: true,
      })
    );
  });

  it('should navigate to /graph when View Graph clicked', () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush });

    render(<HomePage />);
    const graphButton = screen.getByText('View Graph');
    fireEvent.click(graphButton);

    expect(mockPush).toHaveBeenCalledWith('/graph');
  });

  it('should display all pages sorted by updatedAt', () => {
    const mockPages = [
      { id: '1', title: 'Page 1', icon: '📄', updatedAt: '2026-02-22T10:00:00Z' },
      { id: '2', title: 'Page 2', icon: '📝', updatedAt: '2026-02-21T10:00:00Z' },
    ];
    vi.mocked(usePages).mockReturnValue({
      data: { data: mockPages },
      isLoading: false,
    });

    render(<HomePage />);
    expect(screen.getByText('Page 1')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
  });

  it('should display loading skeletons while fetching pages', () => {
    vi.mocked(usePages).mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    render(<HomePage />);
    const skeletons = screen.getAllByRole('generic', { class: /animate-pulse/ });
    expect(skeletons).toHaveLength(5);
  });

  it('should display empty state when no pages exist', () => {
    vi.mocked(usePages).mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    render(<HomePage />);
    expect(screen.getByText(/No pages yet/i)).toBeInTheDocument();
    expect(screen.getByText('📝')).toBeInTheDocument();
  });

  it('should navigate to page when page row clicked', () => {
    const mockPush = vi.fn();
    vi.mocked(useRouter).mockReturnValue({ push: mockPush });

    const mockPages = [
      { id: 'page-123', title: 'Test Page', icon: '📄', updatedAt: '2026-02-22T10:00:00Z' },
    ];
    vi.mocked(usePages).mockReturnValue({
      data: { data: mockPages },
      isLoading: false,
    });

    render(<HomePage />);
    const pageRow = screen.getByText('Test Page');
    fireEvent.click(pageRow);

    expect(mockPush).toHaveBeenCalledWith('/pages/page-123');
  });

  it('should hide recently visited section when no recent pages', () => {
    vi.mocked(useRecentPages).mockReturnValue({ recentPages: [] });

    render(<HomePage />);
    expect(screen.queryByText(/Recently visited/i)).not.toBeInTheDocument();
  });
});
```

### Integration Tests

**Test: HomePage with real data fetching**
- Mount `<HomePage>` with API mocks
- Verify all sections render
- Verify data fetched from correct endpoints
- Verify sorting by updatedAt descending

### E2E Tests

**Test: User navigates from home page**
```typescript
test('user can navigate from home page', async ({ page }) => {
  await page.goto('/home');

  // Check greeting
  await expect(page.locator('h1')).toContainText(/Good (morning|afternoon|evening)/);

  // Click recent page
  await page.click('.recently-visited button:first-child');
  await expect(page).toHaveURL(/\/pages\/.+/);

  // Go back and use quick action
  await page.goto('/home');
  await page.click('text=View Graph');
  await expect(page).toHaveURL('/graph');
});
```

**Test: User creates page from home**
```typescript
test('user can create page from home quick action', async ({ page }) => {
  await page.goto('/home');
  await page.click('text=New Page');
  await expect(page).toHaveURL('/pages');
  // Page creation flow continues...
});
```

**Test: Search shortcut works from home**
```typescript
test('search quick action opens quick switcher', async ({ page }) => {
  await page.goto('/home');
  await page.click('text=Search');
  await expect(page.locator('[data-testid="quick-switcher"]')).toBeVisible();
});
```

---

## Dependencies

**Hooks:**
- `useRecentPages()` — fetches recent pages from localStorage
- `usePages({ sortBy: "updatedAt", order: "desc" })` — fetches all pages sorted
- `useRouter()` — Next.js navigation

**Components:**
- Standalone page component, no child components

**Routes:**
- `/pages` — new page creation
- `/pages/{id}` — individual page view
- `/graph` — knowledge graph view

---

## Dev Notes

### Why `useMemo` for Time of Day?

The `getTimeOfDay()` calculation is memoized:

```typescript
const timeOfDay = useMemo(() => getTimeOfDay(), []);
```

Without memoization, the component would recalculate the time on every render (e.g., when hovering over buttons, which triggers re-renders for hover states). With an empty dependency array `[]`, it calculates once when the component mounts and never recalculates.

**Trade-off:** If a user keeps the page open past midnight, noon, or 6 PM, the greeting won't update until they refresh. This is acceptable because:
1. The greeting is a nice-to-have, not critical functionality
2. Users rarely keep a single page open for 6+ hours without interaction
3. Any navigation (clicking a page) will unmount and remount the component, triggering a new calculation

If real-time updates were required, we'd use:
```typescript
const [timeOfDay, setTimeOfDay] = useState(getTimeOfDay());

useEffect(() => {
  const interval = setInterval(() => {
    setTimeOfDay(getTimeOfDay());
  }, 60000); // Check every minute
  return () => clearInterval(interval);
}, []);
```

But this adds unnecessary complexity for minimal user value.

### Relative Time Formatting

The `getRelativeTime()` helper uses floor division to avoid floating-point precision issues:

```typescript
const days = Math.floor(hours / 24);
```

This ensures "1 day ago" appears exactly at the 24-hour mark, not at 23 hours 59 minutes.

**Limitation:** The relative time doesn't auto-update. A page visited "5 minutes ago" will continue showing "5 minutes ago" until the component re-renders. Since the user is likely to interact with the page (clicking links, navigating away), this is acceptable.

If auto-updating relative times were required, we'd need an interval that updates every minute and recalculates all timestamps.

### Quick Actions Integration

The Search quick action dispatches a synthetic keyboard event rather than directly importing and calling `openQuickSwitcher()` because:

1. **Separation of concerns:** The home page doesn't need to know how the QuickSwitcher works
2. **Consistency:** The keyboard shortcut and button both trigger the same event, ensuring identical behavior
3. **Global handler:** The QuickSwitcher component listens for `keydown` events globally, so this integrates seamlessly

The event structure matches the global keyboard listener:
```typescript
new KeyboardEvent("keydown", {
  key: "k",
  metaKey: true,  // Cmd on Mac, Ctrl on Windows
  bubbles: true,  // Propagates to document listeners
});
```

### Horizontal Scroll UX

The recently visited carousel uses native browser horizontal scrolling rather than custom carousel controls (prev/next buttons) because:

1. **Simplicity:** No state management for current slide index
2. **Native feel:** Users can drag/scroll naturally, works with trackpad gestures
3. **Accessibility:** Keyboard users can Tab through cards, screen readers announce all items
4. **Mobile-friendly:** Touch/swipe gestures work automatically

For desktop users without a horizontal scroll wheel, the cards are still visible — they just need to drag or use keyboard navigation.

---

**Last Updated:** 2026-02-22
