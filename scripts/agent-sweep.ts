#!/usr/bin/env npx tsx
/**
 * CLI command for running agent sweep mode.
 *
 * Usage:
 *   npx tsx scripts/agent-sweep.ts --budget 50 --tenant <tenantId>
 *   npx tsx scripts/agent-sweep.ts --budget 50 --tenant <tenantId> --dry-run
 *   npx tsx scripts/agent-sweep.ts --budget 50 --tenant <tenantId> --auto-link
 *
 * Future daemon/sleep mode: This script is designed to be called by any
 * scheduler (cron, daemon, etc.) The sweep service is stateless per run.
 */

import { SweepService } from "@/lib/sweep/SweepService";
import { summaryProcessor } from "@/lib/sweep/summaryProcessor";
import { linkDiscoveryProcessor } from "@/lib/sweep/linkDiscovery";
import { MAX_SWEEP_BUDGET } from "@/lib/sweep/config";
import type { SweepReport } from "@/lib/sweep/types";

function parseArgs(): {
  budget: number;
  tenant: string;
  dryRun: boolean;
  autoLink: boolean;
} {
  const args = process.argv.slice(2);
  let budget = 50;
  let tenant = "";
  let dryRun = false;
  let autoLink = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--budget":
        budget = parseInt(args[++i], 10);
        break;
      case "--tenant":
        tenant = args[++i];
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--auto-link":
        autoLink = true;
        break;
      case "--help":
        printUsage();
        process.exit(0);
    }
  }

  if (!tenant) {
    console.error("Error: --tenant <tenantId> is required");
    printUsage();
    process.exit(1);
  }

  if (budget <= 0 || budget > MAX_SWEEP_BUDGET) {
    console.error(`Error: budget must be between 1 and ${MAX_SWEEP_BUDGET}`);
    process.exit(1);
  }

  return { budget, tenant, dryRun, autoLink };
}

function printUsage() {
  console.log(`
Agent Sweep Mode — Knowledge Base Housekeeping

Usage:
  npx tsx scripts/agent-sweep.ts [options]

Options:
  --budget <n>     Number of pages to process (default: 50, max: ${MAX_SWEEP_BUDGET})
  --tenant <id>    Tenant ID to sweep (required)
  --dry-run        Preview what would be processed without making changes
  --auto-link      Auto-create high-confidence links (>0.8 confidence)
  --help           Show this help message
`);
}

function printReport(report: SweepReport) {
  const { session, pageLog } = report;
  const { results } = session;

  console.log("\n" + "=".repeat(60));
  console.log("SWEEP REPORT");
  console.log("=".repeat(60));
  console.log(`Session:      ${session.id}`);
  console.log(`Status:       ${session.status}`);
  console.log(`Budget:       ${session.budget}`);
  console.log(`Duration:     ${session.completedAt ? Math.round((session.completedAt.getTime() - session.startedAt.getTime()) / 1000) : "?"}s`);
  console.log("");
  console.log(`Pages processed:          ${results.pagesProcessed}`);
  console.log(`Summaries regenerated:    ${results.summariesRegenerated}`);
  console.log(`Summaries skipped:        ${results.summariesSkipped}`);
  console.log(`Link suggestions found:   ${results.linkSuggestionsFound}`);
  console.log(`Errors:                   ${results.errors}`);

  if (pageLog.length > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("PAGE LOG");
    console.log("-".repeat(60));

    for (const entry of pageLog) {
      const status = entry.action === "ERROR" ? "ERR" : entry.action === "SKIPPED" ? "SKIP" : "OK";
      console.log(
        `  [${status.padEnd(4)}] ${entry.title.slice(0, 40).padEnd(40)} ${entry.reason} (${entry.durationMs}ms)`
      );
      if (entry.suggestions && entry.suggestions.length > 0) {
        for (const suggestion of entry.suggestions) {
          console.log(`         → ${suggestion}`);
        }
      }
    }
  }

  if (report.linkSuggestions.length > 0) {
    console.log("\n" + "-".repeat(60));
    console.log("LINK SUGGESTIONS");
    console.log("-".repeat(60));
    for (const link of report.linkSuggestions) {
      console.log(`  "${link.targetTitle}" (confidence: ${link.confidence.toFixed(2)})`);
      if (link.context) {
        console.log(`    Context: ${link.context}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));
}

async function main() {
  const { budget, tenant, dryRun, autoLink } = parseArgs();

  console.log(`Agent Sweep Mode${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`Tenant: ${tenant}`);
  console.log(`Budget: ${budget} pages`);
  if (autoLink) console.log("Auto-link: enabled");
  console.log("");

  const sweepService = new SweepService();
  sweepService.addProcessor(summaryProcessor);
  sweepService.addProcessor(linkDiscoveryProcessor);

  const report = await sweepService.execute({
    budget,
    tenantId: tenant,
    dryRun,
    autoLink,
  });

  printReport(report);

  process.exit(report.session.status === "COMPLETED" ? 0 : 1);
}

main().catch((err) => {
  console.error("Sweep failed:", err);
  process.exit(1);
});
