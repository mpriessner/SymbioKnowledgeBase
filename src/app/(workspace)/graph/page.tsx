"use client";

import { GraphView } from "@/components/graph/GraphView";

/**
 * Global knowledge graph page.
 * Renders a full-viewport interactive graph of all pages and their connections.
 */
export default function GraphPage() {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Knowledge Graph
        </h1>
      </div>

      {/* Graph viewport (fills remaining space) */}
      <div className="flex-1">
        <GraphView />
      </div>
    </div>
  );
}
