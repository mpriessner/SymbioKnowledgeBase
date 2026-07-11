#!/usr/bin/env npx tsx
/**
 * W81-C1 — CLI entry for a single bounded triage sweep (the cheap "sleeping
 * updater" tier). Mirrors `scripts/agent-sweep.ts`: stateless per run, invoked by
 * any external scheduler (cron / pg_cron / systemd timer) on a cadence. NOT a
 * long-running daemon — each invocation is time/row-budgeted and exits.
 *
 * Usage:
 *   npx tsx scripts/triage-sweep.ts --tenant <tenantId> [--budget 500]
 *   OLLAMA_BASE_URL=http://ollama:11434 OLLAMA_MODEL=llama3.1:8b \
 *     npx tsx scripts/triage-sweep.ts --tenant <tenantId>
 *
 * The per-tenant advisory lock (dedicated pg connection) prevents two concurrent
 * runs for the same tenant; a declined lock exits 0 (another run owns it).
 * Cooperative shutdown: finish + commit the current batch, release the lock,
 * $disconnect, THEN exit — never a hard mid-batch kill.
 */

import { prisma } from "@/lib/db";
import { runTriageSweep } from "@/lib/triage/worker";
import { withTenantLock } from "@/lib/triage/advisoryLock";
import { triageConfigFromEnv } from "@/lib/triage/config";

function parseArgs(): { tenant: string; budget: number } {
  const args = process.argv.slice(2);
  let tenant = "";
  let budget = triageConfigFromEnv().maxFindings;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--tenant":
        tenant = args[++i];
        break;
      case "--budget":
        budget = parseInt(args[++i], 10);
        break;
      case "--help":
        console.log(
          "Usage: triage-sweep.ts --tenant <id> [--budget <n>]\n" +
            "Env: OLLAMA_BASE_URL, OLLAMA_MODEL, TRIAGE_* (see src/lib/triage/config.ts)"
        );
        process.exit(0);
    }
  }
  if (!tenant) {
    console.error("Error: --tenant <tenantId> is required");
    process.exit(1);
  }
  return { tenant, budget };
}

async function main() {
  const { tenant, budget } = parseArgs();
  console.log(`[triage] tenant=${tenant} budget=${budget}`);

  const outcome = await withTenantLock(tenant, () =>
    runTriageSweep(tenant, budget)
  );

  if (!outcome.acquired) {
    console.log(`[triage] tenant=${tenant} lock held by another run — skipping`);
    return;
  }
  const report = outcome.result!;
  console.log(
    `[triage] tenant=${tenant} run=${report.runId} status=${report.status} ` +
      `modelReady=${report.modelReady} digest=${report.modelDigest ?? "-"}`
  );
  console.log(`[triage] stats=${JSON.stringify(report.stats)}`);
}

main()
  .then(async () => {
    // Cooperative shutdown: lock already released by withTenantLock's finally.
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[triage] sweep failed:", err);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
