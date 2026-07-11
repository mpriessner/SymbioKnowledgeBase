import { describe, test, expect, vi, beforeEach } from "vitest";
import {
  unverifiedSentinel,
  sha256,
  normalizeText,
} from "@/lib/provenance/quoteMatch";

vi.mock("@/lib/markdown/deserializer", () => ({
  markdownToTiptap: () => ({ content: { type: "doc", content: [] } }),
}));
vi.mock("@/lib/search/indexer", () => ({
  extractPlainText: () => "plain text body",
}));
// Keep the wrapper's global-prisma deps inert; the Tx tests use a hand-built tx.
const mockTransaction = vi.fn();
const mockGather = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/db", () => ({
  prisma: { $transaction: (...a: unknown[]) => mockTransaction(...a) },
}));
vi.mock("@/lib/agent/enrichment/conceptsIndex", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/agent/enrichment/conceptsIndex")
  >("@/lib/agent/enrichment/conceptsIndex");
  return {
    ...actual,
    gatherConceptPages: (...a: unknown[]) => mockGather(...a),
  };
});
vi.mock("@/lib/livingDocs/versioning", () => ({
  pruneOldVersions: vi.fn().mockResolvedValue(undefined),
}));

const { applyPlanWithCitationsTx, applyPlanWithCitations } = await import(
  "@/lib/agent/enrichment/applyPlanWithCitations"
);

const CHUNK =
  "The Suzuki coupling reaction forms a carbon-carbon bond between an aryl halide and a boronic acid. " +
  "It is catalysed by a palladium(0) complex and requires a base such as potassium carbonate to proceed.";

const CTX = { tenantId: "t1", userId: "u1", apiKeyId: "k1", scopes: ["read", "write"] } as never;

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    sourceChunk: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: "chunk-uuid-0", chunkIndex: 0, text: CHUNK }]),
    },
    page: {
      findFirst: vi.fn().mockResolvedValue(null),
      aggregate: vi.fn().mockResolvedValue({ _max: { position: 0 } }),
      create: vi.fn().mockResolvedValue({ id: "page-1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    block: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $executeRaw: vi.fn().mockResolvedValue(1),
    documentVersion: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "ver-1" }),
    },
    claim: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "claim-1" }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    claimEvidence: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ingestLedgerEntry: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  };
}

const OPTIONS = {
  conceptsCategoryId: "concepts-1",
  allowedParentIds: new Set(["concepts-1"]),
  sourceId: "src-1",
  contentHash: "hash-1",
  sourceName: "notes.txt",
};

