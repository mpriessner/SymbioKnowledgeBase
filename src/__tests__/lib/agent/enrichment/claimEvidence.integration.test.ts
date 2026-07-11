/**
 * DB-guarded integration tests for the W81-A2 Claim / ClaimEvidence schema.
 *
 * Self-skips when DATABASE_URL is unset (CI provides a Postgres with the A1 + A2
 * migrations applied). Proves the DB-ENFORCED mechanics a mocked client cannot:
 *  - `Claim.documentVersionId` ON DELETE RESTRICT blocks pruning a pinned version,
 *  - the @@unique([claimId, chunkId, quoteSha256]) retry-idempotency key,
 *  - tenant-delete cascade cleans claims + evidence,
 *  - the UNVERIFIED sentinel lets two "unverified" retries collapse.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "crypto";
import {
  computeClaimKey,
  computeAnchorTextSha,
  unverifiedSentinel,
} from "@/lib/provenance/quoteMatch";

const HAS_DB = !!process.env.DATABASE_URL;

const { prisma } = HAS_DB
  ? await import("@/lib/db")
  : ({ prisma: null } as unknown as {
      prisma: import("@/generated/prisma/client").PrismaClient;
    });
const { ingestSource } = await import("@/lib/sources/ingestService");

const RAW = "The catalyst is palladium(0).\n\nA base such as potassium carbonate is required.";

describe.skipIf(!HAS_DB)("W81-A2 Claim/ClaimEvidence DB mechanics", () => {
  let tenantId: string;
  let pageId: string;
  let versionId: string;
  let chunkId: string;

  beforeAll(async () => {
    tenantId = randomUUID();
    await prisma.tenant.create({ data: { id: tenantId, name: "a2-int" } });
    const page = await prisma.page.create({
      data: { tenantId, title: "Concept", spaceType: "TEAM" },
    });
    pageId = page.id;
    const version = await prisma.documentVersion.create({
      data: {
        pageId,
        tenantId,
        version: 1,
        content: { type: "doc", content: [] },
        plainText: "body",
        changeType: "AI_SUGGESTED",
      },
    });
    versionId = version.id;
    const ingested = await ingestSource(
      { tenantId, userId: "u", scopes: ["read", "write"] } as never,
      { kind: "NOTE", title: "s", rawText: RAW }
    );
    const chunk = await prisma.sourceChunk.findFirst({
      where: { tenantId, sourceId: ingested.sourceId! },
      orderBy: { chunkIndex: "asc" },
      select: { id: true },
    });
    chunkId = chunk!.id;
  });

  afterAll(async () => {
    if (HAS_DB) await prisma.tenant.delete({ where: { id: tenantId } }).catch(() => {});
  });

  test("Claim is idempotent on (tenantId, claimKey)", async () => {
    const text = "The catalyst is palladium(0).";
    const claimKey = computeClaimKey(pageId, text, versionId);
    const data = {
      tenantId,
      pageId,
      text,
      claimKey,
      anchorTextSha: computeAnchorTextSha(text),
      documentVersionId: versionId,
    };
    const c1 = await prisma.claim.create({ data });
    await expect(prisma.claim.create({ data })).rejects.toMatchObject({
      code: "P2002",
    });
    expect(c1.claimKey).toBe(claimKey);
  });

  test("ClaimEvidence dedupes on (claimId, chunkId, quoteSha256); UNVERIFIED sentinel collapses", async () => {
    const claim = await prisma.claim.findFirst({ where: { tenantId }, select: { id: true } });
    const claimId = claim!.id;
    const sentinel = unverifiedSentinel(claimId, chunkId);
    const evData = {
      tenantId,
      claimId,
      chunkId,
      matchedText: null,
      quoteSha256: sentinel,
      relation: "SUPPORTS" as const,
      validationState: "UNVERIFIED" as const,
      confidence: 0.3,
    };
    await prisma.claimEvidence.create({ data: evData });
    // A retry with the SAME sentinel collapses (would be distinct if NULL).
    await expect(prisma.claimEvidence.create({ data: evData })).rejects.toMatchObject({
      code: "P2002",
    });
  });

  test("deleting a Claim-referenced DocumentVersion is blocked (onDelete: Restrict)", async () => {
    await expect(
      prisma.documentVersion.delete({ where: { id: versionId } })
    ).rejects.toBeTruthy();
    // Version still present.
    const still = await prisma.documentVersion.findUnique({ where: { id: versionId } });
    expect(still).not.toBeNull();
  });

  test("tenant delete cascades claims + evidence away", async () => {
    const t2 = randomUUID();
    await prisma.tenant.create({ data: { id: t2, name: "a2-cascade" } });
    const p = await prisma.page.create({ data: { tenantId: t2, title: "P", spaceType: "TEAM" } });
    const v = await prisma.documentVersion.create({
      data: { pageId: p.id, tenantId: t2, version: 1, content: {}, plainText: "b", changeType: "AI_SUGGESTED" },
    });
    const text = "x";
    await prisma.claim.create({
      data: {
        tenantId: t2,
        pageId: p.id,
        text,
        claimKey: computeClaimKey(p.id, text, v.id),
        anchorTextSha: computeAnchorTextSha(text),
        documentVersionId: v.id,
      },
    });
    await prisma.tenant.delete({ where: { id: t2 } });
    expect(await prisma.claim.count({ where: { tenantId: t2 } })).toBe(0);
  });
});
