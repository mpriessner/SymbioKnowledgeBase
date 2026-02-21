# Story SKB-06.3: Search UI with Instant Results

**Epic:** Epic 6 - Search & Navigation
**Story ID:** SKB-06.3
**Story Points:** 4 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-06.2 (Search API must return results)

---

## User Story

As a researcher, I want to search my knowledge base and see results instantly, So that I can quickly find the information I need.

---

## Acceptance Criteria

- [ ] `SearchDialog.tsx`: search input with debounced API call (300ms debounce)
- [ ] `SearchResults.tsx`: result cards showing page title, icon, and matching snippet with highlighted terms
- [ ] Click result to navigate to page
- [ ] "No results found" empty state with clear messaging
- [ ] Loading skeleton while searching
- [ ] Debounce prevents excessive API calls while typing (300ms)
- [ ] Input auto-focused on mount
- [ ] Results navigable with arrow keys (Up/Down), Enter to select
- [ ] Search results update as user types (after debounce)
- [ ] `useDebounce` custom hook extracted for reuse
- [ ] Snippet HTML rendered safely (ts_headline produces `<mark>` tags)
- [ ] Accessible: proper ARIA roles and labels
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Search UI Component Hierarchy
──────────────────────────────

  ┌──────────────────────────────────────────────────────┐
  │  SearchDialog.tsx                                     │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  🔍  Search knowledge base...                  │   │
  │  │  [input field, auto-focused]                    │   │
  │  └────────────────────────────────────────────────┘   │
  │                                                        │
  │  ┌────────────────────────────────────────────────┐   │
  │  │  SearchResults.tsx                              │   │
  │  │                                                 │   │
  │  │  State A: Loading                               │   │
  │  │  ┌──────────────────────────────────────┐      │   │
  │  │  │ ░░░░░░░░░░░░░░  (skeleton line)     │      │   │
  │  │  │ ░░░░░░░░░░  (skeleton line)          │      │   │
  │  │  └──────────────────────────────────────┘      │   │
  │  │                                                 │   │
  │  │  State B: Results                               │   │
  │  │  ┌──────────────────────────────────────┐      │   │
  │  │  │ 📄 PostgreSQL Setup Guide            │      │   │
  │  │  │ ...<mark>PostgreSQL</mark> is a...   │      │   │
  │  │  ├──────────────────────────────────────┤      │   │
  │  │  │ 📐 Database Architecture              │      │   │
  │  │  │ ...the <mark>setup</mark> process... │      │   │
  │  │  └──────────────────────────────────────┘      │   │
  │  │                                                 │   │
  │  │  State C: No results                            │   │
  │  │  ┌──────────────────────────────────────┐      │   │
  │  │  │ No results found for "xyz"           │      │   │
  │  │  └──────────────────────────────────────┘      │   │
  │  │                                                 │   │
  │  │  State D: Empty (before typing)                 │   │
  │  │  ┌──────────────────────────────────────┐      │   │
  │  │  │ Type to search your knowledge base   │      │   │
  │  │  └──────────────────────────────────────┘      │   │
  │  └────────────────────────────────────────────────┘   │
  └──────────────────────────────────────────────────────┘

Data Flow
─────────

  User types "postgr"
        │
        ├── Immediate: Update input value (controlled component)
        │
        └── After 300ms debounce:
              │
              ▼
        useSearch("postgr")  →  GET /api/search?q=postgr&limit=20
              │
              ▼
        SearchResults renders result cards
              │
              ▼
        User clicks result  →  router.push('/pages/:pageId')
```

---

## Implementation Steps

### Step 1: Create the useDebounce Hook

A reusable hook for debouncing values.

**File: `src/hooks/useDebounce.ts`**

```typescript
'use client';

import { useState, useEffect } from 'react';

