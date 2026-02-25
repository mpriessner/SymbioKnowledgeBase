"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { useTableOfContents } from "@/hooks/useTableOfContents";
import { useHeadingPositions } from "@/hooks/useHeadingPositions";
import { ScrollIndicatorBars } from "./ScrollIndicatorBars";
import { TOCPanel } from "./TOCPanel";
import "./table-of-contents.css";

interface TableOfContentsProps {
  editor: Editor | null;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Container component that orchestrates the scroll indicator bars
 * and the expandable TOC panel.
 */
export function TableOfContents({
  editor,
  scrollContainerRef,
}: TableOfContentsProps) {
  const { headings, activeHeadingId } = useTableOfContents(
    editor,
    scrollContainerRef
  );
  const positions = useHeadingPositions(headings, scrollContainerRef);

  const [isStripHovered, setIsStripHovered] = useState(false);
  const [isPanelHovered, setIsPanelHovered] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isHovered = isStripHovered || isPanelHovered;

  // Show panel immediately on hover, hide with 200ms delay
  useEffect(() => {
    if (isHovered) {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
      setShowPanel(true);
    } else {
      hideTimeoutRef.current = setTimeout(() => {
        setShowPanel(false);
      }, 200);
    }
    return () => {
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [isHovered]);

  const handleHeadingClick = useCallback((headingId: string) => {
    const element = document.getElementById(headingId);
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  // Only show when there are 2+ headings
  if (headings.length < 2) return null;

  return (
    <>
      <ScrollIndicatorBars
        positions={positions}
        activeHeadingId={activeHeadingId}
        onHoverChange={setIsStripHovered}
      />
      {showPanel && (
        <TOCPanel
          headings={headings}
          activeHeadingId={activeHeadingId}
          onHeadingClick={handleHeadingClick}
          onMouseEnter={() => setIsPanelHovered(true)}
          onMouseLeave={() => setIsPanelHovered(false)}
        />
      )}
    </>
  );
}
