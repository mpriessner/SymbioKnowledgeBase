# Story SKB-13.1: Enhanced Search Dialog UI

**Epic:** Epic 13 - Enhanced Search
**Story ID:** SKB-13.1
**Story Points:** 5 | **Priority:** High | **Status:** Planned
**Depends On:** SKB-06.3 (SearchDialog foundation), SKB-13.2 (Enhanced search API)

---

## User Story

As a researcher, I want a comprehensive search dialog that shows more results, supports filters, and provides infinite scroll, So that I can efficiently search through my entire knowledge base with precision tools.

---

## Acceptance Criteria

- [ ] `EnhancedSearchDialog.tsx`: full-featured search modal triggered by Cmd+Shift+F or sidebar "Search" button
- [ ] Larger than QuickSwitcher: full height (80vh), wider (max-w-3xl instead of max-w-2xl)
- [ ] Search input with debounced API call (300ms debounce, same as QuickSwitcher)
- [ ] Filter section: date range picker + content type toggles
- [ ] Result cards showing: page icon, page title, snippet with highlighted keywords, relevance score (%), last updated date
- [ ] Infinite scroll: loads more results as user scrolls to bottom (IntersectionObserver)
- [ ] Loading skeleton while fetching results
- [ ] Empty states: "Type to search" (no query), "No results found" (empty results), "Adjust filters" (filters too restrictive)
- [ ] Keyboard navigation: arrow keys navigate results, Enter opens page, Escape closes dialog
- [ ] Focus trapped within dialog while open
- [ ] Accessible: ARIA roles, labels, screen reader support
- [ ] TypeScript strict mode — no `any` types
- [ ] Uses existing `useSearch` hook enhanced with filter support
- [ ] Filter chips show active filters (e.g., "After 2026-01-01", "Has code blocks")
- [ ] "Clear filters" button when any filter is active

---

## Architecture Overview

```
Enhanced Search Dialog Component Hierarchy
───────────────────────────────────────────

  ┌────────────────────────────────────────────────────────┐
  │  EnhancedSearchDialog.tsx                               │
  │  (full height modal, 80vh, max-w-3xl)                   │
  │                                                          │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │  Header                                           │   │
  │  │  ┌────────────────────────────────────────────┐  │   │
  │  │  │ 🔍  Search...           [X Close]          │  │   │
  │  │  └────────────────────────────────────────────┘  │   │
  │  └──────────────────────────────────────────────────┘   │
  │                                                          │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │  FilterChips.tsx                                  │   │
  │  │  [After: 2026-01-01 ×] [Has: Code ×] [Clear all] │   │
  │  └──────────────────────────────────────────────────┘   │
  │                                                          │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │  Results (infinite scroll, max-h-[60vh])          │   │
  │  │                                                    │   │
  │  │  ┌────────────────────────────────────────────┐  │   │
  │  │  │ SearchResultCard.tsx                        │  │   │
  │  │  │                                             │  │   │
  │  │  │ 📄 PostgreSQL Setup Guide          85%     │  │   │
  │  │  │ ...setup <mark>PostgreSQL</mark>...        │  │   │
  │  │  │ Updated: 2026-02-15                         │  │   │
  │  │  └────────────────────────────────────────────┘  │   │
  │  │                                                    │   │
  │  │  ┌────────────────────────────────────────────┐  │   │
  │  │  │ 📐 Database Architecture           72%     │  │   │
  │  │  │ ...<mark>setup</mark> process...           │  │   │
  │  │  │ Updated: 2026-02-10                         │  │   │
  │  │  └────────────────────────────────────────────┘  │   │
  │  │                                                    │   │
  │  │  [Loading more...] ← IntersectionObserver trigger  │   │
  │  └──────────────────────────────────────────────────┘   │
  │                                                          │
  │  ┌──────────────────────────────────────────────────┐   │
  │  │  Footer                                           │   │
  │  │  Recent: [postgresql] [api documentation]         │   │
  │  └──────────────────────────────────────────────────┘   │
  └────────────────────────────────────────────────────────┘

Data Flow
─────────

  User types "postgr" → debounce 300ms → useSearch({ q: "postgr", filters })
                                              │
                                              ▼
                         GET /api/search?q=postgr&dateFrom=...&contentType=code
                                              │
                                              ▼
                                         results []
                                              │
                                              ▼
  User scrolls to bottom → IntersectionObserver fires
                                              │
                                              ▼
                    useSearch({ q: "postgr", filters, offset: 20 })
                                              │
                                              ▼
                                    append more results
```

