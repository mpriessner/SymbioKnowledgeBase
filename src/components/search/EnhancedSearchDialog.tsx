"use client";

import { useRef, useCallback, useEffect, useReducer } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearch } from "@/hooks/useSearch";
import { useSearchFilters } from "@/hooks/useSearchFilters";
import { useSearchHistory } from "@/hooks/useSearchHistory";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { FilterChips } from "./FilterChips";
import { SearchResultCard } from "./SearchResultCard";
import { DateRangePicker } from "./DateRangePicker";
import { ContentTypeToggles } from "./ContentTypeToggles";
import { SearchHistory } from "./SearchHistory";
import type { SearchResultItem, ContentTypeFilter } from "@/types/search";

// Reducer for search state - prevents cascading renders from multiple setState calls
type SearchState = {
  query: string;
  offset: number;
  allResults: SearchResultItem[];
  hasMore: boolean;
  selectedIndex: number;
  showFilters: boolean;
  dataVersion: number; // Track data changes for deduplication
};

type SearchAction =
  | { type: "SET_QUERY"; query: string }
  | { type: "APPEND_RESULTS"; data: SearchResultItem[]; pageSize: number }
  | { type: "SET_RESULTS"; data: SearchResultItem[]; pageSize: number }
  | { type: "LOAD_MORE"; pageSize: number }
  | { type: "RESET" }
  | { type: "SELECT_INDEX"; index: number }
  | { type: "SELECT_NEXT" }
  | { type: "SELECT_PREV" }
  | { type: "TOGGLE_FILTERS" };

function searchReducer(
  state: SearchState,
  action: SearchAction
): SearchState {
  switch (action.type) {
    case "SET_QUERY":
      return {
        ...state,
        query: action.query,
      };
    case "SET_RESULTS":
      return {
        ...state,
        offset: 0,
        allResults: action.data,
        hasMore: action.data.length === action.pageSize,
        selectedIndex: 0, // Reset selection when results change
        dataVersion: state.dataVersion + 1,
      };
    case "APPEND_RESULTS":
      return {
        ...state,
        allResults: [...state.allResults, ...action.data],
        hasMore: action.data.length === action.pageSize,
        dataVersion: state.dataVersion + 1,
      };
    case "LOAD_MORE":
      return {
        ...state,
        offset: state.offset + action.pageSize,
      };
    case "RESET":
      return {
        query: "",
        offset: 0,
        allResults: [],
        hasMore: true,
        selectedIndex: 0,
        showFilters: false,
        dataVersion: state.dataVersion + 1,
      };
    case "SELECT_INDEX":
      return {
        ...state,
        selectedIndex: action.index,
      };
    case "SELECT_NEXT":
      return {
        ...state,
        selectedIndex:
          state.selectedIndex >= state.allResults.length - 1
            ? 0
            : state.selectedIndex + 1,
      };
    case "SELECT_PREV":
      return {
        ...state,
        selectedIndex:
          state.selectedIndex <= 0
            ? state.allResults.length - 1
            : state.selectedIndex - 1,
      };
    case "TOGGLE_FILTERS":
      return {
        ...state,
        showFilters: !state.showFilters,
      };
    default:
      return state;
  }
}

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
 * Triggered by Cmd+Shift+F or sidebar "Search" button.
 */
