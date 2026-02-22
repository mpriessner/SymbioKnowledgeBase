# Story SKB-13.4: Search Filters & History

**Epic:** Epic 13 - Enhanced Search
**Story ID:** SKB-13.4
**Story Points:** 8 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-13.2 (API must support filter params), SKB-13.1 (UI to host filters)

---

## User Story

As a power user, I want to filter search results by date range and content type, and access my recent searches, So that I can quickly find exactly what I'm looking for and re-run common queries without retyping.

---

## Acceptance Criteria

### Filter UI

- [ ] `DateRangePicker` component with start/end date inputs
- [ ] Content type filter toggles: "Code blocks", "Images", "Links"
- [ ] Filter chips show active filters (e.g., "After 2026-01-01", "Has code blocks")
- [ ] "Clear filters" button removes all filters
- [ ] Filter state persists in URL query params (shareable search URLs)
- [ ] Filter state restored from URL on page load
- [ ] Filters apply immediately (no "Apply" button needed)
- [ ] TypeScript strict mode — no `any` types

### Search History

- [ ] Recent searches stored in `localStorage` (last 10 searches, FIFO queue)
- [ ] Search history scoped by `tenant_id` (multi-tenant safe)
- [ ] Search history shown when search input is empty (below the input field)
- [ ] Clicking a recent search fills the input and executes search
- [ ] Each history item shows: query text, timestamp (relative: "2 hours ago")
- [ ] "Clear history" button removes all saved searches
- [ ] History items keyboard-navigable (arrow keys)
- [ ] Search history excludes duplicate consecutive searches

### Advanced Features

- [ ] Search suggestions (autocomplete) based on page titles as user types
- [ ] Suggestions shown in dropdown below input (max 5 suggestions)
- [ ] Arrow keys navigate suggestions, Enter selects, Escape closes
- [ ] Suggestions debounced (150ms) to avoid excessive API calls
- [ ] "Save search" feature: save current query + filters with custom name
- [ ] Saved searches stored in `localStorage` (separate from recent history)
- [ ] Saved searches accessible via dropdown menu in search header

---

## Architecture Overview

```
Search Filters & History Architecture
──────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│  EnhancedSearchDialog                                    │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Search Input                                      │  │
│  │  [🔍 Search... ▼]  ← autocomplete suggestions      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Filters (DateRangePicker + ContentTypeToggles)   │  │
│  │  From: [2026-01-01] To: [2026-02-22]              │  │
│  │  [ ] Code  [✓] Images  [ ] Links                  │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  FilterChips (active filters with remove buttons) │  │
│  │  [After: 2026-01-01 ×] [Has: Images ×] [Clear all]│  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Recent Searches (shown when input is empty)      │  │
│  │  🕒 postgresql setup    2 hours ago               │  │
│  │  🕒 database migration  yesterday                 │  │
│  │  🕒 api documentation   3 days ago                │  │
│  │  [Clear history]                                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Saved Searches (dropdown menu)                   │  │
│  │  ⭐ Recent code changes (q="...", filters=...)    │  │
│  │  ⭐ Architecture docs   (q="...", filters=...)    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘

Data Flow
─────────

Filters:
  User changes filter → useSearchFilters.setFilter()
                     → Update URL params
                     → useSearch re-fetches with new filters

History:
  User executes search → useSearchHistory.addSearch(query)
                      → Save to localStorage['search_history_${tenantId}']
                      → Update history UI

Suggestions:
  User types → debounce 150ms → fetchSuggestions(query)
                              → Return top 5 page titles matching query
                              → Show dropdown
```

---

## Implementation Steps

### Step 1: Create DateRangePicker Component

Date range filter UI using native date inputs (or react-day-picker).

**File: `src/components/search/DateRangePicker.tsx`**