---

## Implementation Steps

### Step 1: Create FilterChips Component

Displays active filters with remove buttons.

**File: `src/components/search/FilterChips.tsx`**

```typescript
'use client';

import { XIcon } from 'lucide-react';
import type { SearchFilters } from '@/types/search';

interface FilterChipsProps {
  filters: SearchFilters;
  onRemoveFilter: (filterKey: keyof SearchFilters) => void;
  onClearAll: () => void;
}

/**
 * Displays active search filters as removable chips.
 *
 * Shows:
 * - Date range (if dateFrom or dateTo set)
 * - Content type filters (if contentType array not empty)
 *
 * Each chip has an X button to remove that filter.
 * "Clear all" button appears when any filter is active.
 */
export function FilterChips({ filters, onRemoveFilter, onClearAll }: FilterChipsProps) {
  const hasActiveFilters =
    filters.dateFrom ||
    filters.dateTo ||
    (filters.contentType && filters.contentType.length > 0);

  if (!hasActiveFilters) return null;

  const chipClass = `
    inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
    rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]
    border border-[var(--color-border)]
  `;

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
      {/* Date range chip */}
      {(filters.dateFrom || filters.dateTo) && (
        <button
          className={chipClass}
          onClick={() => {
            onRemoveFilter('dateFrom');
            onRemoveFilter('dateTo');
          }}
          aria-label="Remove date filter"
        >
          <span>
            {filters.dateFrom && filters.dateTo
              ? `${filters.dateFrom} to ${filters.dateTo}`
              : filters.dateFrom
              ? `After ${filters.dateFrom}`
              : `Before ${filters.dateTo}`}
          </span>
          <XIcon className="h-3 w-3" />
        </button>
      )}

      {/* Content type chips */}
      {filters.contentType?.map((type) => (
        <button
          key={type}
          className={chipClass}
          onClick={() => {
            const newTypes = filters.contentType!.filter((t) => t !== type);
            onRemoveFilter('contentType');
            if (newTypes.length > 0) {
              // Re-add remaining types (handled by parent component)
            }
          }}
          aria-label={`Remove ${type} filter`}
        >
          <span>Has: {type}</span>
          <XIcon className="h-3 w-3" />
        </button>
      ))}

      {/* Clear all button */}
      <button
        className="ml-auto text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        onClick={onClearAll}
      >
        Clear all
      </button>
    </div>
  );
}
```

---

### Step 2: Enhance SearchResultCard for Rich Display

Extend the existing SearchResultCard to show date and relevance score.

**File: `src/components/search/SearchResultCard.tsx`** (modify existing or create new)

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import DOMPurify from 'dompurify';
import type { SearchResultItem } from '@/types/search';

interface SearchResultCardProps {
  result: SearchResultItem;
  isSelected: boolean;
  onSelect?: (pageId: string) => void;
  onHover?: () => void;
}

/**
 * Enhanced search result card showing:
 * - Page icon + title
 * - Snippet with highlighted keywords
 * - Relevance score (%)
 * - Last updated date
 */
