"use client";

import { useSyncExternalStore, useCallback } from "react";

/**
 * Hook to safely access client-only values (like navigator, localStorage)
 * without causing hydration mismatches or cascading renders.
 * 
 * Uses useSyncExternalStore which is the React-recommended pattern
 * for subscribing to external data sources.
 */

// Dummy subscribe that never triggers (value is constant after mount)
const emptySubscribe = () => () => {};

/**
 * Returns a client-only computed value, with a fallback for SSR.
 * Avoids hydration mismatch by returning serverValue during SSR.
 */
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  const getSnapshot = useCallback(() => getClientValue(), [getClientValue]);
  const getServerSnapshot = useCallback(() => serverValue, [serverValue]);

  return useSyncExternalStore(emptySubscribe, getSnapshot, getServerSnapshot);
}

/**
 * Detect if the current platform is macOS.
 * Returns false during SSR to avoid hydration mismatch.
 */
export function useIsMac(): boolean {
  return useClientValue(
    () => typeof navigator !== "undefined" && (navigator.platform?.includes("Mac") ?? false),
    false
  );
}
