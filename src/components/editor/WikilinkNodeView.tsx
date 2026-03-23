"use client";

import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * React NodeView for rendering wikilink nodes inside the TipTap editor.
 *
 * Displays the wikilink as a styled inline element:
 * - Blue text with underline for valid links
 * - Red text with dashed underline for broken links (deleted pages)
 * - Click navigates to the target page
 *
 * When pageId is missing (e.g. from markdown-based wikilinks like [[Page Name]]),
 * resolves the pageName to a pageId via the pages search API.
 */
export function WikilinkNodeView({ node }: NodeViewProps) {
  const router = useRouter();
  const { pageId: initialPageId, pageName, displayText } = node.attrs as {
    pageId: string | null;
    pageName: string;
    displayText: string | null;
  };

  const [resolvedPageId, setResolvedPageId] = useState<string | null>(initialPageId);
  const [exists, setExists] = useState<boolean>(!!initialPageId);
  const label = displayText || pageName;

  // Resolve pageName to pageId when pageId is not set
  useEffect(() => {
    if (initialPageId || !pageName) return;

    let cancelled = false;

    fetch(`/api/pages?search=${encodeURIComponent(pageName)}&limit=5`)
      .then((res) => res.ok ? res.json() : null)
      .then((json) => {
        if (cancelled) return;
        const pages = json?.data as Array<{ id: string; title: string }> | undefined;
        if (pages && pages.length > 0) {
          const nameLC = pageName.toLowerCase();
          // Try exact match first, then starts-with, then contains
          const match =
            pages.find((p) => p.title.toLowerCase() === nameLC) ??
            pages.find((p) => p.title.toLowerCase().startsWith(nameLC)) ??
            pages.find((p) => p.title.toLowerCase().includes(nameLC));
          if (match) {
            setResolvedPageId(match.id);
            setExists(true);
          }
        }
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      });

    return () => { cancelled = true; };
  }, [initialPageId, pageName]);

  // Check if the target page still exists (when pageId is known)
  useEffect(() => {
    if (!resolvedPageId || resolvedPageId === initialPageId && !initialPageId) return;
    // Only run HEAD check for initially-provided pageIds (already resolved ones skip this)
    if (!initialPageId) return;

    let cancelled = false;

    fetch(`/api/pages/${resolvedPageId}`, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setExists(res.ok);
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedPageId, initialPageId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (resolvedPageId && exists) {
        router.push(`/pages/${resolvedPageId}`);
      }
    },
    [resolvedPageId, exists, router]
  );

  return (
    <NodeViewWrapper as="span" className="inline">
      <span
        onClick={handleClick}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter")
            handleClick(e as unknown as React.MouseEvent);
        }}
        className={`
          cursor-pointer font-medium transition-colors duration-150
          ${
            exists
              ? "text-blue-600 underline decoration-blue-300 hover:text-blue-800 hover:decoration-blue-500 dark:text-blue-400 dark:decoration-blue-600 dark:hover:text-blue-300"
              : "text-red-500 line-through decoration-dashed cursor-not-allowed dark:text-red-400"
          }
        `}
        title={
          exists ? `Go to: ${pageName}` : `Page not found: ${pageName}`
        }
      >
        {label}
      </span>
    </NodeViewWrapper>
  );
}