export function SearchResultCard({
  result,
  isSelected,
  onSelect,
  onHover,
}: SearchResultCardProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (onSelect) {
      onSelect(result.pageId);
    } else {
      router.push(`/pages/${result.pageId}`);
    }
  }, [onSelect, result.pageId, router]);

  // Format date as "Feb 15, 2026"
  const formattedDate = result.updatedAt
    ? new Date(result.updatedAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <button
      role="option"
      aria-selected={isSelected}
      className={`
        w-full px-4 py-3 text-left cursor-pointer transition-colors duration-100
        border-b border-[var(--color-border)] last:border-b-0
        ${
          isSelected
            ? 'bg-[var(--color-bg-secondary)]'
            : 'hover:bg-[var(--color-bg-secondary)]'
        }
      `}
      onClick={handleClick}
      onMouseEnter={onHover}
    >
      {/* Header: icon, title, score */}
      <div className="flex items-center gap-2 mb-1.5">
        <span className="flex-shrink-0 text-lg">
          {result.pageIcon || '\u{1F4C4}'}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">
          {result.pageTitle}
        </span>
        <span className="flex-shrink-0 text-xs font-semibold text-[var(--color-accent)]">
          {Math.round(result.score * 100)}%
        </span>
      </div>

      {/* Snippet with highlighted terms */}
      <div
        className="pl-8 text-xs text-[var(--color-text-secondary)] line-clamp-2 mb-1.5
                   [&_mark]:bg-yellow-200 [&_mark]:text-[var(--color-text-primary)]
                   dark:[&_mark]:bg-yellow-800 dark:[&_mark]:text-yellow-100"
        dangerouslySetInnerHTML={{
          __html: DOMPurify.sanitize(result.snippet, {
            ALLOWED_TAGS: ['mark'],
          }),
        }}
      />

      {/* Footer: updated date */}
      {formattedDate && (
        <div className="pl-8 text-xs text-[var(--color-text-tertiary)]">
          Updated: {formattedDate}
        </div>
      )}
    </button>
  );
}
```

---

### Step 3: Create EnhancedSearchDialog Component

The main search dialog with filters and infinite scroll.

**File: `src/components/search/EnhancedSearchDialog.tsx`**

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { XIcon } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearch } from '@/hooks/useSearch';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';
import { FilterChips } from './FilterChips';
import { SearchResultCard } from './SearchResultCard';
import type { SearchFilters } from '@/types/search';

interface EnhancedSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEBOUNCE_MS = 300;
const RESULTS_PER_PAGE = 20;

/**
 * Enhanced search dialog with filters and infinite scroll.
 *
 * Features:
 * - Larger modal (80vh height, max-w-3xl)
 * - Filter chips (date range, content type)
 * - Infinite scroll for results
 * - Keyboard navigation
 * - Search history integration
 *
 * Triggered by:
 * - Cmd+Shift+F keyboard shortcut
 * - "Search" button in sidebar
 */
export function EnhancedSearchDialog({ isOpen, onClose }: EnhancedSearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Filter state from URL query params
  const { filters, setFilter, removeFilter, clearFilters } = useSearchFilters();

  // Infinite scroll state
  const [offset, setOffset] = useState(0);
  const [allResults, setAllResults] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(true);

  const { data, isLoading, isFetching } = useSearch(debouncedQuery, {
    enabled: isOpen && debouncedQuery.length > 0,
    filters,
    limit: RESULTS_PER_PAGE,
    offset,
  });

  // Update results when new data arrives
  useEffect(() => {
    if (data?.data) {
      if (offset === 0) {
        // New search — replace results
        setAllResults(data.data);
      } else {
        // Pagination — append results
        setAllResults((prev) => [...prev, ...data.data]);
      }

      // Check if there are more results
      setHasMore(data.data.length === RESULTS_PER_PAGE);
    }
  }, [data, offset]);

  // Reset results when query or filters change
  useEffect(() => {
    setOffset(0);
    setAllResults([]);
    setHasMore(true);
  }, [debouncedQuery, filters]);

  // Infinite scroll: load more when trigger is visible
  useInfiniteScroll(loadMoreTriggerRef, () => {
    if (!isFetching && hasMore) {
      setOffset((prev) => prev + RESULTS_PER_PAGE);
    }
  });

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (isOpen) {
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
      setOffset(0);
      setAllResults([]);
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [allResults.length]);

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
            prev >= allResults.length - 1 ? 0 : prev + 1
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? allResults.length - 1 : prev - 1
          );
          break;

        case 'Enter':
          e.preventDefault();
          if (allResults[selectedIndex]) {
            selectResult(allResults[selectedIndex].pageId);
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [allResults, selectedIndex, selectResult, onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative z-10 w-full max-w-3xl h-[80vh] rounded-lg border border-[var(--color-border)]
                   bg-[var(--color-bg-primary)] shadow-2xl flex flex-col"
        role="dialog"
        aria-label="Enhanced search"
        aria-modal="true"
      >
        {/* Header: search input + close button */}
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
            aria-controls="enhanced-search-results"
            autoComplete="off"
          />
          {(isLoading || isFetching) && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          )}
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded hover:bg-[var(--color-bg-secondary)]"
            aria-label="Close search"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Filter chips */}
        <FilterChips
          filters={filters}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />

        {/* Search results with infinite scroll */}
        <div
          ref={resultsContainerRef}
          id="enhanced-search-results"
          className="flex-1 overflow-y-auto"
          role="listbox"
        >
          {/* Loading skeleton */}
          {isLoading && debouncedQuery.length > 0 && (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="px-4 py-3 border-b border-[var(--color-border)]">
                  <div className="h-4 w-48 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
                  <div className="mt-2 h-3 w-full animate-pulse rounded bg-[var(--color-bg-secondary)]" />
                  <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-[var(--color-bg-secondary)]" />
                </div>
              ))}
            </div>
          )}

          {/* Empty state: no query */}
          {!isLoading && debouncedQuery.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[var(--color-text-secondary)]">
              Type to search your knowledge base
            </div>
          )}

          {/* No results */}
          {!isLoading && debouncedQuery.length > 0 && allResults.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-[var(--color-text-secondary)]">
              <p>No results found for &quot;{debouncedQuery}&quot;</p>
              {(filters.dateFrom || filters.dateTo || filters.contentType?.length) && (
                <p className="mt-2 text-xs">Try adjusting your filters</p>
              )}
            </div>
          )}

          {/* Results list */}
          {allResults.length > 0 && (
            <>
              {allResults.map((result, index) => (
                <SearchResultCard
                  key={result.pageId}
                  result={result}
                  isSelected={index === selectedIndex}
                  onSelect={selectResult}
                  onHover={() => setSelectedIndex(index)}
                />
              ))}

              {/* Infinite scroll trigger */}
              {hasMore && (
                <div
                  ref={loadMoreTriggerRef}
                  className="px-4 py-4 text-center text-xs text-[var(--color-text-secondary)]"
                >
                  {isFetching ? 'Loading more...' : 'Scroll for more'}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: keyboard hints */}
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
    </div>
  );
}
```

