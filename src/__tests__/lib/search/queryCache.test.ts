import { describe, test, expect, beforeEach } from "vitest";
import {
  getCachedResult,
  setCachedResult,
  invalidateCache,
} from "@/lib/search/queryCache";

const T = "tenant-1";
const Q = "MTT viability assay";

describe("queryCache", () => {
  beforeEach(() => {
    invalidateCache(); // clear all entries between tests
  });

  test("returns a cached value on an identical lookup", () => {
    setCachedResult(T, Q, "deep", "auto", 2000, 500, { v: 1 });
    expect(getCachedResult(T, Q, "deep", "auto", 2000, 500)).toEqual({ v: 1 });
  });

  test("misses on a different maxBlockChars (content-budget is part of the key)", () => {
    // Regression: a deep result cached at max_block_chars=2000 must NOT be
    // served to a max_block_chars=500 request (which expects smaller blocks).
    setCachedResult(T, Q, "deep", "auto", 2000, 500, { v: "big" });
    expect(getCachedResult(T, Q, "deep", "auto", 500, 500)).toBeUndefined();
  });

  test("misses on a different maxAnswerLength", () => {
    setCachedResult(T, Q, "deep", "auto", 2000, 500, { v: "short" });
    expect(getCachedResult(T, Q, "deep", "auto", 2000, 5000)).toBeUndefined();
  });

  test("misses on a different depth or strategy", () => {
    setCachedResult(T, Q, "deep", "auto", 2000, 500, { v: 1 });
    expect(getCachedResult(T, Q, "medium", "auto", 2000, 500)).toBeUndefined();
    expect(getCachedResult(T, Q, "deep", "rag", 2000, 500)).toBeUndefined();
  });

  test("is tenant-scoped", () => {
    setCachedResult(T, Q, "deep", "auto", 2000, 500, { v: 1 });
    expect(getCachedResult("tenant-2", Q, "deep", "auto", 2000, 500)).toBeUndefined();
  });

  test("normalizes query word order / stop words to the same key", () => {
    setCachedResult(T, "MTT safety handling", "deep", "auto", 2000, 500, { v: 1 });
    // Same content tokens, reordered + stop word added → same normalized key.
    expect(getCachedResult(T, "the handling of MTT safety", "deep", "auto", 2000, 500)).toEqual({ v: 1 });
  });

  test("invalidateCache clears entries", () => {
    setCachedResult(T, Q, "deep", "auto", 2000, 500, { v: 1 });
    invalidateCache();
    expect(getCachedResult(T, Q, "deep", "auto", 2000, 500)).toBeUndefined();
  });
});
