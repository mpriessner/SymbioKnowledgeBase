"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { usePageSearch } from "@/hooks/usePageSearch";

export interface WikilinkSuggestionRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface WikilinkSuggestionProps {
  query: string;
  onSelect: (page: {
    id: string;
    title: string;
    icon: string | null;
  }) => void;
  onClose: () => void;
}

/**
 * Floating autocomplete dropdown for wikilink page suggestions.
 *
 * Triggered when the user types [[ in the editor. Shows matching pages
 * with debounced search, keyboard navigation, and click selection.
 */
export const WikilinkSuggestion = forwardRef<
  WikilinkSuggestionRef,
  WikilinkSuggestionProps
>(function WikilinkSuggestion({ query, onSelect, onClose }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = usePageSearch(query, {
    enabled: true,
    debounceMs: 300,
    limit: 10,
  });

  const pages = data?.data ?? [];

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [pages.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedEl = listRef.current.children[
        selectedIndex
      ] as HTMLElement | undefined;
      selectedEl?.scrollIntoView?.({ block: "nearest" });
    }
  }, [selectedIndex]);

  const selectPage = useCallback(
    (index: number) => {
      const page = pages[index];
      if (page) {
        onSelect({ id: page.id, title: page.title, icon: page.icon });
      }
    },
    [pages, onSelect]
  );

  // Expose keyboard handler to the TipTap suggestion plugin
  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? pages.length - 1 : prev - 1
        );
        return true;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) =>
          prev >= pages.length - 1 ? 0 : prev + 1
        );
        return true;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        selectPage(selectedIndex);
        return true;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return true;
      }

      return false;
    },
  }));

  return (
    <div
      className="z-50 w-72 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)]
                 bg-[var(--color-bg-primary)] shadow-lg"
      role="listbox"
      aria-label="Page suggestions"
    >
      {isLoading && (
        <div className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          Searching...
        </div>
      )}

      {!isLoading && pages.length === 0 && (
        <div className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">
          No pages found
          {query && (
            <span className="block mt-1 text-xs">
              Press Enter to create &quot;{query}&quot;
            </span>
          )}
        </div>
      )}

      <div ref={listRef}>
        {pages.map((page, index) => (
          <button
            key={page.id}
            role="option"
            aria-selected={index === selectedIndex}
            className={`
              w-full px-3 py-2 text-left text-sm flex items-center gap-2
              transition-colors duration-100 cursor-pointer
              ${
                index === selectedIndex
                  ? "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
              }
            `}
            onClick={() => selectPage(index)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <span className="flex-shrink-0 text-base">
              {page.icon || "\u{1F4C4}"}
            </span>
            <span className="truncate">{page.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
});
