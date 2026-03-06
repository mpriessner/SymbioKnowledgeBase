"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useGraphData } from "@/hooks/useGraphData";
import { getNodeColor, getNodeRadiusByContent } from "@/lib/graph/colorPalette";
import type { ThemeMode } from "@/lib/graph/colorPalette";
import type { GraphNode, GraphData } from "@/types/graph";
import SpriteText from "three-spritetext";

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
  showEdgeLabels?: boolean;
  showNodes?: boolean;
  showEdges?: boolean;
  spacing?: number;
  nodeSize?: number;
  sizeMode?: "connections" | "content";
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
  contentLength?: number;
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

/** Subscribe to data-theme attribute changes so the 3D graph re-renders on toggle. */
function useThemeMode(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>(getThemeMode);

  useEffect(() => {
    const el = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(getThemeMode());
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-theme"] });
    // Sync in case the attribute changed before the observer attached
    setTheme(getThemeMode());
    return () => observer.disconnect();
  }, []);

  return theme;
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
  showEdgeLabels = false,
  showNodes = true,
  showEdges = true,
  spacing = 100,
  nodeSize = 4,
  sizeMode = "connections",
}: Graph3DViewProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<any>(null);

  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

  // Debounce nodeSize to prevent rapid WebGL geometry rebuilds when dragging
  // the size slider. nodeRelSize changes cause three.js to regenerate sphere
  // geometries for every node — doing this on every slider tick crashes WebGL.
  const [debouncedNodeSize, setDebouncedNodeSize] = useState(nodeSize);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedNodeSize(nodeSize), 150);
    return () => clearTimeout(timer);
  }, [nodeSize]);

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

  // Explicitly dispose Three.js WebGL renderer on unmount.
  // The library's _destructor only pauses animation and clears data — it does
  // NOT release the WebGL context. Browsers cap contexts at ~8-16, so leaked
  // contexts from 2D/3D toggles or page navigation exhaust the limit and
  // silently prevent new 3D graphs from rendering.
  useEffect(() => {
    return () => {
      const fg = graphRef.current;
      if (!fg) return;
      try {
        fg.pauseAnimation?.();
        const renderer = fg.renderer?.();
        if (renderer) {
          renderer.dispose();
          renderer.forceContextLoss?.();
          // Remove the canvas element the renderer injected
          const canvas = renderer.domElement;
          canvas?.parentNode?.removeChild(canvas);
        }
      } catch { /* ignore cleanup errors */ }
      graphRef.current = null;
    };
  }, []);

  // Responsive sizing — use ResizeObserver to detect container size changes
  // (window resize alone misses layout-driven changes like sidebar open/close)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateDimensions = () => {
      const w = width || el.clientWidth;
      const h = height || el.clientHeight;
      if (w > 0 && h > 0) {
        setDimensions({ width: w, height: h });
      }
    };

    updateDimensions();
    const ro = new ResizeObserver(updateDimensions);
    ro.observe(el);
    return () => ro.disconnect();
  }, [width, height]);

const handleNodeClick = useCallback(
    (node: ForceGraphNodeObject, _event: MouseEvent) => {
      if (node?.id) {
        router.push(`/pages/${node.id}`);
      }
    },
    [router]
  );

  const theme = useThemeMode();
  const centerId = highlightCenter ? pageId : undefined;

  // Use refs so toggling display options doesn't recreate callbacks
  // (which would restart the force simulation and cause wiggle)
  const showLabelsRef = useRef(showLabels);
  const showNodesRef = useRef(showNodes);
  const showEdgesRef = useRef(showEdges);
  const nodeSizeRef = useRef(nodeSize);
  useEffect(() => { showLabelsRef.current = showLabels; }, [showLabels]);
  useEffect(() => { showNodesRef.current = showNodes; }, [showNodes]);
  useEffect(() => { showEdgesRef.current = showEdges; }, [showEdges]);
  useEffect(() => { nodeSizeRef.current = nodeSize; }, [nodeSize]);

  // Update d3 force simulation when spacing changes
  useEffect(() => {
    const fg = graphRef.current;
    if (!fg?.d3Force) return;
    const charge = fg.d3Force("charge");
    if (charge?.strength) {
      charge.strength(-spacing);
    }
    const link = fg.d3Force("link");
    if (link?.distance) {
      link.distance(spacing * 0.5);
    }
    fg.d3ReheatSimulation?.();
  }, [spacing]);

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

  // Dynamic node value for content-based sizing in 3D
  const nodeVal = useCallback(
    (node: ForceGraphNodeObject) => {
      if (sizeMode === "content") {
        const contentLength = (node as unknown as GraphNode).contentLength || 0;
        return getNodeRadiusByContent(contentLength, 1);
      }
      return 1; // default — nodeRelSize handles base sizing
    },
    [sizeMode]
  );

  // Always-visible 3D text labels using SpriteText.
  // IMPORTANT: Uses nodeSizeRef instead of nodeSize in deps to prevent
  // recreating all SpriteText objects (WebGL textures) on every slider tick,
  // which would exhaust WebGL resources and crash the renderer.
  const nodeThreeObject = useCallback(
    (node: ForceGraphNodeObject) => {
      const label = node.label ?? "";
      const displayLabel = label.length > 20 ? label.substring(0, 20) + "..." : label;
      const sprite = new SpriteText(displayLabel);
      sprite.color = theme === "dark" ? "#F3F4F6" : "#1f2937";
      sprite.textHeight = 5;
      sprite.fontFace = "Inter, system-ui, sans-serif";
      sprite.fontWeight = "500";
      sprite.backgroundColor = theme === "dark" ? "rgba(17,24,39,0.7)" : "rgba(255,255,255,0.7)";
      sprite.padding = 2;
      sprite.borderRadius = 3;
      sprite.material.opacity = showLabelsRef.current ? 0.85 : 0;
      sprite.material.transparent = true;
      // Position slightly above the node sphere (use ref to avoid full rebuild)
      sprite.position.y = nodeSizeRef.current + 4;
      return sprite;
    },
    [theme]
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

      {dimensions && <ForceGraph3D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphData}
        nodeId="id"
        nodeColor={nodeColor}
        nodeLabel={nodeLabel}
        nodeRelSize={debouncedNodeSize}
        nodeVal={nodeVal}
        nodeVisibility={() => showNodesRef.current}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={true}
        onNodeClick={handleNodeClick}
        linkColor={() => (theme === "dark" ? "#9CA3AF" : "#D1D5DB")}
        linkWidth={1}
        linkDirectionalArrowLength={5}
        linkDirectionalArrowRelPos={1}
        linkVisibility={() => showEdgesRef.current}
        enableNavigationControls={true}
        enableNodeDrag={true}
        cooldownTime={3000}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.3}
        backgroundColor={theme === "dark" ? "#111827" : "#ffffff"}
      />}
    </div>
  );
}
