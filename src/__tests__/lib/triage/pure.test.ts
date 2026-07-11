import { describe, test, expect } from "vitest";
import {
  canonicalPair,
  computeFingerprint,
} from "@/lib/triage/fingerprint";
import { keysetClause, advanceCursor } from "@/lib/triage/keyset";
import { nextAttemptAt, isExhausted } from "@/lib/triage/defer";
import {
  parseRelevanceScore,
  parseContradictionVerdict,
  contradictionSeverity,
} from "@/lib/triage/modelParse";
import { triageConfigFromEnv } from "@/lib/triage/config";
import { isoWeekKey } from "@/lib/triage/healthCheck";

describe("fingerprint — canonicalized pairs", () => {
  test("(A,B) and (B,A) produce the SAME canonical pair", () => {
    expect(canonicalPair("b", "a")).toEqual(["a", "b"]);
    expect(canonicalPair("a", "b")).toEqual(["a", "b"]);
  });

  test("a pair fingerprint is order-independent", () => {
    const [a1, b1] = canonicalPair("page-9", "page-1");
    const [a2, b2] = canonicalPair("page-1", "page-9");
    const f1 = computeFingerprint({
      kind: "POSSIBLE_DUPLICATE",
      participants: [a1, b1],
    });
    const f2 = computeFingerprint({
      kind: "POSSIBLE_DUPLICATE",
      participants: [a2, b2],
    });
    expect(f1).toBe(f2);
  });

  test("different kind or scopedKey yields a different fingerprint", () => {
    const base = computeFingerprint({ kind: "STALE", participants: ["p1"], scopedKey: "k" });
    expect(base).not.toBe(
      computeFingerprint({ kind: "STALE", participants: ["p1"], scopedKey: "k2" })
    );
    expect(base).not.toBe(
      computeFingerprint({ kind: "POSSIBLE_DUPLICATE", participants: ["p1"], scopedKey: "k" })
    );
  });
});

describe("keyset pagination", () => {
  test("predicate is a strict > over (anchor,id) with correct ordering", () => {
    const { predicate, order } = keysetClause('"tx_created"', '"id"', "$2", "$3");
    expect(predicate).toContain('"tx_created" > $2');
    expect(predicate).toContain('"tx_created" = $2 AND "id" > $3');
    expect(order).toBe('"tx_created" ASC, "id" ASC');
  });

  test("advanceCursor returns the LAST row's keyset, null when empty", () => {
    expect(advanceCursor([])).toBeNull();
    const at1 = new Date("2026-01-01");
    const at2 = new Date("2026-02-01");
    expect(
      advanceCursor([
        { cursorAt: at1, cursorId: "a" },
        { cursorAt: at2, cursorId: "b" },
      ])
    ).toEqual({ cursorAt: at2, cursorId: "b" });
  });
});

describe("DEFERRED backoff", () => {
  const config = triageConfigFromEnv({ TRIAGE_DEFER_BACKOFF_MS: "1000", TRIAGE_DEFER_MAX_RETRIES: "3" } as never);
  const now = new Date("2026-07-11T00:00:00Z");

  test("backoff grows with attempts and is capped at 8x", () => {
    const t0 = nextAttemptAt(0, config, now).getTime() - now.getTime();
    const t1 = nextAttemptAt(1, config, now).getTime() - now.getTime();
    const t2 = nextAttemptAt(2, config, now).getTime() - now.getTime();
    const tBig = nextAttemptAt(10, config, now).getTime() - now.getTime();
    expect(t0).toBe(1000);
    expect(t1).toBe(2000);
    expect(t2).toBe(4000);
    expect(tBig).toBe(8000); // capped
  });

  test("isExhausted fires at max retries", () => {
    expect(isExhausted(2, config)).toBe(false);
    expect(isExhausted(3, config)).toBe(true);
  });
});

describe("model output parsing (fail-safe)", () => {
  test("relevance score parse clamps 0..1 and defaults 0 on garbage", () => {
    expect(parseRelevanceScore("0.8")).toBeCloseTo(0.8);
    expect(parseRelevanceScore("Relevance: 0.42 out of 1")).toBeCloseTo(0.42);
    expect(parseRelevanceScore("1")).toBe(1);
    expect(parseRelevanceScore("no number here")).toBe(0);
  });

  test("contradiction verdict parse + severity mapping", () => {
    expect(parseContradictionVerdict("YES they contradict")).toBe("yes");
    expect(parseContradictionVerdict("maybe, unclear")).toBe("maybe");
    expect(parseContradictionVerdict("no, they agree")).toBe("no");
    expect(parseContradictionVerdict("garbage")).toBe("no");
    expect(contradictionSeverity("yes")).toBeGreaterThan(contradictionSeverity("maybe"));
    expect(contradictionSeverity("no")).toBe(0);
  });
});

describe("weekly digest period key", () => {
  test("isoWeekKey is stable YYYY-Www", () => {
    expect(isoWeekKey(new Date("2026-07-11T12:00:00Z"))).toMatch(/^2026-W\d{2}$/);
    // Same week → same key (idempotency anchor).
    expect(isoWeekKey(new Date("2026-07-06T00:00:00Z"))).toBe(
      isoWeekKey(new Date("2026-07-10T23:00:00Z"))
    );
  });
});