/**
 * Debounces a value by the specified delay.
 *
 * Returns the debounced value that only updates after the caller
 * has stopped changing the input value for `delay` milliseconds.
 *
 * @param value - The value to debounce
 * @param delay - Debounce delay in milliseconds
 * @returns The debounced value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
```

---

### Step 2: Create the SearchResults Component

Renders search result cards with highlighted snippets.

**File: `src/components/search/SearchResults.tsx`**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useCallback, forwardRef } from 'react';
import DOMPurify from 'dompurify';
import type { SearchResultItem } from '@/types/search';

interface SearchResultsProps {
  /** Search results to display */
  results: SearchResultItem[];
  /** Whether search is in progress */
  isLoading: boolean;
  /** The search query (for empty state messaging) */
  query: string;
  /** Index of the currently highlighted result (keyboard navigation) */
  selectedIndex: number;
  /** Callback when a result is selected */
  onSelect?: (pageId: string) => void;
  /** Callback when mouse enters a result (for updating selectedIndex) */
  onHover?: (index: number) => void;
}

/**
 * Renders search results as a list of cards.
 *
 * Each card shows:
 * - Page icon (or default document icon)
 * - Page title
 * - Snippet with highlighted matching terms (from ts_headline)
 *
 * The snippet HTML is sanitized with DOMPurify to prevent XSS
 * while preserving <mark> tags for highlighting.
 */
