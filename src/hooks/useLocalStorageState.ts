"use client";

import { useSyncExternalStore, useCallback, useMemo } from "react";

/**
 * Hook for reading/writing localStorage with proper React integration.
 * Uses useSyncExternalStore to avoid the setState-in-effect anti-pattern.
 */

type Listener = () => void;
const listeners = new Map<string, Set<Listener>>();

function getListeners(key: string): Set<Listener> {
  if (!listeners.has(key)) {
    listeners.set(key, new Set());
  }
  return listeners.get(key)!;
}

function notifyListeners(key: string): void {
  getListeners(key).forEach((listener) => listener());
}

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const subscribe = useCallback(
    (listener: Listener) => {
      const keyListeners = getListeners(key);
      keyListeners.add(listener);

      // Also listen for storage events from other tabs
      const handleStorage = (e: StorageEvent) => {
        if (e.key === key) {
          listener();
        }
      };
      window.addEventListener("storage", handleStorage);

      return () => {
        keyListeners.delete(listener);
        window.removeEventListener("storage", handleStorage);
      };
    },
    [key]
  );

  const getSnapshot = useCallback((): T => {
    if (typeof window === "undefined") return defaultValue;
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    try {
      return JSON.parse(stored) as T;
    } catch {
      return stored as unknown as T;
    }
  }, [key, defaultValue]);

  const getServerSnapshot = useCallback((): T => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const currentValue = getSnapshot();
      const valueToStore =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(currentValue)
          : newValue;
      localStorage.setItem(key, JSON.stringify(valueToStore));
      notifyListeners(key);
    },
    [key, getSnapshot]
  );

  return useMemo(() => [value, setValue], [value, setValue]);
}

/**
 * Simplified version for boolean collapsed state (common pattern).
 */
export function useCollapsedState(
  sectionId: string,
  defaultCollapsed = false
): [boolean, () => void] {
  const key = `sidebar-section-${sectionId}-collapsed`;
  const [collapsed, setCollapsed] = useLocalStorageState(key, defaultCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  return [collapsed, toggle];
}
