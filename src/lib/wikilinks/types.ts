/**
 * A wikilink extracted from TipTap block content.
 */
export interface ExtractedWikilink {
  /** The page name/title referenced by the wikilink */
  pageName: string;
  /** Optional display text (from [[Page|Display]] syntax) */
  displayText?: string;
  /** Position within the document for context extraction */
  position: {
    blockIndex: number;
    offset: number;
  };
}

/**
 * A wikilink extracted from a TipTap wikilink node
 * (already has a pageId from previous resolution).
 */
export interface ExtractedWikilinkNode {
  pageId: string;
  pageName: string;
  displayText?: string;
}

/**
 * Result of resolving wikilinks against the pages table.
 */
export interface ResolvedWikilinks {
  resolved: Array<{
    pageName: string;
    pageId: string;
    displayText?: string;
  }>;
  unresolved: Array<{
    pageName: string;
    displayText?: string;
  }>;
}

/**
 * Represents a TipTap JSON node (simplified for traversal).
 */
export interface TipTapNode {
  type: string;
  content?: TipTapNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

/**
 * A TipTap document (the root node).
 */
export interface TipTapDocument {
  type: "doc";
  content: TipTapNode[];
}
