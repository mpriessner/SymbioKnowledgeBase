"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { GraphData } from "@/types/graph";

export interface GraphFilters {
  /** Only include nodes updated after this date */
  afterDate: string | null;
  /** Only include nodes updated before this date */
  beforeDate: string | null;
  /** Only include nodes with at least this many connections */
  minLinkCount: number;
  /** Whether to show node labels */
  showLabels: boolean;
  /** Whether to show edge labels */
  showEdgeLabels: boolean;
}

const DEFAULT_FILTERS: GraphFilters = {
  afterDate: null,
  beforeDate: null,
  minLinkCount: 0,
  showLabels: true,
  showEdgeLabels: false,
};

/**
 * Hook for managing graph filter state with URL param persistence.
 *
 * Reads initial state from URL search params and writes back on change.
 * Provides a filtered version of the graph data.
 */
export function useGraphFilters(graphData: GraphData | undefined) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize from URL params
  const [filters, setFilters] = useState<GraphFilters>(() => ({
    afterDate: searchParams.get("after") || null,
    beforeDate: searchParams.get("before") || null,
    minLinkCount: Number(searchParams.get("minLinks")) || 0,
    showLabels: searchParams.get("labels") !== "false",
    showEdgeLabels: searchParams.get("edgeLabels") === "true",
  }));

  // Sync filters to URL params
  const updateUrlParams = useCallback(
    (newFilters: GraphFilters) => {
      const params = new URLSearchParams();

      if (newFilters.afterDate) params.set("after", newFilters.afterDate);
      if (newFilters.beforeDate) params.set("before", newFilters.beforeDate);
      if (newFilters.minLinkCount > 0) {
        params.set("minLinks", String(newFilters.minLinkCount));
      }
      if (!newFilters.showLabels) params.set("labels", "false");
      if (newFilters.showEdgeLabels) params.set("edgeLabels", "true");

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.replace(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  const updateFilter = useCallback(
    <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => {
      setFilters((prev) => {
        const updated = { ...prev, [key]: value };
        updateUrlParams(updated);
        return updated;
      });
    },
    [updateUrlParams]
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    updateUrlParams(DEFAULT_FILTERS);
  }, [updateUrlParams]);

  // Apply filters to graph data
  const filteredData = useMemo((): GraphData => {
    if (!graphData) return { nodes: [], edges: [] };

    // Filter nodes
    let filteredNodes = [...graphData.nodes];

    // Date range filter
    if (filters.afterDate) {
      const afterDate = new Date(filters.afterDate).getTime();
      filteredNodes = filteredNodes.filter(
        (node) => new Date(node.updatedAt).getTime() >= afterDate
      );
    }

    if (filters.beforeDate) {
      const beforeDate = new Date(filters.beforeDate).getTime();
      filteredNodes = filteredNodes.filter(
        (node) => new Date(node.updatedAt).getTime() <= beforeDate
      );
    }

    // Minimum link count filter
    if (filters.minLinkCount > 0) {
      filteredNodes = filteredNodes.filter(
        (node) => node.linkCount >= filters.minLinkCount
      );
    }

    // Filter edges: only keep edges where both source and target survive
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = graphData.edges.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
  }, [graphData, filters]);

  return {
    filters,
    updateFilter,
    resetFilters,
    filteredData,
    isFiltered:
      filters.afterDate !== null ||
      filters.beforeDate !== null ||
      filters.minLinkCount > 0,
  };
}
