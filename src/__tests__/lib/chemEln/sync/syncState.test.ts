import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SyncStateManager } from "@/lib/chemEln/sync/syncState";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("SyncStateManager", () => {
  let testStatePath: string;
  let manager: SyncStateManager;

  beforeEach(async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "sync-state-test-"));
    testStatePath = path.join(tmpDir, "sync-state.json");
    manager = new SyncStateManager(testStatePath);
  });

  afterEach(async () => {
    try {
      await fs.unlink(testStatePath);
    } catch {
      /* ignore */
    }
    try {
      await fs.rmdir(path.dirname(testStatePath));
    } catch {
      /* ignore */
    }
  });

  it("should load default state when file does not exist", async () => {
    const state = await manager.load();
    expect(state.lastSyncTimestamp).toBeNull();
    expect(state.pageHashes).toEqual({});
    expect(state.lastSyncResults).toBeNull();
  });

  it("should save and reload state", async () => {
    manager.setPageHash("eln:EXP-001", "abc123");
    manager.setPageHash("cas:3375-31-3", "def456");
    manager.updateResults({
      created: 10,
      updated: 5,
      skipped: 85,
      failed: 0,
    });
    await manager.save();

    const newManager = new SyncStateManager(testStatePath);
    const state = await newManager.load();

    expect(state.pageHashes["eln:EXP-001"]).toBe("abc123");
    expect(state.pageHashes["cas:3375-31-3"]).toBe("def456");
    expect(state.lastSyncResults?.created).toBe(10);
    expect(state.lastSyncResults?.updated).toBe(5);
    expect(state.lastSyncResults?.skipped).toBe(85);
    expect(state.lastSyncResults?.failed).toBe(0);
    expect(state.lastSyncTimestamp).toBeTruthy();
  });

  it("should detect content changes via hash comparison", () => {
    manager.setPageHash("eln:EXP-001", "abc123");

    expect(manager.isPageChanged("eln:EXP-001", "abc123")).toBe(false);
    expect(manager.isPageChanged("eln:EXP-001", "def456")).toBe(true);
    expect(manager.isPageChanged("eln:EXP-002", "abc123")).toBe(true);
  });

  it("should return null for unknown page hashes", () => {
    expect(manager.getPageHash("nonexistent")).toBeNull();
  });

  it("should return null for last sync time when no sync has occurred", () => {
    expect(manager.getLastSyncTime()).toBeNull();
    expect(manager.getLastSyncTimestamp()).toBeNull();
  });

  it("should return last sync time as Date after updateResults", () => {
    const before = new Date();
    manager.updateResults({ created: 1, updated: 0, skipped: 0, failed: 0 });
    const after = new Date();

    const syncTime = manager.getLastSyncTime();
    expect(syncTime).toBeInstanceOf(Date);
    expect(syncTime!.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(syncTime!.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("should overwrite existing hashes", () => {
    manager.setPageHash("eln:EXP-001", "abc123");
    expect(manager.getPageHash("eln:EXP-001")).toBe("abc123");

    manager.setPageHash("eln:EXP-001", "xyz789");
    expect(manager.getPageHash("eln:EXP-001")).toBe("xyz789");
  });

  it("should create directory if it does not exist on save", async () => {
    const deepPath = path.join(
      os.tmpdir(),
      `sync-test-deep-${Date.now()}`,
      "nested",
      "sync-state.json",
    );
    const deepManager = new SyncStateManager(deepPath);
    deepManager.setPageHash("test", "hash");
    await deepManager.save();

    const loaded = new SyncStateManager(deepPath);
    const state = await loaded.load();
    expect(state.pageHashes["test"]).toBe("hash");

    // Cleanup
    await fs.unlink(deepPath);
    await fs.rmdir(path.dirname(deepPath));
    await fs.rmdir(path.dirname(path.dirname(deepPath)));
  });

  it("should handle corrupted JSON gracefully", async () => {
    await fs.writeFile(testStatePath, "not valid json{{{", "utf-8");

    const state = await manager.load();
    expect(state.lastSyncTimestamp).toBeNull();
    expect(state.pageHashes).toEqual({});
  });

  it("should expose full state via getState", () => {
    manager.setPageHash("tag1", "hash1");
    const state = manager.getState();
    expect(state.pageHashes["tag1"]).toBe("hash1");
  });
});
