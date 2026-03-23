import { describe, it, expect } from "vitest";
import {
  ChangeDetector,
  CLOCK_SKEW_BUFFER_MS,
} from "@/lib/chemEln/sync/changeDetector";
import type { ExperimentSnapshot } from "@/lib/chemEln/sync/changeDetector";
import type { EnhancedSyncState } from "@/lib/chemEln/sync/enhancedSyncState";

function makeState(
  experiments: Record<
    string,
    { contentHash: string; lastUpdated: string; reactionType: string; researcher: string }
  > = {},
  lastSyncTimestamp = "2026-03-21T12:00:00.000Z",
): EnhancedSyncState {
  return {
    version: "1.0",
    lastSyncTimestamp,
    experiments,
  };
}

function makeSnapshot(
  id: string,
  contentHash: string,
  updatedAt = "2026-03-21T13:00:00.000Z",
): ExperimentSnapshot {
  return { id, updatedAt, contentHash };
}

describe("ChangeDetector", () => {
  const detector = new ChangeDetector();

  describe("detectChanges", () => {
    it("should classify experiments not in sync state as NEW", () => {
      const state = makeState();
      const current = [makeSnapshot("EXP-001", "hash-a")];

      const changes = detector.detectChanges(current, state);

      expect(changes.new).toHaveLength(1);
      expect(changes.new[0].id).toBe("EXP-001");
      expect(changes.updated).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
    });

    it("should classify experiments with different contentHash as UPDATED", () => {
      const state = makeState({
        "EXP-001": {
          contentHash: "old-hash",
          lastUpdated: "2026-03-20T10:00:00.000Z",
          reactionType: "suzuki",
          researcher: "Dr. A",
        },
      });
      const current = [makeSnapshot("EXP-001", "new-hash")];

      const changes = detector.detectChanges(current, state);

      expect(changes.updated).toHaveLength(1);
      expect(changes.updated[0].id).toBe("EXP-001");
      expect(changes.new).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
    });

    it("should classify experiments in sync state but not in current as DELETED", () => {
      const state = makeState({
        "EXP-001": {
          contentHash: "hash-a",
          lastUpdated: "2026-03-20T10:00:00.000Z",
          reactionType: "suzuki",
          researcher: "Dr. A",
        },
      });
      const current: ExperimentSnapshot[] = [];

      const changes = detector.detectChanges(current, state);

      expect(changes.deleted).toHaveLength(1);
      expect(changes.deleted[0]).toBe("EXP-001");
      expect(changes.new).toHaveLength(0);
      expect(changes.updated).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
    });

    it("should classify experiments with same contentHash as UNCHANGED", () => {
      const state = makeState({
        "EXP-001": {
          contentHash: "same-hash",
          lastUpdated: "2026-03-20T10:00:00.000Z",
          reactionType: "suzuki",
          researcher: "Dr. A",
        },
      });
      const current = [makeSnapshot("EXP-001", "same-hash")];

      const changes = detector.detectChanges(current, state);

      expect(changes.unchanged).toHaveLength(1);
      expect(changes.unchanged[0]).toBe("EXP-001");
      expect(changes.new).toHaveLength(0);
      expect(changes.updated).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
    });

    it("should handle mixed changes correctly", () => {
      const state = makeState({
        "EXP-001": {
          contentHash: "hash-1",
          lastUpdated: "2026-03-20T10:00:00.000Z",
          reactionType: "suzuki",
          researcher: "Dr. A",
        },
        "EXP-002": {
          contentHash: "hash-2",
          lastUpdated: "2026-03-20T11:00:00.000Z",
          reactionType: "grignard",
          researcher: "Dr. B",
        },
        "EXP-003": {
          contentHash: "hash-3",
          lastUpdated: "2026-03-20T12:00:00.000Z",
          reactionType: "aldol",
          researcher: "Dr. C",
        },
      });

      const current = [
        makeSnapshot("EXP-001", "hash-1"),       // unchanged
        makeSnapshot("EXP-002", "hash-2-new"),    // updated
        makeSnapshot("EXP-004", "hash-4"),        // new
      ];

      const changes = detector.detectChanges(current, state);

      expect(changes.unchanged).toEqual(["EXP-001"]);
      expect(changes.updated).toHaveLength(1);
      expect(changes.updated[0].id).toBe("EXP-002");
      expect(changes.new).toHaveLength(1);
      expect(changes.new[0].id).toBe("EXP-004");
      expect(changes.deleted).toEqual(["EXP-003"]);
    });

    it("should return all empty arrays for empty inputs", () => {
      const state = makeState();
      const changes = detector.detectChanges([], state);

      expect(changes.new).toHaveLength(0);
      expect(changes.updated).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
      expect(changes.unchanged).toHaveLength(0);
    });
  });

  describe("getQueryTimestamp", () => {
    it("should subtract 60 seconds from lastSyncTimestamp", () => {
      const syncTime = "2026-03-21T12:00:00.000Z";
      const state = makeState({}, syncTime);

      const queryTs = detector.getQueryTimestamp(state);
      const queryDate = new Date(queryTs);
      const syncDate = new Date(syncTime);

      expect(syncDate.getTime() - queryDate.getTime()).toBe(
        CLOCK_SKEW_BUFFER_MS,
      );
    });

    it("should return a valid ISO timestamp", () => {
      const state = makeState({}, "2026-03-21T12:00:00.000Z");
      const queryTs = detector.getQueryTimestamp(state);
      expect(new Date(queryTs).toISOString()).toBe(queryTs);
    });
  });

  describe("content hash stability", () => {
    it("should classify experiment as unchanged when content hash is stable", () => {
      const hash = "abcdef1234567890";
      const state = makeState({
        "EXP-001": {
          contentHash: hash,
          lastUpdated: "2026-03-20T10:00:00.000Z",
          reactionType: "suzuki",
          researcher: "Dr. A",
        },
      });

      // Same experiment fetched again with same hash
      const current = [makeSnapshot("EXP-001", hash, "2026-03-21T15:00:00.000Z")];
      const changes = detector.detectChanges(current, state);

      expect(changes.unchanged).toEqual(["EXP-001"]);
      expect(changes.updated).toHaveLength(0);
    });
  });
});
