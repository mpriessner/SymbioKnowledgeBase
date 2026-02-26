/**
 * Per-file sync lock to prevent infinite sync loops.
 *
 * When DB→FS writes a file, it acquires a lock for that path.
 * The file watcher checks the lock before processing changes.
 * Locks auto-expire after a timeout to prevent deadlocks.
 */

const DEFAULT_LOCK_TTL_MS = 5000; // 5 seconds

interface LockEntry {
  /** When the lock was acquired */
  acquiredAt: number;
  /** Time-to-live in ms */
  ttl: number;
}

class SyncLockManager {
  private locks = new Map<string, LockEntry>();

  /**
   * Acquire a lock for a file path.
   * Returns true if the lock was acquired (or already held).
   */
  acquire(filePath: string, ttlMs: number = DEFAULT_LOCK_TTL_MS): boolean {
    this.cleanup();
    this.locks.set(filePath, { acquiredAt: Date.now(), ttl: ttlMs });
    return true;
  }

  /**
   * Release a lock for a file path.
   */
  release(filePath: string): void {
    this.locks.delete(filePath);
  }

  /**
   * Check if a file path is currently locked.
   */
  isLocked(filePath: string): boolean {
    this.cleanup();
    return this.locks.has(filePath);
  }

  /**
   * Remove expired locks.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [path, entry] of this.locks) {
      if (now - entry.acquiredAt > entry.ttl) {
        this.locks.delete(path);
      }
    }
  }

  /**
   * Clear all locks (for testing).
   */
  clear(): void {
    this.locks.clear();
  }
}

/** Singleton sync lock manager */
export const syncLock = new SyncLockManager();
