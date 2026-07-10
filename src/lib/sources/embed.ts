/**
 * Durable embedding backfill for SourceChunks (W81-A1).
 *
 * NOT an in-process promise/timer (which would lose work on restart and leave
 * embeddings permanently null — Codex R1). This is an idempotent sweep over
 * `embedding IS NULL`, invoked by a durable worker/cron (the same bounded-run
 * pattern as W81-C1). A chunk is queryable/citeable BEFORE it is embedded.
 *
 * Writes go through raw SQL because `embedding` is a Prisma `Unsupported`
 * (pgvector) column. The UPDATE sets ONLY `embedding`, which the column-scoped
 * `BEFORE UPDATE OF <text/boundary cols>` immutability trigger deliberately does
 * NOT guard — so the backfill is permitted while content stays immutable.
 */

import { prisma } from "@/lib/db";

export const EMBEDDING_DIM = 1536;

/** Pluggable embedder (test seam). Returns a length-EMBEDDING_DIM vector. */
export type Embedder = (text: string) => Promise<number[]>;

interface PendingChunk {
  id: string;
  text: string;
}

/**
 * Default embedder — reads provider config lazily. Left unconfigured in this
 * story (A1 lands the durable substrate; the concrete embeddings provider is
 * wired via the existing SUMMARY_LLM-style config). Throws so a misconfigured
 * sweep fails loudly rather than writing zero vectors.
 */
const defaultEmbedder: Embedder = async () => {
  throw new Error(
    "No embeddings provider configured — inject an Embedder into runEmbeddingBackfill"
  );
};

/** Format a JS number[] as a pgvector literal: `[0.1,0.2,...]`. */
function toVectorLiteral(vec: number[]): string {
  if (vec.length !== EMBEDDING_DIM) {
    throw new Error(
      `embedding must have ${EMBEDDING_DIM} dims, got ${vec.length}`
    );
  }
  return `[${vec.join(",")}]`;
}

export interface BackfillOptions {
  /** Max chunks to embed per invocation (bounded run). */
  limit?: number;
  /** Injected embedder (defaults to the config-driven provider). */
  embedder?: Embedder;
}

export interface BackfillResult {
  embedded: number;
  remaining: number;
}

/**
 * Embed up to `limit` not-yet-embedded chunks for a tenant. Idempotent and
 * restart-safe: re-running only ever picks up rows still `embedding IS NULL`, and
 * each UPDATE re-checks `embedding IS NULL` so two concurrent sweeps don't
 * double-write.
 */
export async function runEmbeddingBackfill(
  tenantId: string,
  options: BackfillOptions = {}
): Promise<BackfillResult> {
  const limit = options.limit ?? 100;
  const embedder = options.embedder ?? defaultEmbedder;

  const pending = await prisma.$queryRaw<PendingChunk[]>`
    SELECT "id", "text"
    FROM "source_chunks"
    WHERE "tenant_id" = ${tenantId} AND "embedding" IS NULL
    ORDER BY "created_at" ASC, "id" ASC
    LIMIT ${limit}
  `;

  let embedded = 0;
  for (const chunk of pending) {
    const vec = await embedder(chunk.text);
    const literal = toVectorLiteral(vec);
    // Column-scoped: sets only `embedding`, so the immutability trigger does not
    // fire. Re-checks IS NULL for concurrency safety.
    const updated = await prisma.$executeRaw`
      UPDATE "source_chunks"
      SET "embedding" = ${literal}::vector
      WHERE "id" = ${chunk.id}
        AND "tenant_id" = ${tenantId}
        AND "embedding" IS NULL
    `;
    if (updated > 0) embedded++;
  }

  const remainingRows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "source_chunks"
    WHERE "tenant_id" = ${tenantId} AND "embedding" IS NULL
  `;
  const remaining = Number(remainingRows[0]?.count ?? 0);

  return { embedded, remaining };
}
