"use client";

import type { HeadingPosition } from "@/hooks/useHeadingPositions";

interface ScrollIndicatorBarsProps {
  positions: HeadingPosition[];
  headingTexts: Record<string, string>;
  activeHeadingId: string | null;
  onHoverChange: (isHovered: boolean) => void;
  onBarClick?: (headingId: string) => void;
}

/**
 * Thin indicator bars along the right edge of the content area.
 * Each bar corresponds to a heading, equally spaced.
 * The active heading's bar is highlighted.
 * Hovering a bar shows the heading name as a tooltip.
 */
export function ScrollIndicatorBars({
  positions,
  headingTexts,
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
      {positions.map((pos, index) => {
        const text = headingTexts[pos.id] ?? "";
        const truncated = text.length > 25 ? text.slice(0, 25) + "\u2026" : text;

        return (
          <div
            key={pos.id}
            className="indicator-bar-group group"
            style={{ top: `${total === 1 ? 50 : (index / (total - 1)) * 100}%` }}
          >
            {/* Hover tooltip label */}
            {truncated && (
              <span className="indicator-bar-label">
                {truncated}
              </span>
            )}

            {/* The bar itself */}
            <div
              className={`indicator-bar${pos.id === activeHeadingId ? " active" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                onBarClick?.(pos.id);
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
