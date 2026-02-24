"use client";

import { useState, useCallback } from "react";

const STORAGE_KEY = "skb-sidebar-collapsed";

/**
 * Get initial collapsed state from localStorage (SSR-safe)
 */
function getInitialCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

/**
 * Manages the collapsed/expanded state of the entire sidebar.
 */
export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapsed);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  }, []);

  return { isCollapsed, toggle };
}
