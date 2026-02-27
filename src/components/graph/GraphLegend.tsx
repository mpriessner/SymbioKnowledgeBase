"use client";

import { useState } from "react";
import { graphColors } from "@/lib/graph/colorPalette";

interface GraphLegendProps {
  theme: "light" | "dark";
  nodeCount: number;
  edgeCount: number;
}

/**
 * Graph legend showing color meanings and stats. Collapsed by default.
 */
export function GraphLegend({ theme, nodeCount, edgeCount }: GraphLegendProps) {
  const [isOpen, setIsOpen] = useState(false);
  const palette = graphColors[theme];

  const items = [
    { color: palette.page, label: "Page" },
    { color: palette.database, label: "Database" },
    { color: palette.orphan, label: "Orphan (no links)" },
    { color: palette.center, label: "Current page" },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]/90 px-2.5 py-1.5 backdrop-blur-sm text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
        title="Show legend"
      >
        {nodeCount}n · {edgeCount}e
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]/90 p-3 backdrop-blur-sm">
      <button
        onClick={() => setIsOpen(false)}
        className="mb-2 flex w-full items-center justify-between cursor-pointer"
      >
        <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase">
          Legend
        </h4>
        <span className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">✕</span>
      </button>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-xs text-[var(--text-primary)]">
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 border-t border-[var(--border-default)] pt-2 text-xs text-[var(--text-secondary)]">
        {nodeCount} nodes, {edgeCount} edges
      </div>
    </div>
  );
}
