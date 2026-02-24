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
import { GraphLegend } from "./GraphLegend";
import { getNodeColor, getNodeRadius, getEdgeColor } from "@/lib/graph/colorPalette";
import type { ThemeMode } from "@/lib/graph/colorPalette";
import type { GraphNode, GraphData } from "@/types/graph";

// Dynamically import ForceGraph2D to avoid SSR issues (uses Canvas/WebGL)
const ForceGraph2D = dynamic(
  () => import("react-force-graph-2d"),
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
  /** Node IDs to highlight (from search) */
  highlightedNodes?: string[];
}

interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

// Detect theme from document attribute
function getThemeMode(): ThemeMode {
  if (typeof document !== "undefined") {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }
  return "light";
}

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
  highlightedNodes = [],
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback(
    (node: any) => {
      const typedNode = node as ForceGraphNode | null;
      if (typedNode?.id) {
        router.push(`/pages/${typedNode.id}`);
      }
    },
    [router]
  );

  // Hover handler: show/hide tooltip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeHover = useCallback(
    (node: any, _previousNode: any) => {
      const typedNode = node as ForceGraphNode | null;
      if (typedNode) {
        // Get mouse position from window event
        const event = window.event as MouseEvent | undefined;
        if (event) {
          setTooltip({
            title: typedNode.label,
            linkCount: typedNode.linkCount,
            x: event.clientX,
            y: event.clientY,
            visible: true,
          });
        }
      } else {
        setTooltip((prev) => ({ ...prev, visible: false }));
      }
    },
    []
  );

  const theme = getThemeMode();

  // Custom node rendering: circle with size based on linkCount
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nodeCanvasObject = useCallback(
    (
      nodeObj: any,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const node = nodeObj as ForceGraphNode;
      const label = node.label;
      const fontSize = Math.max(12 / globalScale, 3);
      const baseRadius = getNodeRadius(node.linkCount, 3);
      
      // Check if this node is highlighted from search
      const isHighlighted = highlightedNodes.includes(node.id);
      const hasSearchActive = highlightedNodes.length > 0;
      
      // Adjust radius for highlighted nodes
      const radius = isHighlighted ? baseRadius * 1.5 : baseRadius;

      // Determine color using palette
      const centerId = highlightCenter ? pageId : undefined;
      const baseColor = getNodeColor(node, theme, centerId);
      
      // Apply highlight/dim effect based on search
      let color = baseColor;
      if (hasSearchActive) {
        if (isHighlighted) {
          // Bright blue for highlighted nodes
          color = "#3b82f6";
        } else {
          // Dim non-matching nodes
          color = theme === "dark" ? "rgba(100,100,100,0.4)" : "rgba(150,150,150,0.4)";
        }
      }

      // Draw glow effect for highlighted nodes
      if (isHighlighted) {
        ctx.beginPath();
        ctx.arc(node.x || 0, node.y || 0, radius + 4, 0, 2 * Math.PI, false);
        ctx.fillStyle = "rgba(59, 130, 246, 0.3)";
        ctx.fill();
      }

      // Draw circle
      ctx.beginPath();
      ctx.arc(node.x || 0, node.y || 0, radius, 0, 2 * Math.PI, false);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw label (only if enabled and zoomed in enough, or always for highlighted)
      if ((showLabels && globalScale > 0.8) || isHighlighted) {
        ctx.font = `${isHighlighted ? "bold " : ""}${fontSize}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        
        // Text color: brighter for highlighted, dimmed for non-matching during search
        if (hasSearchActive) {
          ctx.fillStyle = isHighlighted
            ? (theme === "dark" ? "#ffffff" : "#1e40af")
            : (theme === "dark" ? "rgba(229,231,235,0.4)" : "rgba(55,53,47,0.4)");
        } else {
          ctx.fillStyle = theme === "dark" ? "#E5E7EB" : "#37352f";
        }

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
    [highlightCenter, pageId, showLabels, theme, highlightedNodes]
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
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <ForceGraph2D
        ref={graphRef as any}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onEngineStop={handleEngineStop}
        linkColor={() => getEdgeColor(theme)}
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

      {/* Legend and stats */}
      <GraphLegend
        theme={theme}
        nodeCount={graphData.nodes.length}
        edgeCount={graphData.links.length}
      />
    </div>
  );
}
