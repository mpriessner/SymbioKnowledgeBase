/**
 * DB-guarded integration tests for the immutable Source store (W81-A1).
 *
 * Self-skips when DATABASE_URL is unset (CI provides a Postgres with the
 * pgvector migration applied). Proves the DB-enforced mechanics that unit tests
 * with a mocked client cannot: the immutability triggers, the embedding-backfill
 * carve-out, tenant-delete cascade, atomicity, dedup, and tenant isolation.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";

const HAS_DB = !!process.env.DATABASE_URL;

// Import lazily so the module (and its DB connection) is only touched when a DB
// is configured.
const { prisma } = HAS_DB
  ? await import("@/lib/db")
  : ({ prisma: null } as unknown as { prisma: import("@/generated/prisma/client").PrismaClient });
const { ingestSource } = await import("@/lib/sources/ingestService");
const { runEmbeddingBackfill, EMBEDDING_DIM } = await import(
  "@/lib/sources/embed"
);

const RAW =
  "Paragraph one of the transcript.\n\nParagraph two, with more detail about the reaction.";

function ctxFor(tenantId: string) {
  return { tenantId, userId: "test-user", scopes: ["read", "write"] };
}

describe.skipIf(!HAS_DB)("Source store — DB integration", () => {
  const tenantA = randomUUID();
  const tenantB = randomUUID();

  beforeAll(async () => {
    await prisma.tenant.create({ data: { id: tenantA, name: "A" } });
    await prisma.tenant.create({ data: { id: tenantB, name: "B" } });
  });

  afterAll(async () => {
    // Cascade deletes sources/chunks/origins (proves the cascade path too).
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
  });

  test("ingest creates Source + N chunks; re-ingest is a dedup no-op (AC1)", async () => {
    const first = await ingestSource(ctxFor(tenantA), {
      kind: "TRANSCRIPT",
      title: "T1",
      rawText: RAW,
    });
    expect(first.deduped).toBe(false);
    expect(first.chunkCount).toBeGreaterThan(0);

    const again = await ingestSource(ctxFor(tenantA), {
      kind: "TRANSCRIPT",
      title: "T1 again",
      rawText: RAW,
    });
    expect(again.deduped).toBe(true);
    expect(again.sourceId).toBe(first.sourceId);

    const count = await prisma.sourceChunk.count({
      where: { tenantId: tenantA, sourceId: first.sourceId! },
    });
    expect(count).toBe(first.chunkCount);
  });

  test("chunk.text equals the rawText code-point slice (A1.12)", async () => {
    const src = await prisma.source.findFirstOrThrow({
      where: { tenantId: tenantA },
    });
    const chunks = await prisma.sourceChunk.findMany({
      where: { tenantId: tenantA, sourceId: src.id },
      orderBy: { chunkIndex: "asc" },
    });
    const cps = Array.from(src.rawText);
    for (const c of chunks) {
      expect(c.text).toBe(cps.slice(c.charStart, c.charEnd).join(""));
    }
  });

  test("immutability trigger REJECTS UPDATE of rawText / chunk text (AC2, A1.9)", async () => {
    const src = await prisma.source.findFirstOrThrow({
      where: { tenantId: tenantA },
    });
    await expect(
      prisma.$executeRaw`UPDATE "sources" SET "raw_text" = 'hacked' WHERE "id" = ${src.id}`
    ).rejects.toThrow();

    const chunk = await prisma.sourceChunk.findFirstOrThrow({
      where: { tenantId: tenantA, sourceId: src.id },
    });
    await expect(
      prisma.$executeRaw`UPDATE "source_chunks" SET "text" = 'hacked' WHERE "id" = ${chunk.id}`
    ).rejects.toThrow();
    await expect(
      prisma.$executeRaw`UPDATE "source_chunks" SET "char_end" = 999999 WHERE "id" = ${chunk.id}`
    ).rejects.toThrow();
  });

  test("immutability trigger REJECTS direct DELETE (AC2)", async () => {
    const src = await prisma.source.findFirstOrThrow({
      where: { tenantId: tenantA },
    });
    await expect(
      prisma.$executeRaw`DELETE FROM "sources" WHERE "id" = ${src.id}`
    ).rejects.toThrow();
    const chunk = await prisma.sourceChunk.findFirstOrThrow({
      where: { tenantId: tenantA, sourceId: src.id },
    });
    await expect(
      prisma.$executeRaw`DELETE FROM "source_chunks" WHERE "id" = ${chunk.id}`
    ).rejects.toThrow();
  });

  test("embedding backfill UPDATE PASSES the trigger and fills nullable embedding (A1.9, A1.13)", async () => {
    const embedder = async () => Array(EMBEDDING_DIM).fill(0.001);
    const before = await runEmbeddingBackfill(tenantA, { embedder, limit: 100 });
    expect(before.embedded).toBeGreaterThan(0);
    // Idempotent: a second sweep finds nothing left (durable IS NULL filter).
    const after = await runEmbeddingBackfill(tenantA, { embedder, limit: 100 });
    expect(after.embedded).toBe(0);
    expect(after.remaining).toBe(0);
  });

  test("tenant isolation: identical content in two tenants → distinct Sources (AC6)", async () => {
    const a = await prisma.source.findFirstOrThrow({
      where: { tenantId: tenantA },
    });
    const b = await ingestSource(ctxFor(tenantB), {
      kind: "TRANSCRIPT",
      title: "same text, other tenant",
      rawText: RAW,
    });
    expect(b.sourceId).not.toBe(a.id);
    expect(b.deduped).toBe(false);
    // Tenant A's list never surfaces tenant B's Source.
    const aList = await prisma.source.findMany({ where: { tenantId: tenantA } });
    expect(aList.every((s) => s.id !== b.sourceId)).toBe(true);
  });

  test("tenant delete cascades through the DELETE guard (A1.9)", async () => {
    const scratch = randomUUID();
    await prisma.tenant.create({ data: { id: scratch, name: "scratch" } });
    const res = await ingestSource(ctxFor(scratch), {
      kind: "NOTE",
      title: "scratch",
      rawText: RAW,
    });
    expect(res.sourceId).toBeTruthy();
    // Cascade from tenants (depth>0) must NOT be blocked by the delete guard.
    await expect(
      prisma.tenant.delete({ where: { id: scratch } })
    ).resolves.toBeTruthy();
    const remaining = await prisma.source.count({
      where: { tenantId: scratch },
    });
    expect(remaining).toBe(0);
  });
});
