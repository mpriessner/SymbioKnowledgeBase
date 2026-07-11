/**
 * SourceIngestService — the create+read entry point for the immutable Source
 * store (W81-A1). There is NO update/delete path (immutability is DB-enforced).
 *
 * Flow: hash rawText → chunk in memory → (dryRun stops here, ZERO writes) →
 * validate originRef ownership → dedup on (tenantId, contentSha256,
 * chunkerVersion) → on a miss, insert Source + ALL chunks (+ first SourceOrigin)
 * in ONE $transaction so a Source exists IFF its complete chunk set does (GLM
 * R2). On a hit, record only a new provenance occurrence (SourceOrigin), leaving
 * the immutable Source + chunks untouched.
 *
 * Integration contract with as-built a71-13 (Codex R1):
 *  - Source existence is NEVER an enrichment short-circuit — the ledger stays
 *    that (see enrich.ts). ingestSource is an idempotent PRE-STEP.
 *  - dryRun persists NOTHING (chunks in memory only).
 *  - Embeddings are filled by a DURABLE `embedding IS NULL` sweep (embed.ts), NOT
 *    scheduled in-process here — chunks are citeable before they are embedded.
 */

import { prisma } from "@/lib/db";
import type { AgentContext } from "@/lib/agent/auth";
import { computeContentHash } from "@/lib/agent/enrichment/ingestLedger";
import { chunkText, CHUNKER_VERSION, type Chunk } from "./chunker";
import type { SourceKind, DatePrecision } from "@/generated/prisma/client";

export class IngestError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "IngestError";
  }
}

export interface IngestSourceParams {
  kind: SourceKind;
  title: string;
  /** Stored VERBATIM — no normalization (Codex R1). */
  rawText: string;
  /** Polymorphic provenance ref (fileId / pageId / url). Ownership is validated. */
  originRef?: string | null;
  ingestedBy?: string | null;
  correlationId?: string | null;
  dryRun?: boolean;
  chunkerVersion?: string;
  /** W81-B1: the artifact's world event-date (parsed from metadata), seeds Claim.tValid. */
  eventDate?: Date | null;
  /** W81-B1: precision of eventDate; UNKNOWN (default) blocks auto-supersession. */
  datePrecision?: DatePrecision;
}

export interface IngestSourceResult {
  /** null on dryRun (nothing persisted). */
  sourceId: string | null;
  /** true when an existing Source was reused (dedup no-op). */
  deduped: boolean;
  chunkCount: number;
  /** In-memory chunk previews (deterministic; equals what is/was persisted). */
  chunks: Chunk[];
  dryRun: boolean;
}

function isP2002(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * Validate that a provenance ref actually belongs to this tenant before it is
 * recorded — a bare polymorphic string could otherwise pin another tenant's
 * file/page id (Codex R1). Only ownership-checkable kinds are enforced.
 */
async function validateOriginRef(
  tenantId: string,
  kind: SourceKind,
  originRef: string
): Promise<void> {
  if (kind === "EXPERIMENT_SYNC") {
    const page = await prisma.page.findFirst({
      where: { id: originRef, tenantId },
      select: { id: true },
    });
    if (!page) {
      throw new IngestError(
        "originRef does not resolve to a page in this tenant",
        403
      );
    }
    return;
  }
  if (kind === "DOCUMENT") {
    const file = await prisma.fileAttachment.findFirst({
      where: { id: originRef, tenantId },
      select: { id: true },
    });
    if (!file) {
      throw new IngestError(
        "originRef does not resolve to a file attachment in this tenant",
        403
      );
    }
    return;
  }
  // URL / TRANSCRIPT / NOTE: originRef is a free-form pointer with no owning row.
}

export async function ingestSource(
  ctx: AgentContext,
  params: IngestSourceParams
): Promise<IngestSourceResult> {
  const tenantId = ctx.tenantId;
  const {
    kind,
    title,
    rawText,
    originRef = null,
    ingestedBy = ctx.userId ?? null,
    correlationId = null,
    dryRun = false,
    chunkerVersion = CHUNKER_VERSION,
    eventDate = null,
    datePrecision = "UNKNOWN",
  } = params;

  if (!rawText || rawText.length === 0) {
    throw new IngestError("rawText is required", 400);
  }

  const contentSha256 = computeContentHash(rawText);
  // Chunk in memory ALWAYS — a dryRun returns these without touching the DB.
  const chunks = chunkText(rawText, chunkerVersion);

  if (dryRun) {
    return {
      sourceId: null,
      deduped: false,
      chunkCount: chunks.length,
      chunks,
      dryRun: true,
    };
  }

  if (originRef) {
    await validateOriginRef(tenantId, kind, originRef);
  }

  // Dedup: identical text under the same chunkerVersion is one immutable Source.
  const existing = await prisma.source.findUnique({
    where: {
      tenantId_contentSha256_chunkerVersion: {
        tenantId,
        contentSha256,
        chunkerVersion,
      },
    },
    select: { id: true },
  });

  if (existing) {
    // Dedup no-op for Source + chunks; record only the new provenance occurrence.
    // Same (tenant, source, originRef) collapses on the unique index (idempotent).
    try {
      await prisma.sourceOrigin.create({
        data: { tenantId, sourceId: existing.id, originRef, kind, title, ingestedBy },
      });
    } catch (err) {
      if (!isP2002(err)) throw err;
    }
    const chunkCount = await prisma.sourceChunk.count({
      where: { tenantId, sourceId: existing.id },
    });
    return {
      sourceId: existing.id,
      deduped: true,
      chunkCount,
      chunks,
      dryRun: false,
    };
  }

  // Fresh ingest: Source + ALL chunks + first origin commit atomically. A Source
  // must never exist with a partial chunk set (the dedup no-op would make missing
  // chunks permanent).
  let sourceId: string;
  try {
    sourceId = await prisma.$transaction(async (tx) => {
      const source = await tx.source.create({
        data: {
          tenantId,
          kind,
          title,
          contentSha256,
          chunkerVersion,
          rawText,
          ingestedBy,
          correlationId,
          eventDate,
          datePrecision,
        },
        select: { id: true },
      });
      if (chunks.length > 0) {
        await tx.sourceChunk.createMany({
          data: chunks.map((c) => ({
            tenantId,
            sourceId: source.id,
            chunkIndex: c.chunkIndex,
            charStart: c.charStart,
            charEnd: c.charEnd,
            text: c.text,
            textSha256: c.textSha256,
          })),
        });
      }
      await tx.sourceOrigin.create({
        data: { tenantId, sourceId: source.id, originRef, kind, title, ingestedBy },
      });
      return source.id;
    });
  } catch (err) {
    // A concurrent identical ingest won the dedup unique first — reuse its Source.
    if (isP2002(err)) {
      const winner = await prisma.source.findUnique({
        where: {
          tenantId_contentSha256_chunkerVersion: {
            tenantId,
            contentSha256,
            chunkerVersion,
          },
        },
        select: { id: true },
      });
      if (winner) {
        return {
          sourceId: winner.id,
          deduped: true,
          chunkCount: await prisma.sourceChunk.count({
            where: { tenantId, sourceId: winner.id },
          }),
          chunks,
          dryRun: false,
        };
      }
    }
    throw err;
  }

  return {
    sourceId,
    deduped: false,
    chunkCount: chunks.length,
    chunks,
    dryRun: false,
  };
}
