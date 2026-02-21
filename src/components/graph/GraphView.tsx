"use client";

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGraphData } from "@/hooks/useGraphData";
import { GraphTooltip } from "./GraphTooltip";
import type { GraphNode, GraphData } from "@/types/graph";

// Dynamically import ForceGraph2D to avoid SSR issues (uses Canvas/WebGL)
const ForceGraph2D = dynamic(
  () => import("react-force-graph").then((mod) => mod.ForceGraph2D),
  { ssr: false }
);

export interface GraphRefHandle {
  zoom: (k: number, duration?: number) => void;
  centerAt: (x: number, y: number, duration?: number) => void;
  zoomToFit: (duration?: number, padding?: number) => void;
}

interface GraphViewProps {
  pageId?: string;
  depth?: number;
  width?: number;
  height?: number;
  highlightCenter?: boolean;
  /** Override graph data (e.g. from external filtering) */
  overrideData?: GraphData;
  /** Whether to show node labels (default true) */
  showLabels?: boolean;
  /** Callback to expose the graph ref for external zoom controls */
  onGraphRef?: (ref: GraphRefHandle | null) => void;
}

interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

// Color palette for nodes
const NODE_COLOR_DEFAULT = "#529CCA";
const NODE_COLOR_ORPHAN = "#9CA3AF";
const NODE_COLOR_CENTER = "#EF4444";
const LINK_COLOR = "#D1D5DB";

/**
 * Interactive knowledge graph visualization using react-force-graph.
 *
 * Renders pages as nodes and wikilinks as directed edges.
 * Supports click-to-navigate, hover tooltips, and zoom/pan.
 */
export function GraphView({
  pageId,
  depth = 2,
  width,
  height,
  highlightCenter = false,
  overrideData,
  showLabels = true,
  onGraphRef,
}: GraphViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<GraphRefHandle | null>(null);

  // Expose graph ref to parent via callback
  useEffect(() => {
    onGraphRef?.(graphRef.current);
    return () => onGraphRef?.(null);
  }, [onGraphRef]);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [tooltip, setTooltip] = useState<{
    title: string;
    linkCount: number;
    x: number;
    y: number;
    visible: boolean;
  }>({
    title: "",
    linkCount: 0,
    x: 0,
    y: 0,
    visible: false,
  });

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

  // Click handler: navigate to page
  const handleNodeClick = useCallback(
    (node: ForceGraphNode) => {
      if (node.id) {
        router.push(`/pages/${node.id}`);
      }
    },
    [router]
  );

  // Hover handler: show/hide tooltip
  const handleNodeHover = useCallback(
    (node: ForceGraphNode | null, event?: MouseEvent) => {
      if (node && event) {
        setTooltip({
          title: node.label,
          linkCount: node.linkCount,
          x: event.clientX,
          y: event.clientY,
          visible: true,
        });
      } else {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    },
    []
  );

  // Custom node rendering: circle with size based on linkCount
  const nodeCanvasObject = useCallback(
    (
      node: ForceGraphNode,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const label = node.label;
      const fontSize = Math.max(12 / globalScale, 3);
      const radius = Math.max(Math.sqrt(node.linkCount + 1) * 3, 4);

      // Determine color
      let color = NODE_COLOR_DEFAULT;
      if (highlightCenter && node.id === pageId) {
        color = NODE_COLOR_CENTER;
      } else if (node.linkCount === 0) {
        color = NODE_COLOR_ORPHAN;
      }

      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw label (only if enabled and zoomed in enough)
      if (showLabels && globalScale > 0.8) {
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#37352f";

        const maxLabelLength = 20;
        const displayLabel =
          label.length > maxLabelLength
            ? label.substring(0, maxLabelLength) + "..."
            : label;

        ctx.fillText(
          displayLabel,
          node.x || 0,
          (node.y || 0) + radius + 2
        );
      }
    },
    [highlightCenter, pageId, showLabels]
  );

  // Pin center node when engine stops (for local graph)
  const handleEngineStop = useCallback(() => {
    if (highlightCenter && pageId && graphRef.current) {
      const centerNode = graphData.nodes.find(
        (n: ForceGraphNode) => n.id === pageId
      );
      if (centerNode) {
        (centerNode as ForceGraphNode).fx = 0;
        (centerNode as ForceGraphNode).fy = 0;
        graphRef.current.centerAt(0, 0, 1000);
      }
    }
  }, [highlightCenter, pageId, graphData.nodes]);

  // Loading state
  if (isLoading) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
      >
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" />
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
            Loading graph...
          </p>
        </div>
      </div>
    );
  }

  // Empty state
  if (graphData.nodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex h-full w-full items-center justify-center"
      >
        <div className="text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            No pages to display.
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            Create pages and add wikilinks to build your knowledge graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ForceGraph2D
        ref={graphRef as React.MutableRefObject<null>}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onEngineStop={handleEngineStop}
        linkColor={() => LINK_COLOR}
        linkWidth={1}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={1}
        enableZoomInteraction={true}
        enablePanInteraction={true}
        enableNodeDrag={true}
        cooldownTime={3000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
      />

      <GraphTooltip
        title={tooltip.title}
        linkCount={tooltip.linkCount}
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltip.visible}
      />

      {/* Stats footer (hidden when parent manages controls) */}
      {!overrideData && (
        <div className="absolute bottom-4 left-4 rounded-md bg-[var(--color-bg-primary)]/80 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] backdrop-blur-sm">
          {data?.meta.nodeCount} pages, {data?.meta.edgeCount} connections
        </div>
      )}
    </div>
  );
}
