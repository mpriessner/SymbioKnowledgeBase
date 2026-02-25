"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TOCHeading } from "./useTableOfContents";

export interface HeadingPosition {
  id: string;
  proportionalTop: number; // 0.0 – 1.0
}

/**
 * Calculate proportional positions of heading elements within a scroll container.
 * Returns a value between 0 and 1 for each heading, representing its vertical
 * position relative to the total scrollable height.
 */
export function useHeadingPositions(
  headings: TOCHeading[],
  scrollContainerRef: React.RefObject<HTMLElement | null>
): HeadingPosition[] {
  const [positions, setPositions] = useState<HeadingPosition[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const recalculate = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container || headings.length === 0) {
      setPositions([]);
      return;
    }

    const scrollHeight = container.scrollHeight;
    if (scrollHeight === 0) {
      setPositions([]);
      return;
    }

    const containerRect = container.getBoundingClientRect();

    const next: HeadingPosition[] = [];
    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (!el) continue;

      const elRect = el.getBoundingClientRect();
      // offsetTop relative to the scroll container's scroll position
      const offsetTop = elRect.top - containerRect.top + container.scrollTop;
      const proportionalTop = Math.min(Math.max(offsetTop / scrollHeight, 0), 1);

      next.push({ id: h.id, proportionalTop });
    }

    setPositions(next);
  }, [headings, scrollContainerRef]);

  const debouncedRecalculate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(recalculate, 200);
  }, [recalculate]);

  // Recalculate when headings change
  useEffect(() => {
    // Small delay to let DOM settle after heading extraction
    const timeoutId = setTimeout(recalculate, 100);
    return () => clearTimeout(timeoutId);
  }, [recalculate]);

  // Recalculate on resize
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(debouncedRecalculate);
    resizeObserver.observe(container);

    window.addEventListener("resize", debouncedRecalculate);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", debouncedRecalculate);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scrollContainerRef, debouncedRecalculate]);

  // Watch for image loads that might shift heading positions
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLImageElement) {
            node.addEventListener("load", debouncedRecalculate, { once: true });
          }
        }
      }
    });

    observer.observe(container, { childList: true, subtree: true });

    // Also listen for load on existing images
    const images = container.querySelectorAll("img");
    for (const img of images) {
      if (!img.complete) {
        img.addEventListener("load", debouncedRecalculate, { once: true });
      }
    }

    return () => observer.disconnect();
  }, [scrollContainerRef, debouncedRecalculate]);

  return positions;
}
