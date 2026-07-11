import { describe, test, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  extractScopedTriple,
  scopedKeyString,
} from "@/lib/knowledge/subjectRelation";

/**
 * Unit tests for the W81-B1 inline supersession service against a hand-built
 * prisma mock. Proves the review-hardened rules without a live DB:
 *  - strict newer.tValid > older.tValid,
 *  - UNKNOWN precision defers, equal-time late-arrival flags,
 *  - the CONTRADICTS/EXACT-FUZZY trust gate,
 *  - present- vs future-effective (derived status),
 *  - the conditional UPDATE (count=0 ⇒ no audit, no apply),
 *  - advisory locks acquired in sorted scopedKey order,
 *  - no code path deletes or UPDATE-in-places a Claim's text.
 */

const h = vi.hoisted(() => ({
  claimRows: [] as Array<Record<string, unknown>>,
  trustGateClaimIds: new Set<string>(),
  bodyPlainText: "" as string | null,
  updateManyCalls: [] as Array<Record<string, unknown>>,
  updateManyCount: 1,
  supersessionCreates: [] as Array<Record<string, unknown>>,
  txExecRaw: [] as unknown[][],
  globalExecRaw: [] as unknown[][],
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $executeRaw: (...a: unknown[]) => {
      h.txExecRaw.push(a);
      return Promise.resolve(1);
    },
    claim: {
      updateMany: (args: Record<string, unknown>) => {
        h.updateManyCalls.push(args);
        return Promise.resolve({ count: h.updateManyCount });
      },
    },
    claimSupersession: {
      create: (args: Record<string, unknown>) => {
        h.supersessionCreates.push(args);
        return Promise.resolve({});
      },
    },
  };
  const prisma = {
    claim: { findMany: () => Promise.resolve(h.claimRows) },
    claimEvidence: {
      findFirst: (args: { where: { claimId: string } }) =>
        Promise.resolve(
          h.trustGateClaimIds.has(args.where.claimId) ? { id: "ev" } : null
        ),
    },
    documentVersion: {
      findFirst: () =>
        Promise.resolve(
          h.bodyPlainText === null ? null : { plainText: h.bodyPlainText }
        ),
    },
    $executeRaw: (...a: unknown[]) => {
      h.globalExecRaw.push(a);
      return Promise.resolve(1);
    },
    $transaction: (cb: (t: typeof tx) => unknown) => Promise.resolve(cb(tx)),
  };
  return { prisma };
});

const { runInlineSupersession } = await import("@/lib/knowledge/supersession");

function claim(
  id: string,
  text: string,
  tValid: Date,
  opts: { precision?: "EXACT" | "APPROX" | "UNKNOWN"; pageId?: string } = {}
) {
  return {
    id,
    pageId: opts.pageId ?? "p1",
    text,
    tValid,
    datePrecision: opts.precision ?? "EXACT",
    status: "ACTIVE",
  };
}

const MAY = new Date("2026-05-01T00:00:00Z");
const JUNE = new Date("2026-06-01T00:00:00Z");
const FUTURE = new Date(Date.now() + 365 * 24 * 3600 * 1000);

beforeEach(() => {
  h.claimRows = [];
  h.trustGateClaimIds = new Set();
  h.bodyPlainText = "the yield was 87%";
  h.updateManyCalls = [];
  h.updateManyCount = 1;
  h.supersessionCreates = [];
  h.txExecRaw = [];
  h.globalExecRaw = [];
});

