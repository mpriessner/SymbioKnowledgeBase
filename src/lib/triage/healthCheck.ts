/**
 * W81-C1 §6 — weekly KB-health digest. A scheduled rollup of OPEN findings per
 * tenant (stale / duplicates / contradiction candidates / untagged) surfaced as a
 * notification so the owner sees KB health without opening the queue.
 *
 * DURABLE + IDEMPOTENT (Codex R1 nice-to-have, folded): the period key
 * (`YYYY-Www` ISO week) is persisted in `TriageDigest` with a unique
 * `(tenantId, periodKey)`, so a re-run in the same period is a no-op and never
 * double-notifies. `Notification` requires a `userId`, so recipients are
 * identified explicitly (tenant admins, else any tenant user).
 */

import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

/** ISO-8601 week key, e.g. `2026-W28`. */
export function isoWeekKey(d: Date = new Date()): string {
  // Copy so we don't mutate the caller's date.
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Mon=1..Sun=7
  date.setUTCDate(date.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export interface DigestResult {
  tenantId: string;
  periodKey: string;
  created: boolean; // false = already sent this period (idempotent no-op)
  counts: Record<string, number>;
  notified: number;
}

interface KindCount {
  kind: string;
  count: bigint;
}

/**
 * Compute + (idempotently) emit the digest for a tenant + period. Returns
 * `created:false` when a digest already exists for the period.
 */
export async function runWeeklyDigest(
  tenantId: string,
  now: Date = new Date()
): Promise<DigestResult> {
  const periodKey = isoWeekKey(now);

  const kindRows = await prisma.$queryRawUnsafe<KindCount[]>(
    `SELECT "kind"::text AS "kind", COUNT(*)::bigint AS "count"
     FROM "triage_findings"
     WHERE "tenant_id" = $1 AND "status" IN ('OPEN','ESCALATED')
     GROUP BY "kind"`,
    tenantId
  );
  const counts: Record<string, number> = {};
  for (const r of kindRows) counts[r.kind] = Number(r.count);

  // Durable idempotency: insert the digest row first; if it already exists for
  // this period, this is a no-op and we do NOT notify again.
  const inserted = await prisma.$executeRawUnsafe(
    `INSERT INTO "triage_digests" ("id","tenant_id","period_key","stats","notified_at")
     VALUES ($1,$2,$3,$4::jsonb,CURRENT_TIMESTAMP)
     ON CONFLICT ("tenant_id","period_key") DO NOTHING`,
    randomUUID(),
    tenantId,
    periodKey,
    JSON.stringify(counts)
  );
  if (inserted === 0) {
    return { tenantId, periodKey, created: false, counts, notified: 0 };
  }

  // Recipients: tenant admins, else any tenant user (Notification needs a userId).
  const admins = await prisma.user.findMany({
    where: { tenantId, role: "ADMIN", deactivatedAt: null },
    select: { id: true },
  });
  let recipients = admins.map((u) => u.id);
  if (recipients.length === 0) {
    const anyUser = await prisma.user.findFirst({
      where: { tenantId, deactivatedAt: null },
      select: { id: true },
    });
    if (anyUser) recipients = [anyUser.id];
  }

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const bodyLines = Object.entries(counts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");
  const body =
    total === 0
      ? "No open KB-health findings this week."
      : `${total} open findings — ${bodyLines}`;

  let notified = 0;
  for (const userId of recipients) {
    await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: "SYSTEM",
        title: `KB health digest ${periodKey}`,
        body,
      },
    });
    notified++;
  }

  return { tenantId, periodKey, created: true, counts, notified };
}
