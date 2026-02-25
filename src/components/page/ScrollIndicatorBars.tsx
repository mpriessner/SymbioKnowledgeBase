"use client";

import type { HeadingPosition } from "@/hooks/useHeadingPositions";

interface ScrollIndicatorBarsProps {
  positions: HeadingPosition[];
  activeHeadingId: string | null;
  onHoverChange: (isHovered: boolean) => void;
}

/**
 * Thin indicator bars along the right edge of the content area.
 * Each bar corresponds to a heading, positioned proportionally.
 * The active heading's bar is highlighted.
 */
export function ScrollIndicatorBars({
  positions,
  activeHeadingId,
  onHoverChange,
}: ScrollIndicatorBarsProps) {
  if (positions.length < 2) return null;

  return (
    <div
      className="toc-indicator-strip hidden lg:block"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {positions.map((pos) => (
        <div
          key={pos.id}
          className={`indicator-bar${pos.id === activeHeadingId ? " active" : ""}`}
          style={{ top: `${pos.proportionalTop * 100}%` }}
        />
      ))}
    </div>
  );
}