export function EnhancedSearchDialog({
  isOpen,
  onClose,
}: EnhancedSearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);

  const { filters, setFilter, removeFilter, clearFilters } =
    useSearchFilters();
  const { history, addSearch, clearHistory } = useSearchHistory("default");

  // All search state in a single reducer - prevents cascading renders from multiple setState calls
  const [searchState, dispatch] = useReducer(searchReducer, {
    query: "",
    offset: 0,
    allResults: [],
    hasMore: true,
    selectedIndex: 0,
    showFilters: false,
    dataVersion: 0,
  });
  const { query, offset, allResults, hasMore, selectedIndex, showFilters } = searchState;
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  // Track previous query/filters to detect changes
  const prevQueryRef = useRef(debouncedQuery);
  const prevFiltersRef = useRef(filters);

  const { data, isLoading, isFetching } = useSearch(debouncedQuery, {
    enabled: isOpen && debouncedQuery.length > 0,
    filters,
    limit: RESULTS_PER_PAGE,
    offset,
  });

  // Track processed data to avoid duplicate processing
  const lastProcessedDataRef = useRef<typeof data>(null);

  // Handle data updates and query/filter changes in a single effect
  // Using refs to track changes avoids cascading setState calls
  useEffect(() => {
    const queryChanged = prevQueryRef.current !== debouncedQuery;
    const filtersChanged = prevFiltersRef.current !== filters;

    // Reset on query or filter change
    if (queryChanged || filtersChanged) {
      dispatch({ type: "RESET" });
      prevQueryRef.current = debouncedQuery;
      prevFiltersRef.current = filters;
      lastProcessedDataRef.current = null;
      return;
    }

    // Process new data (only if not already processed)
    if (data?.data && data !== lastProcessedDataRef.current) {
      lastProcessedDataRef.current = data;
      if (offset === 0) {
        dispatch({ type: "SET_RESULTS", data: data.data, pageSize: RESULTS_PER_PAGE });
      } else {
        dispatch({ type: "APPEND_RESULTS", data: data.data, pageSize: RESULTS_PER_PAGE });
      }
    }
  }, [data, debouncedQuery, filters, offset]);

  // Infinite scroll: load more when trigger is visible
  useInfiniteScroll(loadMoreTriggerRef, () => {
    if (!isFetching && hasMore) {
      dispatch({ type: "LOAD_MORE", pageSize: RESULTS_PER_PAGE });
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

  // Reset state when dialog closes - single dispatch handles all state
  useEffect(() => {
    if (!isOpen) {
      dispatch({ type: "RESET" });
    }
  }, [isOpen]);

  // Note: selectedIndex reset on results change is handled by reducer in SET_RESULTS action

  const selectResult = useCallback(
    (pageId: string) => {
      if (query.trim()) {
        addSearch(query.trim());
      }
      router.push(`/pages/${pageId}`);
      onClose();
    },
    [router, onClose, query, addSearch]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          dispatch({ type: "SELECT_NEXT" });
          break;

        case "ArrowUp":
          e.preventDefault();
          dispatch({ type: "SELECT_PREV" });
          break;

        case "Enter":
          e.preventDefault();
          if (allResults[selectedIndex]) {
            selectResult(allResults[selectedIndex].pageId);
          }
          break;

        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [allResults, selectedIndex, selectResult, onClose]
  );

  const handleContentTypeToggle = useCallback(
    (type: ContentTypeFilter) => {
      const current = filters.contentType || [];
      const updated = current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type];
      setFilter("contentType", updated.length > 0 ? updated : undefined);
    },
    [filters.contentType, setFilter]
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
        className="relative z-10 w-full max-w-3xl h-[80vh] rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-2xl flex flex-col"
        role="dialog"
        aria-label="Enhanced search"
        aria-modal="true"
      >
        {/* Header: search input + close button */}
        <div className="flex items-center gap-3 border-b border-[var(--border-default)] px-4 py-3">
          <svg
            className="h-5 w-5 flex-shrink-0 text-[var(--text-secondary)]"
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
            onChange={(e) => dispatch({ type: "SET_QUERY", query: e.target.value })}
            onKeyDown={handleKeyDown}
            placeholder="Search knowledge base..."
            className="flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder-[var(--text-secondary)] outline-none"
            aria-label="Search query"
            aria-autocomplete="list"
            aria-controls="enhanced-search-results"
            autoComplete="off"
          />
          {(isLoading || isFetching) && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)]" />
          )}
          <button
            onClick={() => dispatch({ type: "TOGGLE_FILTERS" })}
            className={`flex-shrink-0 p-1 rounded hover:bg-[var(--bg-secondary)] ${showFilters ? "text-[var(--accent-primary)]" : ""}`}
            aria-label="Toggle filters"
            title="Toggle filters"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="flex-shrink-0 p-1 rounded hover:bg-[var(--bg-secondary)]"
            aria-label="Close search"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Filter controls */}
        {showFilters && (
          <div className="px-4 py-3 border-b border-[var(--border-default)] space-y-3">
            <DateRangePicker
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateFromChange={(date) => setFilter("dateFrom", date)}
              onDateToChange={(date) => setFilter("dateTo", date)}
            />
            <ContentTypeToggles
              selectedTypes={filters.contentType || []}
              onToggle={handleContentTypeToggle}
            />
          </div>
        )}

        {/* Filter chips */}
        <FilterChips
          filters={filters}
          onRemoveFilter={removeFilter}
          onClearAll={clearFilters}
        />

        {/* Search results with infinite scroll */}
        <div
          id="enhanced-search-results"
          className="flex-1 overflow-y-auto"
          role="listbox"
        >
          {/* Loading skeleton */}
          {isLoading && debouncedQuery.length > 0 && (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="px-4 py-3 border-b border-[var(--border-default)]"
                >
                  <div className="h-4 w-48 animate-pulse rounded bg-[var(--bg-secondary)]" />
                  <div className="mt-2 h-3 w-full animate-pulse rounded bg-[var(--bg-secondary)]" />
                  <div className="mt-1 h-3 w-3/4 animate-pulse rounded bg-[var(--bg-secondary)]" />
                </div>
              ))}
            </div>
          )}

          {/* Search history (shown when query is empty) */}
          {!isLoading && debouncedQuery.length === 0 && (
            <>
              <SearchHistory
                history={history}
                onSelectSearch={(q) => dispatch({ type: "SET_QUERY", query: q })}
                onClearHistory={clearHistory}
              />
              {history.length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-[var(--text-secondary)]">
                  Type to search your knowledge base
                </div>
              )}
            </>
          )}

          {/* No results */}
          {!isLoading &&
            debouncedQuery.length > 0 &&
            allResults.length === 0 &&
            !isFetching && (
              <div className="px-4 py-12 text-center text-sm text-[var(--text-secondary)]">
                <p>No results found for &quot;{debouncedQuery}&quot;</p>
                {(filters.dateFrom ||
                  filters.dateTo ||
                  (filters.contentType && filters.contentType.length > 0)) && (
                  <p className="mt-2 text-xs">Try adjusting your filters</p>
                )}
              </div>
            )}

          {/* Results list */}
          {allResults.length > 0 && (
            <>
              {allResults.map((result, index) => (
                <SearchResultCard
                  key={`${result.pageId}-${index}`}
                  result={result}
                  isSelected={index === selectedIndex}
                  onSelect={selectResult}
                  onHover={() => dispatch({ type: "SELECT_INDEX", index })}
                />
              ))}

              {/* Infinite scroll trigger */}
              {hasMore && (
                <div
                  ref={loadMoreTriggerRef}
                  className="px-4 py-4 text-center text-xs text-[var(--text-secondary)]"
                >
                  {isFetching ? "Loading more..." : "Scroll for more"}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: keyboard hints */}
        <div className="flex items-center gap-4 border-t border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-secondary)]">
          <span>
            <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-xs">
              {"\u2191\u2193"}
            </kbd>{" "}
            Navigate
          </span>
          <span>
            <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-xs">
              {"\u21B5"}
            </kbd>{" "}
            Open
          </span>
          <span>
            <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-xs">
              esc
            </kbd>{" "}
            Close
          </span>
          <span className="ml-auto">
            <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-xs">
              {"\u2318\u21E7F"}
            </kbd>{" "}
            Toggle filters
          </span>
        </div>
      </div>
    </div>
  );
}
