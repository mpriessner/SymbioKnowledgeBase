"use client";

import { useState, useEffect, useCallback } from "react";

interface SearchHistoryItem {
  query: string;
  timestamp: number;
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
    } catch {
      // Silently ignore localStorage errors
    }
  }, [storageKey]);

  const addSearch = useCallback(
    (query: string) => {
      if (!query.trim()) return;

      setHistory((prev) => {
        // Exclude if duplicate of last search
        if (prev.length > 0 && prev[0].query === query) {
          return prev;
        }

        const updated = [
          { query, timestamp: Date.now() },
          ...prev.filter((item) => item.query !== query),
        ].slice(0, MAX_HISTORY);

        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // Silently ignore localStorage errors
        }

        return updated;
      });
    },
    [storageKey]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Silently ignore localStorage errors
    }
  }, [storageKey]);

  return { history, addSearch, clearHistory };
}
