"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/useDebounce";
import { useSearch } from "@/hooks/useSearch";
import { SearchResults } from "./SearchResults";

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
export function SearchDialog({
  isOpen,
  onClose,
  inline = false,
}: SearchDialogProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebounce(query, DEBOUNCE_MS);

  const { data, isLoading, isFetching } = useSearch(debouncedQuery, {
    enabled: isOpen && debouncedQuery.length > 0,
  });

  const results = data?.data ?? [];

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
      setQuery("");
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
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= results.length - 1 ? 0 : prev + 1
          );
          break;

        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? results.length - 1 : prev - 1
          );
          break;

        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            selectResult(results[selectedIndex].pageId);
          }
          break;

        case "Escape":
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
      className="w-full max-w-2xl rounded-lg border border-[var(--border-default)]
                 bg-[var(--bg-primary)] shadow-2xl"
      role="dialog"
      aria-label="Search knowledge base"
      aria-modal={!inline}
    >
      {/* Search input */}
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
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search knowledge base..."
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)]
                     placeholder-[var(--text-secondary)] outline-none"
          aria-label="Search query"
          aria-autocomplete="list"
          aria-controls="search-results"
          autoComplete="off"
        />
        {(isLoading || isFetching) && (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border-default)] border-t-[var(--accent-primary)]" />
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
      <div className="flex items-center gap-4 border-t border-[var(--border-default)] px-4 py-2 text-xs text-[var(--text-secondary)]">
        <span>
          <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-xs">
            ↑↓
          </kbd>{" "}
          Navigate
        </span>
        <span>
          <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-xs">
            ↵
          </kbd>{" "}
          Open
        </span>
        <span>
          <kbd className="rounded border border-[var(--border-default)] px-1.5 py-0.5 font-mono text-xs">
            esc
          </kbd>{" "}
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
