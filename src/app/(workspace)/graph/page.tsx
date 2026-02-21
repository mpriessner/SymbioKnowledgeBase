import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowledge Graph",
};

export default function GraphPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Knowledge Graph
        </h1>
        <p className="mt-4 text-[var(--text-secondary)]">
          The interactive knowledge graph will be implemented in Epic 6 (SKB-06.x).
        </p>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          Uses react-force-graph for force-directed visualization of page connections.
        </p>
      </div>
    </div>
  );
}