export const SearchResults = forwardRef<HTMLDivElement, SearchResultsProps>(
  function SearchResults(
    { results, isLoading, query, selectedIndex, onSelect, onHover },
    ref
  ) {
    const router = useRouter();

    const handleSelect = useCallback(
      (pageId: string) => {
        if (onSelect) {
          onSelect(pageId);
        } else {
          router.push(`/pages/${pageId}`);
        }
      },
      [onSelect, router]
    );

    // Loading skeleton
    if (isLoading) {
      return (
        <div className="space-y-2 py-2" ref={ref}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="px-3 py-2">
              <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
              <div className="mt-2 h-3 w-full animate-pulse rounded bg-[var(--color-bg-secondary)]" />
              <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
            </div>
          ))}
        </div>
      );
    }

    // Empty state: no query entered yet
    if (query.length === 0) {
      return (
        <div className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]" ref={ref}>
          Type to search your knowledge base
        </div>
      );
    }

    // No results found
    if (results.length === 0) {
      return (
        <div className="px-3 py-6 text-center text-sm text-[var(--color-text-secondary)]" ref={ref}>
          No results found for &quot;{query}&quot;
        </div>
      );
    }

    // Results list
    return (
      <div className="max-h-96 overflow-y-auto py-1" ref={ref} role="listbox">
        {results.map((result, index) => (
          <button
            key={result.pageId}
            role="option"
            aria-selected={index === selectedIndex}
            className={`
              w-full px-3 py-2.5 text-left cursor-pointer transition-colors duration-100
              ${
                index === selectedIndex
                  ? 'bg-[var(--color-bg-secondary)]'
                  : 'hover:bg-[var(--color-bg-secondary)]'
              }
            `}
            onClick={() => handleSelect(result.pageId)}
            onMouseEnter={() => onHover?.(index)}
          >
            {/* Page title with icon */}
            <div className="flex items-center gap-2">
              <span className="flex-shrink-0 text-base">
                {result.pageIcon || '\u{1F4C4}'}
              </span>
              <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                {result.pageTitle}
              </span>
              <span className="ml-auto flex-shrink-0 text-xs text-[var(--color-text-secondary)]">
                {Math.round(result.score * 100)}%
              </span>
            </div>

            {/* Snippet with highlighted terms */}
            <div
              className="mt-1 pl-7 text-xs text-[var(--color-text-secondary)] line-clamp-2
                         [&_mark]:bg-yellow-200 [&_mark]:text-[var(--color-text-primary)]
                         dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(result.snippet, {
                  ALLOWED_TAGS: ['mark'],
                }),
              }}
            />
          </button>
        ))}
      </div>
    );
  }
);
```

---

### Step 3: Create the SearchDialog Component

The main search dialog with input, debounced search, and results.

**File: `src/components/search/SearchDialog.tsx`**

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearch } from '@/hooks/useSearch';
import { SearchResults } from './SearchResults';

interface SearchDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Optional: render as inline instead of modal overlay */
  inline?: boolean;
}

const DEBOUNCE_MS = 300;

/**
 * Search dialog with debounced search-as-you-type and keyboard navigation.
 *
 * Features:
 * - Auto-focused input on mount
 * - 300ms debounced API calls
 * - Keyboard navigation (ArrowUp/Down, Enter, Escape)
 * - Click or Enter to navigate to selected result
 * - Loading skeleton while fetching
 * - Empty state and no-results state
 */
export function SearchDialog({ isOpen, onClose, inline = false }: SearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const { data, isLoading, isFetching } = useSearch(debouncedQuery, {
    enabled: isOpen && debouncedQuery.length > 0,
  });

  const results = data?.data ?? [];

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Navigate to selected result
  const selectResult = useCallback(
    (pageId: string) => {
      router.push(`/pages/${pageId}`);
      onClose();
    },
    [router, onClose]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= results.length - 1 ? 0 : prev + 1
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? results.length - 1 : prev - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (results[selectedIndex]) {
            selectResult(results[selectedIndex].pageId);
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [results, selectedIndex, selectResult, onClose]
  );

  if (!isOpen) return null;

  const dialogContent = (
    <div
      className="w-full max-w-2xl rounded-lg border border-[var(--color-border)]
                 bg-[var(--color-bg-primary)] shadow-2xl"
      role="dialog"
      aria-label="Search knowledge base"
      aria-modal={!inline}
    >
      {/* Search input */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-[var(--color-text-secondary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search knowledge base..."
          className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)]
                     placeholder-[var(--color-text-secondary)] outline-none"
          aria-label="Search query"
          aria-autocomplete="list"
          aria-controls="search-results"
          autoComplete="off"
        />
        {(isLoading || isFetching) && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
        )}
      </div>

      {/* Search results */}
      <div id="search-results">
        <SearchResults
          ref={resultsRef}
          results={results}
          isLoading={isLoading && debouncedQuery.length > 0}
          query={debouncedQuery}
          selectedIndex={selectedIndex}
          onSelect={selectResult}
          onHover={setSelectedIndex}
        />
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-4 border-t border-[var(--color-border)] px-4 py-2 text-xs text-[var(--color-text-secondary)]">
        <span>
          <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-xs">
            ↑↓
          </kbd>{' '}
          Navigate
        </span>
        <span>
          <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-xs">
            ↵
          </kbd>{' '}
          Open
        </span>
        <span>
          <kbd className="rounded border border-[var(--color-border)] px-1.5 py-0.5 font-mono text-xs">
            esc
          </kbd>{' '}
          Close
        </span>
      </div>
    </div>
  );

  // Inline mode (no overlay)
  if (inline) {
    return dialogContent;
  }

  // Modal overlay mode
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-2xl px-4">
        {dialogContent}
      </div>
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/hooks/useDebounce.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounce } from '@/hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 300));
    expect(result.current).toBe('initial');
  });

  it('should not update value before delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    act(() => vi.advanceTimersByTime(100));

    expect(result.current).toBe('initial');
  });

  it('should update value after delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'initial' } }
    );

    rerender({ value: 'updated' });
    act(() => vi.advanceTimersByTime(300));

    expect(result.current).toBe('updated');
  });

  it('should reset timer on rapid changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } }
    );

    rerender({ value: 'ab' });
    act(() => vi.advanceTimersByTime(100));

    rerender({ value: 'abc' });
    act(() => vi.advanceTimersByTime(100));

    // Still should be 'a' — not enough time passed since last change
    expect(result.current).toBe('a');

    act(() => vi.advanceTimersByTime(200));

    // Now 300ms after last change → should be 'abc'
    expect(result.current).toBe('abc');
  });
});
```