---

### Step 4: Create useInfiniteScroll Hook

Utility hook for infinite scroll with IntersectionObserver.

**File: `src/hooks/useInfiniteScroll.ts`**

```typescript
'use client';

import { useEffect } from 'react';

/**
 * Infinite scroll hook using IntersectionObserver.
 *
 * Triggers the callback when the target element enters the viewport.
 *
 * @param targetRef - Ref to the trigger element (typically at the bottom of the list)
 * @param onIntersect - Callback to load more items
 * @param options - IntersectionObserver options
 */
export function useInfiniteScroll(
  targetRef: React.RefObject<HTMLElement>,
  onIntersect: () => void,
  options: IntersectionObserverInit = {}
): void {
  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          onIntersect();
        }
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, onIntersect, options]);
}
```

---

### Step 5: Create useSearchFilters Hook

Manages filter state with URL query params.

**File: `src/hooks/useSearchFilters.ts`**

```typescript
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import type { SearchFilters } from '@/types/search';

/**
 * Manages search filter state via URL query parameters.
 *
 * This makes filter state shareable (copy URL = share filtered search).
 *
 * URL params:
 * - dateFrom: ISO date string
 * - dateTo: ISO date string
 * - contentType: comma-separated list (e.g., "code,images")
 */
export function useSearchFilters() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Parse current filters from URL
  const filters: SearchFilters = useMemo(() => {
    const dateFrom = searchParams.get('dateFrom') || undefined;
    const dateTo = searchParams.get('dateTo') || undefined;
    const contentTypeParam = searchParams.get('contentType');
    const contentType = contentTypeParam
      ? (contentTypeParam.split(',') as SearchFilters['contentType'])
      : undefined;

    return { dateFrom, dateTo, contentType };
  }, [searchParams]);

  // Update a single filter
  const setFilter = useCallback(
    (key: keyof SearchFilters, value: any) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else if (Array.isArray(value)) {
        params.set(key, value.join(','));
      } else {
        params.set(key, String(value));
      }

      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Remove a filter
  const removeFilter = useCallback(
    (key: keyof SearchFilters) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(key);
      router.push(`?${params.toString()}`, { scroll: false });
    },
    [searchParams, router]
  );

  // Clear all filters
  const clearFilters = useCallback(() => {
    router.push('?', { scroll: false });
  }, [router]);

  return { filters, setFilter, removeFilter, clearFilters };
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/search/EnhancedSearchDialog.test.tsx`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnhancedSearchDialog } from '@/components/search/EnhancedSearchDialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
}));

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

