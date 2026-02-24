import { useSyncExternalStore } from "react";

/**
 * A hydration-safe hook that returns `true` only on the client after hydration.
 * Uses useSyncExternalStore for proper SSR/client consistency.
 *
 * Usage:
 * ```tsx
 * const hydrated = useHydrated();
 * if (!hydrated) return null; // or fallback UI
 * // Safe to use client-only features like localStorage
 * ```
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    // Subscribe: no-op since hydration state never changes
    () => () => {},
    // Client snapshot: always true
    () => true,
    // Server snapshot: always false
    () => false
  );
}