function createAction(claims: unknown[]) {
  return {
    action: "create" as const,
    slug: "suzuki-coupling",
    type: "concept",
    title: "Suzuki Coupling",
    description: "A Pd-catalysed C–C bond formation.",
    tags: [],
    body_markdown: "## Body",
    related_slugs: [],
    aliases: [],
    change_note: "",
    claims,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("applyPlanWithCitationsTx — EXACT evidence, SUPPORTS to new claim", () => {
  test("writes a Claim + EXACT ClaimEvidence attached to the new claim", async () => {
    const tx = makeTx();
    const action = createAction([
      {
        text: "The Suzuki coupling forms a carbon-carbon bond.",
        evidence: [{ chunkIndex: 0, quotedText: "forms a carbon-carbon bond", relation: "SUPPORTS", confidence: 0.9 }],
      },
    ]);
    const res = await applyPlanWithCitationsTx(tx as never, CTX, [action] as never, OPTIONS as never, []);

    expect(res.applied).toHaveLength(1);
    expect(tx.claim.create).toHaveBeenCalledTimes(1);
    const evArg = tx.claimEvidence.create.mock.calls[0][0].data;
    expect(evArg.validationState).toBe("EXACT");
    expect(evArg.relation).toBe("SUPPORTS");
    expect(evArg.claimId).toBe("claim-1");
    expect(evArg.chunkId).toBe("chunk-uuid-0");
    expect(evArg.matchedText).toBe("forms a carbon-carbon bond");
    expect(evArg.quoteSha256).toBe(sha256(normalizeText("forms a carbon-carbon bond")));
    // Ledger + audit are part of the same tx.
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.ingestLedgerEntry.create).toHaveBeenCalledTimes(1);
    expect(res.claimSummaries[0].evidence.exact).toBe(1);
  });
});

describe("applyPlanWithCitationsTx — hallucinated quote rejection", () => {
  test("an unlocatable quote is stored UNVERIFIED with the sentinel hash, no matchedText", async () => {
    const tx = makeTx();
    const action = createAction([
      {
        text: "The reaction runs under high pressure in liquid ammonia.",
        evidence: [{ chunkIndex: 0, quotedText: "performed under high pressure in liquid ammonia" }],
      },
    ]);
    await applyPlanWithCitationsTx(tx as never, CTX, [action] as never, OPTIONS as never, []);

    const evArg = tx.claimEvidence.create.mock.calls[0][0].data;
    expect(evArg.validationState).toBe("UNVERIFIED");
    expect(evArg.matchedText).toBeNull();
    expect(evArg.chunkCharStart).toBeNull();
    expect(evArg.quoteSha256).toBe(unverifiedSentinel("claim-1", "chunk-uuid-0"));
    // The sentinel is NOT a hash of the fabricated quote.
    expect(evArg.quoteSha256).not.toBe(
      sha256(normalizeText("performed under high pressure in liquid ammonia"))
    );
  });
});

describe("applyPlanWithCitationsTx — claimKey idempotency (retry collapse)", () => {
  test("an existing claim is reused (no duplicate create) and evidence attaches to it", async () => {
    const tx = makeTx({
      claim: {
        findUnique: vi.fn().mockResolvedValue({ id: "existing-claim" }),
        create: vi.fn(),
        findFirst: vi.fn(),
      },
    });
    const action = createAction([
      {
        text: "The Suzuki coupling forms a carbon-carbon bond.",
        evidence: [{ chunkIndex: 0, quotedText: "forms a carbon-carbon bond" }],
      },
    ]);
    await applyPlanWithCitationsTx(tx as never, CTX, [action] as never, OPTIONS as never, []);

    expect(tx.claim.create).not.toHaveBeenCalled();
    expect(tx.claimEvidence.create.mock.calls[0][0].data.claimId).toBe("existing-claim");
  });
});

describe("applyPlanWithCitationsTx — CONTRADICTS attaches to the EXISTING claim", () => {
  test("a contradicts item names an existing claim; evidence targets that claim, not the new one", async () => {
    const tx = makeTx({
      claim: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "new-claim" }),
        // the contradiction target lookup resolves the existing claim
        findFirst: vi.fn().mockResolvedValue({ id: "old-claim" }),
      },
    });
    const action = createAction([
      {
        text: "Pd(0), not Pd(II), catalyses the reaction.",
        evidence: [
          {
            chunkIndex: 0,
            quotedText: "catalysed by a palladium(0) complex",
            relation: "CONTRADICTS",
            claimId: "22222222-2222-4222-8222-222222222222",
          },
        ],
      },
    ]);
    const res = await applyPlanWithCitationsTx(tx as never, CTX, [action] as never, OPTIONS as never, []);

    const evArg = tx.claimEvidence.create.mock.calls[0][0].data;
    expect(evArg.relation).toBe("CONTRADICTS");
    // Attaches to the EXISTING (old) claim, never the new body claim.
    expect(evArg.claimId).toBe("old-claim");
    expect(evArg.claimId).not.toBe("new-claim");
    expect(res.claimSummaries[0].evidence.contradicts).toBe(1);
    // Tenant-consistency lookup was scoped to the tenant.
    expect(tx.claim.findFirst.mock.calls[0][0].where.tenantId).toBe("t1");
  });

  test("a contradicts item whose target is foreign/missing is skipped with a warning", async () => {
    const tx = makeTx({
      claim: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "new-claim" }),
        findFirst: vi.fn().mockResolvedValue(null), // target not in tenant
      },
    });
    const action = createAction([
      {
        text: "x",
        evidence: [
          {
            chunkIndex: 0,
            quotedText: "catalysed by a palladium(0) complex",
            relation: "CONTRADICTS",
            claimId: "22222222-2222-4222-8222-222222222222",
          },
        ],
      },
    ]);
    const res = await applyPlanWithCitationsTx(tx as never, CTX, [action] as never, OPTIONS as never, []);
    expect(tx.claimEvidence.create).not.toHaveBeenCalled();
    expect(res.warnings.join(" ")).toMatch(/not found in tenant/);
  });
});

describe("applyPlanWithCitationsTx — citationsRequired gate", () => {
  test("a concept with no claims is skipped (no live uncited page) when citationsRequired", async () => {
    const tx = makeTx();
    const action = createAction([]);
    const res = await applyPlanWithCitationsTx(
      tx as never,
      CTX,
      [action] as never,
      { ...OPTIONS, citationsRequired: true } as never,
      []
    );
    expect(res.applied).toHaveLength(0);
    expect(tx.page.create).not.toHaveBeenCalled();
    expect(res.warnings.join(" ")).toMatch(/citations required/);
  });
});

describe("applyPlanWithCitationsTx — rollback on evidence failure", () => {
  test("a non-P2002 evidence insert error propagates so the whole tx rolls back", async () => {
    const tx = makeTx({
      claimEvidence: { create: vi.fn().mockRejectedValue(new Error("db exploded")) },
    });
    const action = createAction([
      { text: "c", evidence: [{ chunkIndex: 0, quotedText: "forms a carbon-carbon bond" }] },
    ]);
    await expect(
      applyPlanWithCitationsTx(tx as never, CTX, [action] as never, OPTIONS as never, [])
    ).rejects.toThrow(/db exploded/);
  });
});

describe("applyPlanWithCitations — wrapper rollback", () => {
  test("a failing transaction rejects and never returns a partial result", async () => {
    mockGather.mockResolvedValue([]);
    mockTransaction.mockRejectedValue(new Error("tx aborted"));
    await expect(
      applyPlanWithCitations(CTX, [] as never, OPTIONS as never)
    ).rejects.toThrow(/tx aborted/);
  });

  test("a P2002 version collision retries the whole tx once", async () => {
    mockGather.mockResolvedValue([]);
    mockTransaction
      .mockRejectedValueOnce({ code: "P2002" })
      .mockResolvedValueOnce({ applied: [], warnings: [], affectedPageIds: [], claimSummaries: [] });
    const res = await applyPlanWithCitations(CTX, [] as never, OPTIONS as never);
    expect(res.applied).toEqual([]);
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
});
