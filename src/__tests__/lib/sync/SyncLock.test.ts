import { describe, it, expect, beforeEach } from "vitest";
import { syncLock } from "@/lib/sync/SyncLock";

describe("SyncLock", () => {
  beforeEach(() => {
    syncLock.clear();
  });

  it("acquires and checks a lock", () => {
    expect(syncLock.isLocked("/path/to/file.md")).toBe(false);
    syncLock.acquire("/path/to/file.md");
    expect(syncLock.isLocked("/path/to/file.md")).toBe(true);
  });

  it("releases a lock", () => {
    syncLock.acquire("/path/to/file.md");
    syncLock.release("/path/to/file.md");
    expect(syncLock.isLocked("/path/to/file.md")).toBe(false);
  });

  it("different paths are independent", () => {
    syncLock.acquire("/path/a.md");
    expect(syncLock.isLocked("/path/a.md")).toBe(true);
    expect(syncLock.isLocked("/path/b.md")).toBe(false);
  });

  it("expired locks are cleaned up", () => {
    syncLock.acquire("/path/to/file.md", 1); // 1ms TTL
    // Wait briefly for expiry
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(syncLock.isLocked("/path/to/file.md")).toBe(false);
        resolve();
      }, 10);
    });
  });
});
