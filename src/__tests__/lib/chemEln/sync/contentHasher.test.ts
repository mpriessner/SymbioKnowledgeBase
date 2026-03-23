import { describe, it, expect } from "vitest";
import { computeContentHash } from "@/lib/chemEln/sync/contentHasher";

describe("computeContentHash", () => {
  it("should produce deterministic hashes for the same data", () => {
    const data = { name: "Suzuki Coupling", yield: 85, catalyst: "Pd" };
    const hash1 = computeContentHash(data);
    const hash2 = computeContentHash(data);
    expect(hash1).toBe(hash2);
  });

  it("should produce the same hash regardless of key order", () => {
    const data1 = { name: "Suzuki Coupling", yield: 85, catalyst: "Pd" };
    const data2 = { catalyst: "Pd", name: "Suzuki Coupling", yield: 85 };
    expect(computeContentHash(data1)).toBe(computeContentHash(data2));
  });

  it("should produce different hashes for different data", () => {
    const data1 = { name: "Suzuki Coupling", yield: 85 };
    const data2 = { name: "Suzuki Coupling", yield: 90 };
    expect(computeContentHash(data1)).not.toBe(computeContentHash(data2));
  });

  it("should exclude volatile fields (updatedAt, createdAt, syncTimestamp)", () => {
    const base = { name: "Experiment A", yield: 75 };
    const withTimestamps = {
      ...base,
      updatedAt: "2026-03-21T10:00:00Z",
      createdAt: "2026-03-20T08:00:00Z",
      syncTimestamp: "2026-03-21T12:00:00Z",
    };
    expect(computeContentHash(base)).toBe(computeContentHash(withTimestamps));
  });

  it("should exclude snake_case volatile fields (updated_at, created_at)", () => {
    const base = { name: "Experiment B", yield: 60 };
    const withTimestamps = {
      ...base,
      updated_at: "2026-03-21T10:00:00Z",
      created_at: "2026-03-20T08:00:00Z",
    };
    expect(computeContentHash(base)).toBe(computeContentHash(withTimestamps));
  });

  it("should strip volatile fields from nested objects", () => {
    const base = { name: "Exp", details: { reagent: "NaOH" } };
    const withNested = {
      name: "Exp",
      details: { reagent: "NaOH", updatedAt: "2026-01-01" },
    };
    expect(computeContentHash(base)).toBe(computeContentHash(withNested));
  });

  it("should strip volatile fields from objects in arrays", () => {
    const base = {
      chemicals: [{ name: "Pd", role: "catalyst" }],
    };
    const withTimestamps = {
      chemicals: [
        { name: "Pd", role: "catalyst", createdAt: "2026-01-01" },
      ],
    };
    expect(computeContentHash(base)).toBe(
      computeContentHash(withTimestamps),
    );
  });

  it("should return a 64-character hex string (SHA-256)", () => {
    const hash = computeContentHash({ test: true });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});
