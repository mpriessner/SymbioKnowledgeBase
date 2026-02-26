import path from "path";

/**
 * Filesystem mirror configuration.
 *
 * The mirror root can be set via MIRROR_DIR env variable.
 * Defaults to `data/mirror/` relative to the project root.
 */
export const MIRROR_ROOT =
  process.env.MIRROR_DIR || path.resolve(process.cwd(), "data", "mirror");

/** Metadata filename inside each tenant root */
export const META_FILENAME = ".skb-meta.json";

/** Index filename for pages that have children */
export const INDEX_FILENAME = "_index.md";

/** Debounce interval for FS→DB sync (ms) */
export const FS_DEBOUNCE_MS = 500;

/** Debounce interval for DB→FS sync (ms) */
export const DB_DEBOUNCE_MS = 200;
