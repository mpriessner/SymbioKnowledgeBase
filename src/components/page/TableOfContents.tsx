"use client";

import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { useTableOfContents } from "@/hooks/useTableOfContents";
import { useHeadingPositions } from "@/hooks/useHeadingPositions";
import { ScrollIndicatorBars } from "./ScrollIndicatorBars";
import "./table-of-contents.css";

interface TableOfContentsProps {
  editor: Editor | null;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

/**
 * Container component that orchestrates the scroll indicator bars
 * and (in SKB-22.3) the expandable TOC panel.
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
  const [isHovered, setIsHovered] = useState(false);

  // Only show when there are 2+ headings
  if (headings.length < 2) return null;

  return (
    <ScrollIndicatorBars
      positions={positions}
      activeHeadingId={activeHeadingId}
      onHoverChange={setIsHovered}
    />
  );
}
