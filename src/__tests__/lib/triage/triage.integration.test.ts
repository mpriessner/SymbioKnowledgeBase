/**
 * DB-guarded integration tests for W81-C1's DB-enforced mechanics. Self-skips when
 * DATABASE_URL is unset (CI provides a Postgres with the migration applied).
 * Proves what a mocked client cannot:
 *  - the PARTIAL unique index (a live fingerprint dedupes, but a recurrence after
 *    DISMISS can be re-flagged),
 *  - SourceRelevance upsert idempotency on (tenant, source, page),
 *  - the single-owner jsonb_set `contested` write (sets knowledgeStatus, drops
 *    pendingContested, and does NOT bump updated_at).
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";

const HAS_DB = !!process.env.DATABASE_URL;

const { prisma } = HAS_DB
  ? await import("@/lib/db")
  : ({ prisma: null } as unknown as {
      prisma: import("@/generated/prisma/client").PrismaClient;
    });
const { writeFindingBatch } = await import("@/lib/triage/findingWriter");
const { triageConfigFromEnv } = await import("@/lib/triage/config");

const config = triageConfigFromEnv({} as never);

describe.skipIf(!HAS_DB)("W81-C1 — DB integration", () => {
  const tenantId = randomUUID();

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantId, name: "C1-IT" } });
  });

  afterAll(async () => {
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  test("partial-unique fingerprint: dedupes live, re-flags after DISMISS", async () => {
    const fp = `fp-${randomUUID()}`;
    const insert = async () =>
      prisma.$executeRawUnsafe(
        `INSERT INTO "triage_findings"
           ("id","tenant_id","kind","status","severity","confidence","fingerprint",
            "evidence","attempts","created_at","updated_at")
         VALUES ($1,$2,'STALE','OPEN',0.5,0.9,$3,'{}'::jsonb,0,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
         ON CONFLICT ("fingerprint") WHERE "status" IN ('OPEN','ESCALATED','DEFERRED')
         DO NOTHING`,
        randomUUID(),
        tenantId,
        fp
      );

    expect(await insert()).toBe(1); // first insert
    expect(await insert()).toBe(0); // deduped while OPEN

    // Dismiss the live one → the partial index no longer covers it.
    await prisma.$executeRawUnsafe(
      `UPDATE "triage_findings" SET "status" = 'DISMISSED', "updated_at" = CURRENT_TIMESTAMP
       WHERE "tenant_id" = $1 AND "fingerprint" = $2 AND "status" = 'OPEN'`,
      tenantId,
      fp
    );

    expect(await insert()).toBe(1); // recurrence can be re-flagged

    const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*)::bigint AS count FROM "triage_findings"
       WHERE "tenant_id" = $1 AND "fingerprint" = $2`,
      tenantId,
      fp
    );
    expect(Number(rows[0].count)).toBe(2); // one DISMISSED + one OPEN
  });

  test("SourceRelevance upsert is idempotent on (tenant, source, page)", async () => {
    const page = await prisma.page.create({
      data: { tenantId, title: "Concept" },
    });
    const source = await prisma.source.create({
      data: {
        tenantId,
        kind: "DOCUMENT",
        title: "Src",
        contentSha256: randomUUID(),
        chunkerVersion: "v1",
        rawText: "hello",
      },
    });

    const rel = [
      { sourceId: source.id, pageId: page.id, score: 0.6, modelDigest: "sha256:a" },
    ];
    await writeFindingBatch({
      tenantId,
      pass: "TAGGING",
      candidates: [],
      relevance: rel,
      nextCursor: null,
      config,
    });
    // Re-run with a new score → updates in place, never a duplicate row.
    await writeFindingBatch({
      tenantId,
      pass: "TAGGING",
      candidates: [],
      relevance: [{ ...rel[0], score: 0.9, modelDigest: "sha256:b" }],
      nextCursor: null,
      config,
    });

    const rows = await prisma.sourceRelevance.findMany({
      where: { tenantId, sourceId: source.id, pageId: page.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].score).toBeCloseTo(0.9);
    expect(rows[0].modelDigest).toBe("sha256:b");
  });

  test("contested jsonb_set sets knowledgeStatus, drops pendingContested, no updated_at bump", async () => {
    const page = await prisma.page.create({
      data: {
        tenantId,
        title: "Stale page",
        properties: { pendingContested: { at: "x" }, other: 1 },
      },
    });
    const before = await prisma.page.findUniqueOrThrow({ where: { id: page.id } });

    // Exercise the exact writer statement via a STALE candidate (precondition none).
    await writeFindingBatch({
      tenantId,
      pass: "STALENESS",
      candidates: [
        {
          kind: "STALE",
          severity: 0.6,
          confidence: 0.9,
          pageId: page.id,
          fingerprint: `fp-${randomUUID()}`,
          evidence: {},
          precondition: { type: "none" },
        },
      ],
      relevance: [],
      nextCursor: null,
      config,
    });

    const after = await prisma.page.findUniqueOrThrow({ where: { id: page.id } });
    const props = after.properties as Record<string, unknown>;
    expect(props.knowledgeStatus).toBe("contested");
    expect(props.pendingContested).toBeUndefined();
    expect(props.other).toBe(1); // sibling subkey preserved
    // updated_at must be unchanged (raw jsonb_set does not touch Prisma @updatedAt).
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
  });
});
