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
  /** Whether to show edge labels (default false) */
  showEdgeLabels?: boolean;
  /** Whether to show node circles (default true) */
  showNodes?: boolean;
  /** Whether to show edge lines (default true) */
  showEdges?: boolean;
  /** Callback to expose the graph ref for external zoom controls */
  onGraphRef?: (ref: GraphRefHandle | null) => void;
  /** Node IDs to highlight (from search) */
  highlightedNodes?: string[];
}

/** Extended GraphNode with force-simulation coordinates */
interface ForceGraphNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

/** 
 * Generic node object type from react-force-graph callbacks.
 * Uses index signature since force-graph adds arbitrary properties.
 */
interface GenericNodeObject {
  id?: string | number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
  [key: string]: unknown;
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
  showEdgeLabels = false,
  showNodes = true,
  showEdges = true,
  onGraphRef,
  highlightedNodes = [],
}: GraphViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // react-force-graph-2d has loose internal typing that conflicts with strict TS
  // Using GraphRefHandle which matches the methods we actually use
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
    oneLiner: string | null;
    x: number;
    y: number;
    visible: boolean;
  }>({
    title: "",
    linkCount: 0,
    oneLiner: null,
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

  // Responsive sizing — use ResizeObserver so the graph re-renders whenever
  // its container becomes visible (e.g. after collapse → expand).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const w = width || el.clientWidth;
      const h = height || el.clientHeight;
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    };

    // Measure immediately in case layout is already resolved
    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

  // Click handler: navigate to page
   
  const handleNodeClick = useCallback(
    (node: GenericNodeObject | null) => {
      if (node?.id) {
        router.push(`/pages/${node.id}`);
      }
    },
    [router]
  );

  // Hover handler: show/hide tooltip
   
  const handleNodeHover = useCallback(
    (node: GenericNodeObject | null, _previousNode: GenericNodeObject | null) => {
      if (node) {
        // Cast to ForceGraphNode to access our custom properties (via unknown for strict TS)
        const typedNode = node as unknown as ForceGraphNode;
        // Get mouse position from window event
        const event = window.event as MouseEvent | undefined;
        if (event) {
          setTooltip({
            title: typedNode.label,
            linkCount: typedNode.linkCount,
            oneLiner: typedNode.oneLiner,
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

  // Use refs so toggling display options doesn't recreate callbacks
  // (which would restart the force simulation and cause wiggle)
  const showLabelsRef = useRef(showLabels);
  const showEdgeLabelsRef = useRef(showEdgeLabels);
  const showNodesRef = useRef(showNodes);
  const showEdgesRef = useRef(showEdges);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { showEdgeLabelsRef.current = showEdgeLabels; }, [showEdgeLabels]);
  useEffect(() => { showNodesRef.current = showNodes; }, [showNodes]);
  useEffect(() => { showEdgesRef.current = showEdges; }, [showEdges]);

  // Force canvas repaint when any display toggle changes (without restarting simulation)
  useEffect(() => {
    if (graphRef.current) {
      (graphRef.current as GraphRefHandle).centerAt(undefined as unknown as number, undefined as unknown as number, 0);
    }
  }, [showLabels, showEdgeLabels, showNodes, showEdges]);

  // Custom node rendering: circle with size based on linkCount

  const nodeCanvasObject = useCallback(
    (
      nodeObj: GenericNodeObject,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      // Skip drawing entirely when nodes are hidden
      if (!showNodesRef.current) return;

      // Cast to our extended type to access custom properties (via unknown for strict TS)
      const node = nodeObj as unknown as ForceGraphNode;
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
      if ((showLabelsRef.current && globalScale > 0.8) || isHighlighted) {
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
    [highlightCenter, pageId, theme, highlightedNodes]
  );

  // Custom edge rendering: line with optional label at midpoint
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const linkCanvasObject = useCallback(
    (
      linkObj: any,
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const source = linkObj.source as GenericNodeObject | undefined;
      const target = linkObj.target as GenericNodeObject | undefined;
      if (source?.x == null || source?.y == null || target?.x == null || target?.y == null) return;

      // Draw edge line
      if (showEdgesRef.current) {
        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);
        ctx.strokeStyle = getEdgeColor(theme);
        ctx.lineWidth = 1 / globalScale;
        ctx.stroke();

        // Draw arrow at target
        const arrowLength = 6 / globalScale;
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const angle = Math.atan2(dy, dx);
        // Position arrow slightly before target (account for node radius)
        const nodeRadius = 4;
        const ax = target.x - Math.cos(angle) * nodeRadius;
        const ay = target.y - Math.sin(angle) * nodeRadius;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(
          ax - arrowLength * Math.cos(angle - Math.PI / 6),
          ay - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          ax - arrowLength * Math.cos(angle + Math.PI / 6),
          ay - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = getEdgeColor(theme);
        ctx.fill();
      }

      // Draw label at midpoint (if enabled and zoomed in enough)
      if (showEdgeLabelsRef.current && showEdgesRef.current && globalScale > 1.2) {
        const midX = (source.x + target.x) / 2;
        const midY = (source.y + target.y) / 2;
        const fontSize = Math.max(10 / globalScale, 2);
        ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = theme === "dark" ? "rgba(229,231,235,0.6)" : "rgba(55,53,47,0.6)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("\u2192", midX, midY);
      }
    },
    [theme]
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
      { }
      <ForceGraph2D
        ref={graphRef as unknown as React.MutableRefObject<never>}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        onEngineStop={handleEngineStop}
        linkCanvasObject={linkCanvasObject}
        linkCanvasObjectMode={() => "replace"}
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
        oneLiner={tooltip.oneLiner}
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