describe("present-effective supersession", () => {
  test("applies a conditional SUPERSEDED update + audit row; never writes claim text", async () => {
    h.claimRows = [
      claim("old", "The yield was 72%.", MAY),
      claim("new", "The yield was 87%.", JUNE),
    ];
    h.trustGateClaimIds.add("old");

    const res = await runInlineSupersession("t1", ["p1"]);

    expect(res.applied).toHaveLength(1);
    expect(res.applied[0]).toMatchObject({ oldClaimId: "old", newClaimId: "new", effectiveNow: true });
    expect(h.updateManyCalls).toHaveLength(1);
    const call = h.updateManyCalls[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    // Conditional guard so two jobs can't both win.
    expect(call.where).toMatchObject({ id: "old", status: "ACTIVE", tInvalid: null });
    expect(call.data.status).toBe("SUPERSEDED");
    expect(call.data.tInvalid).toEqual(JUNE);
    expect(call.data.supersededByClaimId).toBe("new");
    expect(call.data.txExpired).toBeInstanceOf(Date);
    // Never UPDATE-in-place the fact text.
    expect(call.data).not.toHaveProperty("text");
    // Idempotent audit row.
    expect(h.supersessionCreates).toHaveLength(1);
    expect((h.supersessionCreates[0] as { data: Record<string, unknown> }).data).toMatchObject({
      oldClaimId: "old",
      newClaimId: "new",
      effectiveNow: true,
    });
  });

  test("body already reflecting the new fact ⇒ NOT contested (guard) + clears the signal", async () => {
    h.claimRows = [claim("old", "The yield was 72%.", MAY), claim("new", "The yield was 87%.", JUNE)];
    h.trustGateClaimIds.add("old");
    h.bodyPlainText = "The yield was 87% after optimization."; // contains new fact
    const res = await runInlineSupersession("t1", ["p1"]);
    expect(res.contestedPageIds).toHaveLength(0);
  });

  test("body NOT reflecting the new fact ⇒ contested signal emitted", async () => {
    h.claimRows = [claim("old", "The yield was 72%.", MAY), claim("new", "The yield was 87%.", JUNE)];
    h.trustGateClaimIds.add("old");
    h.bodyPlainText = "The yield was 72%."; // still the OLD value
    const res = await runInlineSupersession("t1", ["p1"]);
    expect(res.contestedPageIds).toContain("p1");
  });
});

describe("trust gate", () => {
  test("no qualifying CONTRADICTS evidence (e.g. UNVERIFIED) ⇒ flagged, never applied", async () => {
    h.claimRows = [claim("old", "The yield was 72%.", MAY), claim("new", "The yield was 87%.", JUNE)];
    // trustGateClaimIds intentionally empty → findFirst returns null.
    const res = await runInlineSupersession("t1", ["p1"]);
    expect(h.updateManyCalls).toHaveLength(0);
    expect(res.applied).toHaveLength(0);
    expect(res.flagged).toEqual([{ oldClaimId: "old", newClaimId: "new", reason: "no-trust-gate" }]);
  });
});

describe("temporal safety", () => {
  test("UNKNOWN precision on either side defers (no supersede)", async () => {
    h.claimRows = [
      claim("old", "The yield was 72%.", MAY, { precision: "UNKNOWN" }),
      claim("new", "The yield was 87%.", JUNE),
    ];
    h.trustGateClaimIds.add("old");
    const res = await runInlineSupersession("t1", ["p1"]);
    expect(h.updateManyCalls).toHaveLength(0);
    expect(res.flagged.some((f) => f.reason === "unknown-precision")).toBe(true);
  });

  test("equal tValid (late-arrival) is flagged, never auto-superseded", async () => {
    h.claimRows = [
      claim("a", "The yield was 72%.", JUNE),
      claim("b", "The yield was 87%.", JUNE),
    ];
    h.trustGateClaimIds.add("a");
    h.trustGateClaimIds.add("b");
    const res = await runInlineSupersession("t1", ["p1"]);
    expect(h.updateManyCalls).toHaveLength(0);
    expect(res.flagged.some((f) => f.reason === "late-arrival")).toBe(true);
  });
});

describe("derived effective status — future-effective", () => {
  test("a future newer.tValid keeps older ACTIVE with only a future tInvalid (no txExpired)", async () => {
    h.claimRows = [claim("old", "The yield was 72%.", MAY), claim("new", "The yield was 87%.", FUTURE)];
    h.trustGateClaimIds.add("old");
    const res = await runInlineSupersession("t1", ["p1"]);
    expect(res.applied[0].effectiveNow).toBe(false);
    const call = h.updateManyCalls[0] as { data: Record<string, unknown> };
    expect(call.data.tInvalid).toEqual(FUTURE);
    expect(call.data).not.toHaveProperty("status"); // stays ACTIVE
    expect(call.data).not.toHaveProperty("txExpired");
    // Future-effective is not yet in force ⇒ not contested.
    expect(res.contestedPageIds).toHaveLength(0);
  });
});

describe("conditional UPDATE concurrency", () => {
  test("a lost race (count=0) writes no audit row and is not counted as applied", async () => {
    h.claimRows = [claim("old", "The yield was 72%.", MAY), claim("new", "The yield was 87%.", JUNE)];
    h.trustGateClaimIds.add("old");
    h.updateManyCount = 0; // another job already flipped it
    const res = await runInlineSupersession("t1", ["p1"]);
    expect(h.supersessionCreates).toHaveLength(0);
    expect(res.applied).toHaveLength(0);
  });
});

describe("sorted advisory-lock ordering", () => {
  test("locks are acquired in sorted scopedKey order across keys", async () => {
    // Two collision groups (yield + temperature) → two lock keys.
    h.claimRows = [
      claim("y1", "The yield was 72%.", MAY),
      claim("y2", "The yield was 87%.", JUNE),
      claim("t1c", "The temperature was 20 °C.", MAY),
      claim("t2c", "The temperature was 40 °C.", JUNE),
    ];
    h.trustGateClaimIds.add("y1").add("t1c");
    await runInlineSupersession("t1", ["p1"]);

    const lockKeys = h.txExecRaw
      .filter((a) => String(a[0]).includes("pg_advisory_xact_lock"))
      .map((a) => a[2] as string);
    expect(lockKeys.length).toBe(2);
    const sorted = [...lockKeys].sort();
    expect(lockKeys).toEqual(sorted);
    // Sanity: they are the real scoped keys for the two groups.
    const kYield = scopedKeyString(extractScopedTriple("The yield was 72%.")!.key);
    const kTemp = scopedKeyString(extractScopedTriple("The temperature was 20 °C.")!.key);
    expect(new Set(lockKeys)).toEqual(new Set([kYield, kTemp]));
  });
});

describe("no destructive Claim writes (property guard)", () => {
  test("the service source never deletes a claim nor writes claim text", () => {
    const src = readFileSync(
      join(process.cwd(), "src/lib/knowledge/supersession.ts"),
      "utf8"
    );
    expect(src).not.toMatch(/claim\.delete/);
    expect(src).not.toMatch(/claim\.deleteMany/);
    expect(src).not.toMatch(/claimSupersession\.delete/);
    // No update writes a `text:` field on a claim.
    expect(src).not.toMatch(/data:\s*{[^}]*\btext:/);
  });
});
