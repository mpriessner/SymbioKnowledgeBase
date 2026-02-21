import type {
  ExtractedWikilink,
  ExtractedWikilinkNode,
  TipTapNode,
  TipTapDocument,
} from "./types";

/**
 * Regex to match wikilink syntax in raw text.
 * Matches: [[Page Name]] and [[Page Name|Display Text]]
 */
const WIKILINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extracts all wikilinks from a TipTap JSON document.
 */
export function extractWikilinks(
  tiptapJson: TipTapDocument | null | undefined
): ExtractedWikilink[] {
  if (!tiptapJson || !tiptapJson.content) {
    return [];
  }

  const wikilinks: ExtractedWikilink[] = [];
  const seen = new Set<string>();

  traverseNodes(tiptapJson.content, 0, wikilinks, seen);

  return wikilinks;
}

/**
 * Extracts wikilink nodes (type: 'wikilink') that already have resolved pageIds.
 */
export function extractWikilinkNodes(
  tiptapJson: TipTapDocument | null | undefined
): ExtractedWikilinkNode[] {
  if (!tiptapJson || !tiptapJson.content) {
    return [];
  }

  const nodes: ExtractedWikilinkNode[] = [];
  traverseForWikilinkNodes(tiptapJson.content, nodes);
  return nodes;
}

/**
 * Extracts all target page IDs from a TipTap document.
 * Returns only the already-resolved page IDs from wikilink nodes.
 */
export function extractResolvedPageIds(
  tiptapJson: TipTapDocument | null | undefined
): string[] {
  const nodes = extractWikilinkNodes(tiptapJson);
  const uniqueIds = new Set(nodes.map((n) => n.pageId));
  return Array.from(uniqueIds);
}

/**
 * Recursively traverses TipTap nodes, extracting wikilinks from text content.
 */
function traverseNodes(
  nodes: TipTapNode[],
  blockIndex: number,
  results: ExtractedWikilink[],
  seen: Set<string>
): void {
  for (const node of nodes) {
    // Check for wikilink nodes (inserted via autocomplete)
    if (node.type === "wikilink" && node.attrs) {
      const pageName = node.attrs["pageName"] as string | undefined;
      if (pageName && !seen.has(pageName.toLowerCase())) {
        seen.add(pageName.toLowerCase());
        results.push({
          pageName,
          displayText:
            (node.attrs["displayText"] as string | undefined) || undefined,
          position: { blockIndex, offset: 0 },
        });
      }
      return; // Wikilink nodes don't have child content
    }

    // Check text nodes for raw [[wikilink]] syntax
    if (node.type === "text" && node.text) {
      // Reset regex state for each text node
      WIKILINK_REGEX.lastIndex = 0;

      let match: RegExpExecArray | null;
      while ((match = WIKILINK_REGEX.exec(node.text)) !== null) {
        const pageName = match[1].trim();
        const displayText = match[2]?.trim() || undefined;

        if (pageName && !seen.has(pageName.toLowerCase())) {
          seen.add(pageName.toLowerCase());
          results.push({
            pageName,
            displayText,
            position: { blockIndex, offset: match.index },
          });
        }
      }
    }

    // Recurse into child nodes
    if (node.content && node.content.length > 0) {
      traverseNodes(node.content, blockIndex, results, seen);
    }
  }
}

/**
 * Traverses the document tree to find wikilink nodes with resolved page IDs.
 */
function traverseForWikilinkNodes(
  nodes: TipTapNode[],
  results: ExtractedWikilinkNode[]
): void {
  for (const node of nodes) {
    if (node.type === "wikilink" && node.attrs) {
      const pageId = node.attrs["pageId"] as string | undefined;
      const pageName = node.attrs["pageName"] as string | undefined;

      if (pageId && pageName) {
        results.push({
          pageId,
          pageName,
          displayText:
            (node.attrs["displayText"] as string | undefined) || undefined,
        });
      }
    }

    if (node.content) {
      traverseForWikilinkNodes(node.content, results);
    }
  }
}
