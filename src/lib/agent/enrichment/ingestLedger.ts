/**
 * Idempotent ingest ledger — mirrors `llm-wiki-builder`'s `.ingested.json`
 * sha256 dedup, but server-side and per-tenant.
 *
 * A byte-identical re-submission of the same raw text (same sha256) for the same
 * tenant short-circuits BEFORE any LLM call. The unique key is composite
 * `(tenantId, contentHash)`, so the same hash may exist independently for
 * different tenants without colliding.
 */

import crypto from "crypto";
import { prisma } from "@/lib/db";

/** sha256 of the exact raw input bytes (utf-8). */
export function computeContentHash(rawText: string): string {
  return crypto.createHash("sha256").update(rawText, "utf8").digest("hex");
}

export interface LedgerEntry {
  id: string;
  tenantId: string;
  contentHash: string;
  sourceName: string;
  planSummary: string | null;
  actionCount: number;
  ingestedAt: Date;
}

/** Look up a prior ingestion of this exact text for this tenant. */
export async function findLedgerEntry(
  tenantId: string,
  contentHash: string
): Promise<LedgerEntry | null> {
  return prisma.ingestLedgerEntry.findUnique({
    where: { tenantId_contentHash: { tenantId, contentHash } },
  });
}

/**
 * Record a completed ingestion. Idempotent under concurrency: a P2002 (another
 * request wrote the same `(tenantId, contentHash)` first) is swallowed and the
 * existing row returned, so two identical concurrent submits don't error.
 */
export async function writeLedgerEntry(params: {
  tenantId: string;
  contentHash: string;
  sourceName: string;
  planSummary: string | null;
  actionCount: number;
}): Promise<LedgerEntry> {
  try {
    return await prisma.ingestLedgerEntry.create({
      data: {
        tenantId: params.tenantId,
        contentHash: params.contentHash,
        sourceName: params.sourceName,
        planSummary: params.planSummary,
        actionCount: params.actionCount,
      },
    });
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2002"
    ) {
      const existing = await findLedgerEntry(
        params.tenantId,
        params.contentHash
      );
      if (existing) return existing;
    }
    throw err;
  }
}
