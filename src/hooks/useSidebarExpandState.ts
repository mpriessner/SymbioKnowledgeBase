"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "skb-sidebar-expanded";

type ExpandState = Record<string, boolean>;

/**
 * Manages expand/collapse state for sidebar tree nodes.
 * State is persisted to localStorage so it survives page reloads.
 */
export function useSidebarExpandState() {
  const [expandState, setExpandState] = useState<ExpandState>({});
  const [isHydrated, setIsHydrated] = useState(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setExpandState(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors, start with empty state
    }
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(expandState));
      } catch {
        // Ignore storage errors (quota exceeded, etc.)
      }
    }
  }, [expandState, isHydrated]);

  const isExpanded = useCallback(
    (pageId: string): boolean => {
      return expandState[pageId] ?? false;
    },
    [expandState]
  );

  const toggle = useCallback((pageId: string) => {
    setExpandState((prev) => ({
      ...prev,
      [pageId]: !prev[pageId],
    }));
  }, []);

  const expand = useCallback((pageId: string) => {
    setExpandState((prev) => ({
      ...prev,
      [pageId]: true,
    }));
  }, []);

  const collapse = useCallback((pageId: string) => {
    setExpandState((prev) => ({
      ...prev,
      [pageId]: false,
    }));
  }, []);

  return { isExpanded, toggle, expand, collapse, isHydrated };
}
