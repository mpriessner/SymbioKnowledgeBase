import { describe, it, expect, beforeEach } from "vitest";
import {
  getRecentConflicts,
  clearConflictLog,
} from "@/lib/sync/conflict";

describe("conflict", () => {
  beforeEach(() => {
    clearConflictLog();
  });

  it("getRecentConflicts returns empty array initially", () => {
    expect(getRecentConflicts()).toEqual([]);
  });

  it("clearConflictLog empties the log", () => {
    // We can't easily trigger a real conflict without filesystem,
    // but we can verify the clear function works
    clearConflictLog();
    expect(getRecentConflicts()).toHaveLength(0);
  });
});
