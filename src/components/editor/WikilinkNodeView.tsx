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
 */
export function WikilinkNodeView({ node }: NodeViewProps) {
  const router = useRouter();
  const { pageId, pageName, displayText } = node.attrs as {
    pageId: string | null;
    pageName: string;
    displayText: string | null;
  };

  // Initialize exists based on pageId presence - no async check needed for null pageId
  const [exists, setExists] = useState<boolean>(!!pageId);
  const label = displayText || pageName;

  // Check if the target page still exists (only when pageId is present)
  useEffect(() => {
    // Skip API check if no pageId - initial state already handles this case
    if (!pageId) return;

    let cancelled = false;
    
    fetch(`/api/pages/${pageId}`, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) setExists(res.ok);
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pageId]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (pageId && exists) {
        router.push(`/pages/${pageId}`);
      }
    },
    [pageId, exists, router]
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
