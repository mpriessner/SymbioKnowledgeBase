/**
 * In-memory LRU query result cache (Story 53.7)
 *
 * Caches kb-query results for repeated/similar queries.
 * Normalizes queries so that "NaOH safety" and "safety NaOH" hit the same entry.
 */

import { createHash } from "crypto";

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been",
  "have", "has", "had", "do", "does", "did", "will", "would",
  "shall", "should", "may", "might", "must", "can", "could",
  "of", "in", "to", "for", "with", "on", "at", "by", "from",
  "as", "and", "but", "or", "not", "so", "yet",
  "it", "its", "this", "that", "these", "those",
  "i", "me", "my", "we", "us", "our", "you", "your",
  "what", "which", "who", "how", "where", "when", "why",
  "about", "tell", "give", "show", "find", "get",
]);

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  key: string;
}

const DEFAULT_TTL_MS = 5 * 60 * 1000;   // 5 minutes
const DEFAULT_MAX_ENTRIES = 200;

let cache = new Map<string, CacheEntry<unknown>>();
let maxEntries = DEFAULT_MAX_ENTRIES;

/**
 * Normalize a query for cache key generation.
 * Lowercases, strips stop words, sorts remaining tokens.
 */
function normalizeQuery(query: string): string {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .sort()
    .join(" ");
}

/**
 * Generate a cache key from query parameters.
 */
function generateCacheKey(
  tenantId: string,
  query: string,
  depth: string,
  strategy: string
): string {
  const normalized = normalizeQuery(query);
  const raw = `${tenantId}|${normalized}|${depth}|${strategy}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

/**
 * Evict expired entries and trim to max size.
 */
function evict(): void {
  const now = Date.now();
  const expired: string[] = [];

  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      expired.push(key);
    }
  }

  for (const key of expired) {
    cache.delete(key);
  }

  // If still over max, remove oldest entries
  if (cache.size > maxEntries) {
    const entries = [...cache.entries()];
    entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    const toRemove = entries.slice(0, cache.size - maxEntries);
    for (const [key] of toRemove) {
      cache.delete(key);
    }
  }
}

/**
 * Get a cached result. Returns undefined on miss.
 */
export function getCachedResult<T>(
  tenantId: string,
  query: string,
  depth: string,
  strategy: string
): T | undefined {
  const key = generateCacheKey(tenantId, query, depth, strategy);
  const entry = cache.get(key);

  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return undefined;
  }

  return entry.value as T;
}

/**
 * Cache a result.
 */
export function setCachedResult<T>(
  tenantId: string,
  query: string,
  depth: string,
  strategy: string,
  value: T,
  ttlMs: number = DEFAULT_TTL_MS
): void {
  const key = generateCacheKey(tenantId, query, depth, strategy);

  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
    key,
  });

  // Periodic eviction
  if (cache.size > maxEntries * 1.2) {
    evict();
  }
}

/**
 * Invalidate all cache entries for a tenant (called on content changes).
 */
export function invalidateCache(tenantId?: string): void {
  if (!tenantId) {
    cache.clear();
    return;
  }

  // We can't efficiently filter by tenant since the key is hashed.
  // For now, clear all entries — this is fine for the current scale.
  cache.clear();
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  size: number;
  maxEntries: number;
} {
  evict(); // Clean up expired before reporting
  return {
    size: cache.size,
    maxEntries,
  };
}