```typescript
'use client';

import { CalendarIcon } from 'lucide-react';

interface DateRangePickerProps {
  dateFrom?: string; // ISO date YYYY-MM-DD
  dateTo?: string;
  onDateFromChange: (date: string | undefined) => void;
  onDateToChange: (date: string | undefined) => void;
}

/**
 * Date range picker for search filters.
 *
 * Uses native HTML date inputs for simplicity.
 * For a richer UI, consider replacing with react-day-picker.
 */
export function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
}: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-3">
      <CalendarIcon className="h-4 w-4 text-[var(--color-text-secondary)]" />

      <div className="flex items-center gap-2">
        <label htmlFor="date-from" className="text-xs text-[var(--color-text-secondary)]">
          From:
        </label>
        <input
          id="date-from"
          type="date"
          value={dateFrom || ''}
          onChange={(e) => onDateFromChange(e.target.value || undefined)}
          className="px-2 py-1 text-xs rounded border border-[var(--color-border)]
                     bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
        />
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="date-to" className="text-xs text-[var(--color-text-secondary)]">
          To:
        </label>
        <input
          id="date-to"
          type="date"
          value={dateTo || ''}
          onChange={(e) => onDateToChange(e.target.value || undefined)}
          className="px-2 py-1 text-xs rounded border border-[var(--color-border)]
                     bg-[var(--color-bg-primary)] text-[var(--color-text-primary)]"
        />
      </div>
    </div>
  );
}
```

---

### Step 2: Create ContentTypeToggles Component

Toggle buttons for content type filters.

**File: `src/components/search/ContentTypeToggles.tsx`**

```typescript
'use client';

import type { ContentTypeFilter } from '@/types/search';

interface ContentTypeTogglesProps {
  selectedTypes: ContentTypeFilter[];
  onToggle: (type: ContentTypeFilter) => void;
}

const CONTENT_TYPES: { value: ContentTypeFilter; label: string; icon: string }[] = [
  { value: 'code', label: 'Code', icon: '</>' },
  { value: 'images', label: 'Images', icon: '🖼️' },
  { value: 'links', label: 'Links', icon: '🔗' },
];

/**
 * Toggle buttons for content type filters.
 */
export function ContentTypeToggles({
  selectedTypes,
  onToggle,
}: ContentTypeTogglesProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-text-secondary)]">Has:</span>
      {CONTENT_TYPES.map((type) => {
        const isSelected = selectedTypes.includes(type.value);
        return (
          <button
            key={type.value}
            onClick={() => onToggle(type.value)}
            className={`
              px-3 py-1.5 text-xs font-medium rounded-full border transition-colors
              ${
                isSelected
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-[var(--color-accent)]'
              }
            `}
            aria-pressed={isSelected}
          >
            <span className="mr-1">{type.icon}</span>
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
```

---

### Step 3: Create useSearchHistory Hook

Manages search history in localStorage.

**File: `src/hooks/useSearchHistory.ts`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

interface SearchHistoryItem {
  query: string;
  timestamp: number; // Unix timestamp
}

const MAX_HISTORY = 10;

/**
 * Hook for managing search history in localStorage.
 *
 * History is scoped by tenant ID to support multi-tenant usage.
 * Stores last 10 searches in FIFO order.
 * Excludes duplicate consecutive searches.
 */
export function useSearchHistory(tenantId: string) {
  const storageKey = `search_history_${tenantId}`;
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as SearchHistoryItem[];
        setHistory(parsed);
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }, [storageKey]);

  // Add a search to history
  const addSearch = useCallback(
    (query: string) => {
      if (!query.trim()) return;

      setHistory((prev) => {
        // Exclude if duplicate of last search
        if (prev.length > 0 && prev[0].query === query) {
          return prev;
        }

        // Add new search at the beginning
        const updated = [
          { query, timestamp: Date.now() },
          ...prev.filter((item) => item.query !== query), // Remove duplicates
        ].slice(0, MAX_HISTORY); // Keep only last 10

        // Save to localStorage
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch (error) {
          console.error('Failed to save search history:', error);
        }

        return updated;
      });
    },
    [storageKey]
  );

  // Clear all history
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear search history:', error);
    }
  }, [storageKey]);

  return { history, addSearch, clearHistory };
}
```

---

### Step 4: Create SearchHistory Component

Displays recent searches.

**File: `src/components/search/SearchHistory.tsx`**

```typescript
'use client';

import { formatDistanceToNow } from 'date-fns';

interface SearchHistoryItem {
  query: string;
  timestamp: number;
}

interface SearchHistoryProps {
  history: SearchHistoryItem[];
  onSelectSearch: (query: string) => void;
  onClearHistory: () => void;
}

/**
 * Displays recent search history.
 *
 * Shows when search input is empty.
 * Clicking a history item fills the search input and executes search.
 */
