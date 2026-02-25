"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { TOCHeading } from "@/hooks/useTableOfContents";
import { TOCHeadingItem } from "./TOCHeadingItem";

interface TOCPanelProps {
  headings: TOCHeading[];
  activeHeadingId: string | null;
  onHeadingClick: (headingId: string) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

export function TOCPanel({
  headings,
  activeHeadingId,
  onHeadingClick,
  onMouseEnter,
  onMouseLeave,
}: TOCPanelProps) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isEntering, setIsEntering] = useState(true);

  // Animate entrance
  useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      setIsEntering(false);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((prev) =>
            Math.min(prev + 1, headings.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < headings.length) {
            onHeadingClick(headings[focusedIndex].id);
          }
          break;
        case "Escape":
          e.preventDefault();
          onMouseLeave();
          break;
      }
    },
    [headings, focusedIndex, onHeadingClick, onMouseLeave]
  );

  return (
    <div
      ref={panelRef}
      role="navigation"
      aria-label={`Table of contents, ${headings.length} headings`}
      className={`
        absolute right-6 top-16 z-20
        w-64 max-h-[60vh] overflow-y-auto
        rounded-lg border border-[var(--border-default)]
        bg-[var(--bg-primary)]/90 backdrop-blur-xl
        shadow-lg
        p-3
        transition-all duration-200 ease-out
        ${isEntering ? "translate-x-5 opacity-0" : "translate-x-0 opacity-100"}
      `}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onKeyDown={handleKeyDown}
    >
      <p className="text-xs font-medium text-[var(--text-tertiary)] mb-2 px-2">
        Table of Contents
      </p>
      <div className="flex flex-col gap-0.5">
        {headings.map((heading, index) => (
          <TOCHeadingItem
            key={heading.id}
            heading={heading}
            isActive={heading.id === activeHeadingId}
            isFocused={index === focusedIndex}
            onClick={() => onHeadingClick(heading.id)}
          />
        ))}
      </div>
    </div>
  );
}
