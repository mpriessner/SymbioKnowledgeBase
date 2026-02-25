"use client";

import type { HeadingPosition } from "@/hooks/useHeadingPositions";

interface ScrollIndicatorBarsProps {
  positions: HeadingPosition[];
  activeHeadingId: string | null;
  onHoverChange: (isHovered: boolean) => void;
  onBarClick?: (headingId: string) => void;
}

/**
 * Thin indicator bars along the right edge of the content area.
 * Each bar corresponds to a heading, equally spaced.
 * The active heading's bar is highlighted.
 */
export function ScrollIndicatorBars({
  positions,
  activeHeadingId,
  onHoverChange,
  onBarClick,
}: ScrollIndicatorBarsProps) {
  if (positions.length < 2) return null;

  const total = positions.length;

  return (
    <div
      className="toc-indicator-strip hidden lg:block"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {positions.map((pos, index) => (
        <div
          key={pos.id}
          className={`indicator-bar${pos.id === activeHeadingId ? " active" : ""}`}
          style={{ top: `${total === 1 ? 50 : (index / (total - 1)) * 100}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onBarClick?.(pos.id);
          }}
        />
      ))}
    </div>
  );
}
