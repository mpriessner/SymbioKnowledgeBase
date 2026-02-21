export {
  extractWikilinks,
  extractWikilinkNodes,
  extractResolvedPageIds,
} from "./parser";
export {
  resolveWikilinks,
  resolveUnresolvedLinksForNewPage,
} from "./resolver";
export {
  updatePageLinks,
  rebuildPageLinks,
  rebuildAllPageLinks,
} from "./indexer";
export {
  updateWikilinksOnRename,
  updateWikilinkNodesInDocument,
  markWikilinksAsDeleted,
} from "./renameUpdater";
export type {
  ExtractedWikilink,
  ExtractedWikilinkNode,
  ResolvedWikilinks,
  TipTapNode,
  TipTapDocument,
} from "./types";
