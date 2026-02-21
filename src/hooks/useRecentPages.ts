"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "symbio-recent-pages";
const MAX_RECENT_PAGES = 5;

export interface RecentPage {
  id: string;
  title: string;
  icon: string | null;
  visitedAt: number;
}

/**
 * Hook for managing the recent pages list.
 *
 * Stores the last 5 visited pages in localStorage.
 * Provides methods to add a page visit and retrieve the list.
 */
export function useRecentPages() {
  const [recentPages, setRecentPages] = useState<RecentPage[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentPage[];
        setRecentPages(parsed);
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  /**
   * Records a page visit. Adds the page to the front of the recent list,
   * deduplicating and capping at MAX_RECENT_PAGES.
   */
  const addRecentPage = useCallback(
    (page: { id: string; title: string; icon: string | null }) => {
      setRecentPages((prev) => {
        // Remove existing entry for this page (if any)
        const filtered = prev.filter((p) => p.id !== page.id);

        // Add to front with current timestamp
        const updated: RecentPage[] = [
          { ...page, visitedAt: Date.now() },
          ...filtered,
        ].slice(0, MAX_RECENT_PAGES);

        // Persist to localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Ignore storage errors
        }

        return updated;
      });
    },
    []
  );

  /**
   * Clears the recent pages list.
   */
  const clearRecentPages = useCallback(() => {
    setRecentPages([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  return { recentPages, addRecentPage, clearRecentPages };
}
