"use client";

import { useEffect, useRef } from "react";

/**
 * Infinite scroll hook using IntersectionObserver.
 *
 * Triggers the callback when the target element enters the viewport.
 *
 * @param targetRef - Ref to the trigger element (typically at the bottom of the list)
 * @param onIntersect - Callback to load more items
 * @param options - IntersectionObserver options
 */
export function useInfiniteScroll(
  targetRef: React.RefObject<HTMLElement | null>,
  onIntersect: () => void,
  options: IntersectionObserverInit = {}
): void {
  const callbackRef = useRef(onIntersect);

  // Update ref in useEffect to avoid accessing refs during render
  useEffect(() => {
    callbackRef.current = onIntersect;
  });

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          callbackRef.current();
        }
      },
      { threshold: 0.1, ...options }
    );

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef, options]);
}
