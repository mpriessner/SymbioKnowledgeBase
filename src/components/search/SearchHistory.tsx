"use client";

import { formatDistanceToNow } from "date-fns";

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
 * Shows when search input is empty.
 */
export function SearchHistory({
  history,
  onSelectSearch,
  onClearHistory,
}: SearchHistoryProps) {
  if (history.length === 0) return null;

  return (
    <div className="px-4 py-3 border-b border-[var(--border-default)]">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
          Recent Searches
        </h3>
        <button
          onClick={onClearHistory}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          Clear history
        </button>
      </div>

      <div className="space-y-1">
        {history.map((item, index) => (
          <button
            key={index}
            onClick={() => onSelectSearch(item.query)}
            className="w-full flex items-center justify-between px-3 py-2 text-left text-sm rounded hover:bg-[var(--bg-hover)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="text-base">{"\u{1F552}"}</span>
              <span className="text-[var(--text-primary)]">{item.query}</span>
            </span>
            <span className="text-xs text-[var(--text-tertiary)]">
              {formatDistanceToNow(item.timestamp, { addSuffix: true })}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
