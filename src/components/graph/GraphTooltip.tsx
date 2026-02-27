"use client";

interface GraphTooltipProps {
  title: string;
  linkCount: number;
  oneLiner?: string | null;
  x: number;
  y: number;
  visible: boolean;
}

/**
 * Hover tooltip for graph nodes.
 * Shows page title and connection count near the cursor.
 */
export function GraphTooltip({
  title,
  linkCount,
  oneLiner,
  x,
  y,
  visible,
}: GraphTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed z-50 max-w-xs rounded-md border border-[var(--color-border)]
                 bg-[var(--color-bg-primary)] px-3 py-2 shadow-lg"
      style={{
        left: x + 12,
        top: y - 10,
      }}
    >
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        {title}
      </p>
      {oneLiner && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
          {oneLiner}
        </p>
      )}
      <p className="text-xs text-[var(--color-text-secondary)]">
        {linkCount} {linkCount === 1 ? "connection" : "connections"}
      </p>
    </div>
  );
}
