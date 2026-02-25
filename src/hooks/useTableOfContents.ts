"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { slugifyHeading, deduplicateIds } from "@/lib/utils/slugify";

export interface TOCHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

/**
 * Extract headings from TipTap editor content.
 */
function extractHeadings(editor: Editor): TOCHeading[] {
  const raw: { text: string; level: 1 | 2 | 3 }[] = [];

  editor.state.doc.descendants((node) => {
    if (node.type.name === "heading" && node.textContent.trim()) {
      raw.push({
        text: node.textContent.trim(),
        level: node.attrs.level as 1 | 2 | 3,
      });
    }
  });

  const rawIds = raw.map((h) => slugifyHeading(h.text));
  const uniqueIds = deduplicateIds(rawIds);

  return raw.map((h, i) => ({
    id: uniqueIds[i],
    text: h.text,
    level: h.level,
  }));
}

/**
 * Hook that extracts headings from TipTap editor content and tracks the
 * currently visible heading via IntersectionObserver (scroll spy).
 */
export function useTableOfContents(
  editor: Editor | null,
  scrollContainerRef: React.RefObject<HTMLElement | null>
): { headings: TOCHeading[]; activeHeadingId: string | null } {
  const [headings, setHeadings] = useState<TOCHeading[]>([]);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Extract headings on editor content change (debounced 200ms)
  useEffect(() => {
    if (!editor || editor.isDestroyed) {
      setHeadings([]);
      return;
    }

    function handleUpdate() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!editor || editor.isDestroyed) return;
        setHeadings(extractHeadings(editor));
      }, 200);
    }

    // Initial extraction
    handleUpdate();

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editor]);

  // Set up IntersectionObserver for scroll spy
  useEffect(() => {
    if (headings.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    // Disconnect previous observer
    observerRef.current?.disconnect();

    const visibleIds = new Set<string>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleIds.add(entry.target.id);
          } else {
            visibleIds.delete(entry.target.id);
          }
        }

        // Find topmost visible heading (in document order)
        if (visibleIds.size > 0) {
          const topmost = headings.find((h) => visibleIds.has(h.id));
          if (topmost) setActiveHeadingId(topmost.id);
        }
        // If none visible, keep last active (scrolled past)
      },
      {
        root: scrollContainer,
        rootMargin: "-20% 0px -80% 0px",
        threshold: [0, 1],
      }
    );

    // Observe heading DOM elements (after a short delay for DOM to settle)
    const timeoutId = setTimeout(() => {
      for (const h of headings) {
        const el = document.getElementById(h.id);
        if (el) observerRef.current?.observe(el);
      }
    }, 50);

    return () => {
      clearTimeout(timeoutId);
      observerRef.current?.disconnect();
    };
  }, [headings, scrollContainerRef]);

  return { headings, activeHeadingId };
}
