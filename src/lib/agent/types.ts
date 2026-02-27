/**
 * Types for Agent Page Tree API (SKB-33.5).
 */

/** Page data fetched from DB with link counts */
export interface PageWithCounts {
  id: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
  parentId: string | null;
  position: number;
  spaceType: string;
  updatedAt: Date;
  summaryUpdatedAt: Date | null;
  _count: {
    sourceLinks: number;
    targetLinks: number;
  };
}

/** Tree node returned by format=tree */
export interface AgentTreeNode {
  id: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
  childCount: number;
  linkCount: number;
  updatedAt: string;
  summaryStale: boolean;
  children: AgentTreeNode[];
}

/** Flat node returned by format=flat */
export interface AgentFlatNode {
  id: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
  parentId: string | null;
  depth: number;
  path: string;
  childCount: number;
  linkCount: number;
  updatedAt: string;
  summaryStale: boolean;
}

/** Metadata included in tree/flat responses */
export interface TreeMeta {
  totalPages: number;
  pagesWithSummaries: number;
  staleSummaries: number;
  generatedAt: string;
}

/** Search result item */
export interface AgentSearchResult {
  id: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
  path: string;
  matchContext: string;
  updatedAt: string;
}

/** Link reference in page detail */
export interface AgentPageLink {
  pageId: string;
  title: string;
  oneLiner: string | null;
}

/** Full page detail response */
export interface AgentPageDetail {
  id: string;
  title: string;
  icon: string | null;
  oneLiner: string | null;
  summary: string | null;
  summaryUpdatedAt: string | null;
  path: string;
  parentId: string | null;
  childCount: number;
  outgoingLinks: AgentPageLink[];
  incomingLinks: AgentPageLink[];
  updatedAt: string;
  createdAt: string;
}
