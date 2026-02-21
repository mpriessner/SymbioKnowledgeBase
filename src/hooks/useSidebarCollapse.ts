"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "skb-sidebar-collapsed";

/**
 * Manages the collapsed/expanded state of the entire sidebar.
 */
export function useSidebarCollapse() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setIsCollapsed(stored === "true");
      }
    } catch {
      // Ignore
    }
  }, []);

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
