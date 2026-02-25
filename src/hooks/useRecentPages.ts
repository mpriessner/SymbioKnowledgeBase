"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "symbio-recent-pages";
const MAX_RECENT_PAGES = 5;

export interface RecentPage {
  id: string;
  title: string;
  icon: string | null;
  visitedAt: number;
}

// ── Shared in-memory cache so every hook instance sees the same data ───
let cache: RecentPage[] = [];
let listeners: Array<() => void> = [];
let isInitialised = false;

function readFromStorage(): RecentPage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as RecentPage[];
  } catch {
    // Ignore parse errors
  }
  return [];
}

function writeToStorage(pages: RecentPage[]) {
  cache = pages;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pages));
  } catch {
    // Ignore storage errors
  }
  // Notify all hook instances that data changed
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((fn) => fn !== listener);
  };
}

/**
 * Lazy initialisation on first snapshot read.
 * This avoids the anti-pattern of calling setState inside useEffect.
 */
function getSnapshot(): RecentPage[] {
  if (!isInitialised && typeof window !== "undefined") {
    cache = readFromStorage();
    isInitialised = true;
  }
  return cache;
}

const EMPTY: RecentPage[] = [];
function getServerSnapshot(): RecentPage[] {
  return EMPTY;
}

/**
 * Hook for managing the recent pages list.
 *
 * Uses useSyncExternalStore so every component calling this hook
 * instantly sees updates when any component adds a recent page.
 * Stores the last 5 visited pages in localStorage.
 */
export function useRecentPages() {
  const recentPages = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /**
   * Records a page visit. Adds the page to the front of the recent list,
   * deduplicating and capping at MAX_RECENT_PAGES.
   */
  const addRecentPage = useCallback(
    (page: { id: string; title: string; icon: string | null }) => {
      const filtered = cache.filter((p) => p.id !== page.id);
      const updated: RecentPage[] = [
        { ...page, visitedAt: Date.now() },
        ...filtered,
      ].slice(0, MAX_RECENT_PAGES);
      writeToStorage(updated);
    },
    []
  );

  /**
   * Clears the recent pages list.
   */
  const clearRecentPages = useCallback(() => {
    writeToStorage([]);
  }, []);

  return { recentPages, addRecentPage, clearRecentPages };
}
