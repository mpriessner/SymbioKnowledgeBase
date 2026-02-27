import { z } from "zod";

/**
 * A node in the knowledge graph (represents a page).
 */
export interface GraphNode {
  id: string;
  label: string;
  icon: string | null;
  oneLiner: string | null;
  linkCount: number;
  updatedAt: string;
  contentLength: number;
}

/**
 * An edge in the knowledge graph (represents a wikilink).
 */
export interface GraphEdge {
  source: string;
  target: string;
}

/**
 * The complete graph data structure returned by the API.
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * API response for the graph endpoint.
 */
export interface GraphApiResponse {
  data: GraphData;
  meta: {
    nodeCount: number;
    edgeCount: number;
  };
}

/**
 * Zod schema for validating graph API query parameters.
 */
export const GraphQuerySchema = z.object({
  pageId: z.string().uuid().optional(),
  depth: z.coerce
    .number()
    .int()
    .min(1, "Depth must be at least 1")
    .max(5, "Depth must be at most 5")
    .default(2),
});

export type GraphQueryParams = z.infer<typeof GraphQuerySchema>;