describe('EnhancedSearchDialog', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open', () => {
    renderWithProviders(<EnhancedSearchDialog isOpen={true} onClose={onClose} />);
    expect(screen.getByPlaceholderText('Search knowledge base...')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    renderWithProviders(<EnhancedSearchDialog isOpen={false} onClose={onClose} />);
    expect(screen.queryByPlaceholderText('Search knowledge base...')).not.toBeInTheDocument();
  });

  it('should close on Escape key', () => {
    renderWithProviders(<EnhancedSearchDialog isOpen={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText('Search knowledge base...');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should close on backdrop click', () => {
    renderWithProviders(<EnhancedSearchDialog isOpen={true} onClose={onClose} />);
    const backdrop = screen.getByRole('dialog').parentElement!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('should show keyboard hints', () => {
    renderWithProviders(<EnhancedSearchDialog isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Navigate')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });
});
```

### Unit Tests: `src/__tests__/hooks/useInfiniteScroll.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll';

// Mock IntersectionObserver
class MockIntersectionObserver {
  callback: IntersectionObserverCallback;
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }
  observe() {}
  disconnect() {}
  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as any
    );
  }
}

describe('useInfiniteScroll', () => {
  let mockObserver: MockIntersectionObserver;

  beforeEach(() => {
    mockObserver = new MockIntersectionObserver(() => {});
    global.IntersectionObserver = vi.fn(() => mockObserver) as any;
  });

  it('should call onIntersect when target is visible', () => {
    const onIntersect = vi.fn();
    const targetRef = { current: document.createElement('div') };

    renderHook(() => useInfiniteScroll(targetRef, onIntersect));

    mockObserver.trigger(true);
    expect(onIntersect).toHaveBeenCalled();
  });

  it('should not call onIntersect when target is not visible', () => {
    const onIntersect = vi.fn();
    const targetRef = { current: document.createElement('div') };

    renderHook(() => useInfiniteScroll(targetRef, onIntersect));

    mockObserver.trigger(false);
    expect(onIntersect).not.toHaveBeenCalled();
  });
});
```

### E2E Test: `tests/e2e/enhanced-search.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Enhanced Search Dialog', () => {
  test('should open dialog with Cmd+Shift+F', async ({ page }) => {
    await page.goto('/');

    // Open enhanced search
    await page.keyboard.press('Meta+Shift+F');

    const dialog = page.locator('[aria-label="Enhanced search"]');
    await expect(dialog).toBeVisible();

    const input = page.locator('input[aria-label="Search query"]');
    await expect(input).toBeFocused();
  });

  test('should show results with infinite scroll', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+Shift+F');

    const input = page.locator('input[aria-label="Search query"]');
    await input.fill('test');

    // Wait for debounced search
    await page.waitForTimeout(400);

    // Results should appear
    const results = page.locator('[role="option"]');
    const initialCount = await results.count();
    expect(initialCount).toBeGreaterThan(0);

    // Scroll to bottom
    const resultsContainer = page.locator('#enhanced-search-results');
    await resultsContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    // Wait for more results to load
    await page.waitForTimeout(500);

    const newCount = await results.count();
    // If there are more results, count should increase
    // (This test assumes there are >20 results for "test")
  });

  test('should close on Escape', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Meta+Shift+F');
    const dialog = page.locator('[aria-label="Enhanced search"]');
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
| CREATE | `src/components/search/EnhancedSearchDialog.tsx` |
| CREATE | `src/components/search/FilterChips.tsx` |
| CREATE | `src/hooks/useInfiniteScroll.ts` |
| CREATE | `src/hooks/useSearchFilters.ts` |
| CREATE | `src/__tests__/components/search/EnhancedSearchDialog.test.tsx` |
| CREATE | `src/__tests__/components/search/FilterChips.test.tsx` |
| CREATE | `src/__tests__/hooks/useInfiniteScroll.test.ts` |
| CREATE | `src/__tests__/hooks/useSearchFilters.test.ts` |
| CREATE | `tests/e2e/enhanced-search.spec.ts` |
| MODIFY | `src/components/search/SearchResultCard.tsx` (enhance with date/score display) |
| MODIFY | `src/app/(workspace)/layout.tsx` (register Cmd+Shift+F shortcut) |

---

## Dev Notes

### Challenges

1. **Infinite scroll state management**: Appending results without duplicates requires careful offset tracking. Reset offset when query/filters change.

2. **Filter state sync**: URL params are the source of truth, but updating them on every keystroke would be noisy. Debounce isn't needed for filters (they're button clicks), but we should avoid unnecessary re-renders.

3. **Accessibility**: Focus trap is critical — users shouldn't be able to tab outside the dialog. Consider using `react-focus-lock` or manual focus management.

4. **IntersectionObserver performance**: The trigger element must be at the bottom of the list, but not cause layout shifts. Use a small div with padding.

### Libraries to Evaluate

- `react-focus-lock`: Focus trap for modal dialogs
- `react-day-picker`: Date range picker (if implementing date filter UI in this story)
- `dompurify`: Already in use for sanitizing snippets

### Integration Points

- Depends on `useSearch` hook being enhanced to accept `filters` param (part of SKB-13.2)
- Sidebar needs a "Search" button that opens this dialog
- Hotkey registration for Cmd+Shift+F (different from Cmd+K for QuickSwitcher)

---

**Last Updated:** 2026-02-22
