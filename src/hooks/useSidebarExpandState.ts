"use client";

import { useState, useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "skb-sidebar-expanded";

type ExpandState = Record<string, boolean>;

/**
 * Get initial expand state from localStorage (SSR-safe)
 */
function getInitialExpandState(): ExpandState {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return {};
}

// Hydration detection using useSyncExternalStore
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Manages expand/collapse state for sidebar tree nodes.
 * State is persisted to localStorage so it survives page reloads.
 */
export function useSidebarExpandState() {
  const [expandState, setExpandState] = useState<ExpandState>(getInitialExpandState);
  const isHydrated = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

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
