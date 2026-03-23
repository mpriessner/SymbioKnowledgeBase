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

/** Metadata for a single synced database stored in .skb-meta.json */
export interface SyncDatabaseEntry {
  /** Database UUID */
  id: string;
  /** Relative file path within the tenant folder (e.g. "Databases/Tasks.md") */
  filePath: string;
  /** MD5 hash of the last-synced file content */
  contentHash: string;
  /** ISO 8601 timestamp of the last sync */
  lastSynced: string;
  /** Number of rows, for index generation without re-reading the file */
  rowCount: number;
}

/** Top-level structure of .skb-meta.json (v2) */
export interface SyncMetadata {
  /** Schema version for forward-compatibility */
  version: 1 | 2;
  /** Tenant UUID */
  tenantId: string;
  /** ISO 8601 timestamp of last full sync */
  lastFullSync: string;
  /** Map of page ID → sync entry */
  pages: Record<string, SyncPageEntry>;
  /** Map of database ID → sync entry (added in v2) */
  databases: Record<string, SyncDatabaseEntry>;
}

/**
 * Migrate metadata from v1 to the latest version (v2).
 * Adds an empty databases section if missing and bumps the version.
 * Pages section is never modified.
 */
export function migrateMetadata(meta: SyncMetadata): SyncMetadata {
  if (!meta.version || meta.version < 2) {
    return {
      ...meta,
      version: 2,
      databases: meta.databases || {},
    };
  }
  return meta;
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
