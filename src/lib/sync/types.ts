/**
 * Sync-related TypeScript types.
 */

/** Metadata for a single synced page stored in .skb-meta.json */
export interface SyncPageEntry {
  /** Database page UUID */
  id: string;
  /** Relative file path within the tenant folder (e.g. "Projects/_index.md") */
  filePath: string;
  /** MD5 hash of the last-synced .md file content */
  contentHash: string;
  /** ISO 8601 timestamp of the last sync */
  lastSynced: string;
}

/** Top-level structure of .skb-meta.json */
export interface SyncMetadata {
  /** Schema version for forward-compatibility */
  version: 1;
  /** Tenant UUID */
  tenantId: string;
  /** ISO 8601 timestamp of last full sync */
  lastFullSync: string;
  /** Map of page ID → sync entry */
  pages: Record<string, SyncPageEntry>;
}

/** Minimal page data needed for folder structure generation */
export interface SyncPageData {
  id: string;
  title: string;
  icon: string | null;
  oneLiner?: string | null;
  summary?: string | null;
  summaryUpdatedAt?: Date | null;
  parentId: string | null;
  position: number;
  spaceType: string;
  createdAt: Date;
  updatedAt: Date;
  blocks: Array<{
    id: string;
    content: unknown;
    position: number;
  }>;
}