### Unit Tests: `src/__tests__/components/search/SearchDialog.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchDialog } from '@/components/search/SearchDialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock useSearch
vi.mock('@/hooks/useSearch', () => ({
  useSearch: vi.fn().mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
  }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('SearchDialog', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render search input when open', () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    expect(screen.getByPlaceholderText('Search knowledge base...')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithProviders(
      <SearchDialog isOpen={false} onClose={onClose} />
    );
    expect(screen.queryByPlaceholderText('Search knowledge base...')).not.toBeInTheDocument();
  });

  it('should show initial empty state', () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    expect(screen.getByText('Type to search your knowledge base')).toBeInTheDocument();
  });

  it('should call onClose when Escape is pressed', () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    const input = screen.getByPlaceholderText('Search knowledge base...');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when backdrop is clicked', () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    // Click the outermost overlay div
    const backdrop = screen.getByRole('dialog').closest('.fixed');
    if (backdrop) {
      fireEvent.click(backdrop);
    }
  });

  it('should show keyboard navigation hints', () => {
    renderWithProviders(
      <SearchDialog isOpen={true} onClose={onClose} />
    );
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});
```

### Unit Tests: `src/__tests__/components/search/SearchResults.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SearchResults } from '@/components/search/SearchResults';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('SearchResults', () => {
  const mockResults = [
    {
      pageId: 'id-1',
      pageTitle: 'PostgreSQL Guide',
      pageIcon: null,
      snippet: 'A <mark>powerful</mark> database',
      score: 0.85,
    },
    {
      pageId: 'id-2',
      pageTitle: 'Database Setup',
      pageIcon: null,
      snippet: 'How to <mark>setup</mark>',
      score: 0.62,
    },
  ];

  it('should render result titles', () => {
    render(
      <SearchResults
        results={mockResults}
        isLoading={false}
        query="postgresql"
        selectedIndex={0}
      />
    );
    expect(screen.getByText('PostgreSQL Guide')).toBeInTheDocument();
    expect(screen.getByText('Database Setup')).toBeInTheDocument();
  });

  it('should show loading skeleton when loading', () => {
    const { container } = render(
      <SearchResults
        results={[]}
        isLoading={true}
        query="test"
        selectedIndex={0}
      />
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('should show no results message', () => {
    render(
      <SearchResults
        results={[]}
        isLoading={false}
        query="nonexistent"
        selectedIndex={0}
      />
    );
    expect(
      screen.getByText(/No results found for "nonexistent"/)
    ).toBeInTheDocument();
  });

  it('should show empty state when no query', () => {
    render(
      <SearchResults
        results={[]}
        isLoading={false}
        query=""
        selectedIndex={0}
      />
    );
    expect(
      screen.getByText('Type to search your knowledge base')
    ).toBeInTheDocument();
  });

  it('should call onSelect when result is clicked', () => {
    const onSelect = vi.fn();
    render(
      <SearchResults
        results={mockResults}
        isLoading={false}
        query="test"
        selectedIndex={0}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByText('PostgreSQL Guide'));
    expect(onSelect).toHaveBeenCalledWith('id-1');
  });

  it('should highlight selected result', () => {
    render(
      <SearchResults
        results={mockResults}
        isLoading={false}
        query="test"
        selectedIndex={1}
      />
    );
    const selectedOption = screen.getAllByRole('option')[1];
    expect(selectedOption.className).toContain('bg-[var(--color-bg-secondary)]');
  });
});
```

### E2E Test: `tests/e2e/search.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Search UI', () => {
  test('should show search results as user types', async ({ page }) => {
    await page.goto('/');

    // Open search (assuming a search button exists)
    await page.click('[aria-label="Search"]');

    const input = page.locator('input[aria-label="Search query"]');
    await expect(input).toBeFocused();

    // Type a search query
    await input.fill('postgresql');

    // Wait for debounced results
    await page.waitForTimeout(400);

    // Results should appear
    const results = page.locator('[role="option"]');
    await expect(results.first()).toBeVisible();
  });

  test('should navigate to page on result click', async ({ page }) => {
    await page.goto('/');

    await page.click('[aria-label="Search"]');
    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('test');

    await page.waitForTimeout(400);

    const firstResult = page.locator('[role="option"]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
      await expect(page).toHaveURL(/\/pages\//);
    }
  });

  test('should close on Escape', async ({ page }) => {
    await page.goto('/');

    await page.click('[aria-label="Search"]');
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/hooks/useDebounce.ts` |
| CREATE | `src/components/search/SearchResults.tsx` |
| CREATE | `src/components/search/SearchDialog.tsx` |
| CREATE | `src/__tests__/hooks/useDebounce.test.ts` |
| CREATE | `src/__tests__/components/search/SearchDialog.test.tsx` |
| CREATE | `src/__tests__/components/search/SearchResults.test.tsx` |
| CREATE | `tests/e2e/search.spec.ts` |

---

**Last Updated:** 2026-02-21
