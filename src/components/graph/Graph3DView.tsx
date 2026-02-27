"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGraphData } from "@/hooks/useGraphData";
import { getNodeColor } from "@/lib/graph/colorPalette";
import type { ThemeMode } from "@/lib/graph/colorPalette";
import type { GraphNode, GraphData } from "@/types/graph";

// Dynamically import ForceGraph3D to avoid SSR issues (uses WebGL/three.js)
const ForceGraph3D = dynamic(
  () => import("react-force-graph-3d"),
  { ssr: false }
);

interface Graph3DViewProps {
  pageId?: string;
  depth?: number;
  width?: number;
  height?: number;
  highlightCenter?: boolean;
  overrideData?: GraphData;
  showLabels?: boolean;
  showNodes?: boolean;
  showEdges?: boolean;
}

/**
 * Base node type used by react-force-graph callbacks.
 * The library adds position (x, y, z) and velocity (vx, vy, vz) properties.
 */
type ForceGraphNodeObject = {
  id?: string | number;
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  fy?: number;
  fz?: number;
  // Our custom properties from GraphNode
  label?: string;
  icon?: string | null;
  linkCount?: number;
  updatedAt?: string;
  [key: string]: unknown;
};

function getThemeMode(): ThemeMode {
  if (typeof document !== "undefined") {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }
  return "light";
}

/**
 * 3D knowledge graph visualization using react-force-graph-3d (WebGL/three.js).
 */
export function Graph3DView({
  pageId,
  depth = 2,
  width,
  height,
  highlightCenter = false,
  overrideData,
  showLabels = true,
  showNodes = true,
  showEdges = true,
}: Graph3DViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const { data, isLoading } = useGraphData({
    pageId,
    depth,
    enabled: !overrideData,
  });

  const graphData = useMemo(() => {
    const source = overrideData ?? data?.data;
    if (!source) return { nodes: [], links: [] };
    return {
      nodes: source.nodes,
      links: source.edges.map((e) => ({
        source: e.source,
        target: e.target,
      })),
    };
  }, [data, overrideData]);

  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: width || containerRef.current.clientWidth,
          height: height || containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [width, height]);

const handleNodeClick = useCallback(
    (node: ForceGraphNodeObject, _event: MouseEvent) => {
      if (node?.id) {
        router.push(`/pages/${node.id}`);
      }
    },
    [router]
  );

  const theme = getThemeMode();
  const centerId = highlightCenter ? pageId : undefined;

  // Use refs so toggling display options doesn't recreate callbacks
  // (which would restart the force simulation and cause wiggle)
  const showLabelsRef = useRef(showLabels);
  const showNodesRef = useRef(showNodes);
  const showEdgesRef = useRef(showEdges);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { showNodesRef.current = showNodes; }, [showNodes]);
  useEffect(() => { showEdgesRef.current = showEdges; }, [showEdges]);

  const nodeColor = useCallback(
    (node: ForceGraphNodeObject) => {
      return getNodeColor(node as unknown as GraphNode, theme, centerId);
    },
    [theme, centerId]
  );

  const nodeLabel = useCallback(
    (node: ForceGraphNodeObject): string => {
      if (!showLabelsRef.current) return "";
      return node.label ?? "";
    },
    []
  );

  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
      >
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Loading 3D graph...
          </p>
        </div>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
      >
        <p className="text-sm text-[var(--color-text-secondary)]">
          No pages to display.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {graphData.nodes.length > 500 && (
        <div className="absolute left-4 top-4 z-10 rounded-md border border-yellow-500/50 bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          Large graph ({graphData.nodes.length} nodes) — rendering may be slow
        </div>
      )}

      <ForceGraph3D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeColor={nodeColor}
        nodeLabel={nodeLabel}
        nodeRelSize={4}
        nodeVisibility={() => showNodesRef.current}
        onNodeClick={handleNodeClick}
        linkColor={() => (theme === "dark" ? "#4B5563" : "#D1D5DB")}
        linkWidth={1}
        linkDirectionalArrowLength={3.5}
        linkDirectionalArrowRelPos={1}
        linkVisibility={() => showEdgesRef.current}
        enableNavigationControls={true}
        enableNodeDrag={true}
        cooldownTime={3000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        backgroundColor={theme === "dark" ? "#111827" : "#ffffff"}
      />
    </div>
  );
}