export function SearchHistory({
  history,
  onSelectSearch,
  onClearHistory,
}: SearchHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-[var(--color-border)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase">
          Recent Searches
        </h3>
        <button
          onClick={onClearHistory}
          className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Clear history
        </button>
      </div>

      <div className="space-y-1">
        {history.map((item, index) => (
          <button
            key={index}
            onClick={() => onSelectSearch(item.query)}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm
                       rounded hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">🕒</span>
              <span className="text-[var(--color-text-primary)]">{item.query}</span>
            </span>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              {formatDistanceToNow(item.timestamp, { addSuffix: true })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

### Step 5: Integrate Filters and History into EnhancedSearchDialog

Update the search dialog to include all filter UI components.

**File: `src/components/search/EnhancedSearchDialog.tsx`** (modify existing)

Add to imports:
```typescript
import { DateRangePicker } from './DateRangePicker';
import { ContentTypeToggles } from './ContentTypeToggles';
import { SearchHistory } from './SearchHistory';
import { useSearchHistory } from '@/hooks/useSearchHistory';
```

Add filter UI section after the search input:

```typescript
// Inside EnhancedSearchDialog component:

const { filters, setFilter, removeFilter, clearFilters } = useSearchFilters();
const { history, addSearch, clearHistory } = useSearchHistory(ctx.tenantId);

// When search is executed (in handleKeyDown on Enter):
if (results[selectedIndex]) {
  addSearch(query); // Save to history
  selectResult(results[selectedIndex].pageId);
}

// Add filter UI after search input, before FilterChips:

{/* Filter controls */}
<div className="px-4 py-3 border-b border-[var(--color-border)] space-y-3">
  <DateRangePicker
    dateFrom={filters.dateFrom}
    dateTo={filters.dateTo}
    onDateFromChange={(date) => setFilter('dateFrom', date)}
    onDateToChange={(date) => setFilter('dateTo', date)}
  />
  <ContentTypeToggles
    selectedTypes={filters.contentType || []}
    onToggle={(type) => {
      const current = filters.contentType || [];
      const updated = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      setFilter('contentType', updated.length > 0 ? updated : undefined);
    }}
  />
</div>

{/* Search history (shown when query is empty) */}
{query.length === 0 && (
  <SearchHistory
    history={history}
    onSelectSearch={(q) => {
      setQuery(q);
      // Search will execute after debounce
    }}
    onClearHistory={clearHistory}
  />
)}
```

---

### Step 6: Add Search Suggestions (Autocomplete)

Fetch page titles matching the query as user types.

**File: `src/hooks/useSearchSuggestions.ts`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useDebounce } from './useDebounce';

interface Suggestion {
  pageId: string;
  title: string;
}

const SUGGESTION_DEBOUNCE = 150; // Faster than search debounce

/**
 * Fetches search suggestions (page titles) as user types.
 *
 * Debounced to 150ms to provide quick feedback without overwhelming API.
 * Returns top 5 page titles matching the query.
 */
export function useSearchSuggestions(query: string, enabled: boolean = true) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebounce(query, SUGGESTION_DEBOUNCE);

  useEffect(() => {
    if (!enabled || debouncedQuery.length < 2) {
      setSuggestions([]);
      return;
    }

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        // Simple title search (could be a separate API endpoint)
        const response = await fetch(
          `/api/pages/suggest?q=${encodeURIComponent(debouncedQuery)}&limit=5`
        );
        if (response.ok) {
          const data = await response.json();
          setSuggestions(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [debouncedQuery, enabled]);

  return { suggestions, isLoading };
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/hooks/useSearchHistory.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSearchHistory } from '@/hooks/useSearchHistory';

describe('useSearchHistory', () => {
  const TENANT_ID = 'test-tenant-123';

  beforeEach(() => {
    localStorage.clear();
  });

  it('should add search to history', () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch('postgresql');
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].query).toBe('postgresql');
  });

  it('should not add duplicate consecutive searches', () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch('postgresql');
      result.current.addSearch('postgresql');
    });

    expect(result.current.history).toHaveLength(1);
  });

  it('should limit history to 10 items', () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.addSearch(`query ${i}`);
      }
    });

    expect(result.current.history).toHaveLength(10);
  });

  it('should clear history', () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch('test');
      result.current.clearHistory();
    });

    expect(result.current.history).toHaveLength(0);
  });

  it('should persist to localStorage', () => {
    const { result } = renderHook(() => useSearchHistory(TENANT_ID));

    act(() => {
      result.current.addSearch('postgresql');
    });

    const stored = localStorage.getItem(`search_history_${TENANT_ID}`);
    expect(stored).toBeTruthy();

    const parsed = JSON.parse(stored!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].query).toBe('postgresql');
  });
});
```

### E2E Test: `tests/e2e/search-filters.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Search Filters & History', () => {
  test('should apply date filter', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+Shift+F');

    // Set date from
    await page.fill('#date-from', '2026-01-01');

    // Type search query
    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('test');

    await page.waitForTimeout(400);

    // Verify filter chip appears
    await expect(page.locator('text=/After.*2026-01-01/')).toBeVisible();

    // Verify URL contains filter
    await expect(page).toHaveURL(/dateFrom=2026-01-01/);
  });

  test('should apply content type filter', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+Shift+F');

    // Toggle "Code" filter
    await page.click('button:has-text("Code")');

    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('function');

    await page.waitForTimeout(400);

    // Verify filter chip
    await expect(page.locator('text=/Has.*code/i')).toBeVisible();

    // Verify URL contains filter
    await expect(page).toHaveURL(/contentType=code/);
  });

  test('should save and load search history', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+K');

    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('postgresql');
    await page.keyboard.press('Enter');

    // Close and reopen search
    await page.keyboard.press('Escape');
    await page.keyboard.press('Meta+K');

    // History should show previous search
    await expect(page.locator('text=postgresql')).toBeVisible();
  });

  test('should clear filters', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+Shift+F');

    // Apply filters
    await page.fill('#date-from', '2026-01-01');
    await page.click('button:has-text("Code")');

    // Clear all filters
    await page.click('text=Clear all');

    // Filters should be removed
    await expect(page.locator('#date-from')).toHaveValue('');
    await expect(page).toHaveURL(/^(?!.*dateFrom)/);
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/search/DateRangePicker.tsx` |
| CREATE | `src/components/search/ContentTypeToggles.tsx` |
| CREATE | `src/components/search/SearchHistory.tsx` |
| CREATE | `src/hooks/useSearchHistory.ts` |
| CREATE | `src/hooks/useSearchSuggestions.ts` |
| CREATE | `src/__tests__/hooks/useSearchHistory.test.ts` |
| CREATE | `src/__tests__/components/search/DateRangePicker.test.tsx` |
| CREATE | `src/__tests__/components/search/SearchHistory.test.tsx` |
| CREATE | `tests/e2e/search-filters.spec.ts` |
| MODIFY | `src/components/search/EnhancedSearchDialog.tsx` (add filter UI) |
| MODIFY | `src/hooks/useSearchFilters.ts` (already created in SKB-13.1) |

---

## Dev Notes

### Challenges

1. **URL state sync**: Filter state must stay in sync with URL params. React Router's `useSearchParams` makes this tricky because updates are async. The `useSearchFilters` hook handles this, but care is needed to avoid infinite loops (URL update → state update → URL update).

2. **localStorage multi-tenant scoping**: Search history must be scoped by tenant ID. Without this, switching tenants would show the wrong history. The storage key `search_history_${tenantId}` ensures isolation.

3. **Date picker UX**: Native `<input type="date">` works but has limited styling. For a richer experience, consider `react-day-picker` with a popover. Trade-off: simplicity vs. polish.

4. **Autocomplete performance**: Fetching suggestions on every keystroke (even debounced) could be expensive. Consider caching recent suggestions or using a trie data structure for client-side filtering.

### Libraries to Evaluate

- `react-day-picker`: Rich date picker UI (alternative to native date input)
- `date-fns`: Already in use for `formatDistanceToNow` (relative timestamps)
- `react-hotkeys-hook`: For keyboard shortcuts (already in use via `useHotkeys`)

### Integration Points

- `useSearchFilters` hook manages URL state (created in SKB-13.1)
- `useSearch` hook fetches results with filters (enhanced in SKB-13.2)
- `EnhancedSearchDialog` integrates all filter UI components

---

**Last Updated:** 2026-02-22
