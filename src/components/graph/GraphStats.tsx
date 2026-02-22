"use client";

interface GraphStatsProps {
  nodeCount: number;
  edgeCount: number;
  clusterCount: number;
  orphanCount: number;
}

/**
 * Graph statistics panel showing key metrics about the knowledge graph.
 */
export function GraphStats({
  nodeCount,
  edgeCount,
  clusterCount,
  orphanCount,
}: GraphStatsProps) {
  const stats = [
    { label: "Pages", value: nodeCount },
    { label: "Connections", value: edgeCount },
    { label: "Clusters", value: clusterCount },
    { label: "Orphans", value: orphanCount },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-2 py-1.5 text-center"
        >
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {stat.value}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {stat.label}
          </p>
        </div>
      ))}
    </div>
  );
}
