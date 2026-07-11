/**
 * Durable async-job store for the enrichment+citation pipeline (W81-A2).
 *
 * SKB has NO restart-surviving in-process job infra (the only background
 * mechanism, aggregationRefresh's in-process Map+setTimeout, evaporates on
 * restart and is already flagged multi-worker-broken — GLM R2). So a real
 * enrich run is a row in `enrich_jobs`: POST inserts QUEUED and returns a jobId;
 * a worker/poller claims it (QUEUED→RUNNING) and writes DONE/FAILED + result;
 * GET reads the row so a completed job never polls as 404 after a cold start.
 *
 * Everything is tenant-scoped (no RLS) — a GET for another tenant's job returns
 * null, never the row.
 */

import { prisma } from "@/lib/db";
import type { Prisma, EnrichJob } from "@/generated/prisma/client";

export interface EnrichJobRequest {
  rawText: string;
  sourceName: string;
  targetCategoryId?: string;
}

function isP2025(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2025"
  );
}

/** Insert a QUEUED job and return its id + status (the async POST response). */
export async function createEnrichJob(
  tenantId: string,
  request: EnrichJobRequest
): Promise<{ id: string; status: EnrichJob["status"] }> {
  const job = await prisma.enrichJob.create({
    data: {
      tenantId,
      status: "QUEUED",
      request: request as unknown as Prisma.InputJsonValue,
    },
    select: { id: true, status: true },
  });
  return job;
}

/** Read a job row, tenant-scoped (returns null for a foreign or missing job). */
export async function getEnrichJob(
  tenantId: string,
  jobId: string
): Promise<EnrichJob | null> {
  return prisma.enrichJob.findFirst({ where: { id: jobId, tenantId } });
}

/**
 * Atomically claim the oldest QUEUED job → RUNNING (single-flight; a concurrent
 * poller that loses the race gets the next one). Returns null when the queue is
 * empty. The status-guarded update prevents two workers running the same job.
 */
export async function claimNextQueuedJob(): Promise<EnrichJob | null> {
  return prisma.$transaction(async (tx) => {
    const next = await tx.enrichJob.findFirst({
      where: { status: "QUEUED" },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!next) return null;
    const claimed = await tx.enrichJob.updateMany({
      where: { id: next.id, status: "QUEUED" },
      data: { status: "RUNNING" },
    });
    if (claimed.count === 0) return null; // lost the race
    return tx.enrichJob.findUnique({ where: { id: next.id } });
  });
}

/** Mark a job DONE with its result payload. */
export async function completeEnrichJob(
  jobId: string,
  result: unknown
): Promise<void> {
  try {
    await prisma.enrichJob.update({
      where: { id: jobId },
      data: { status: "DONE", result: result as Prisma.InputJsonValue, error: null },
    });
  } catch (err) {
    if (!isP2025(err)) throw err;
  }
}

/** Mark a job FAILED with an error message. */
export async function failEnrichJob(
  jobId: string,
  error: string
): Promise<void> {
  try {
    await prisma.enrichJob.update({
      where: { id: jobId },
      data: { status: "FAILED", error: error.slice(0, 2000) },
    });
  } catch (err) {
    if (!isP2025(err)) throw err;
  }
}
