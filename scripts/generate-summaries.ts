#!/usr/bin/env tsx
/**
 * Batch generate summaries for all pages without them.
 *
 * Usage:
 *   npx tsx scripts/generate-summaries.ts --tenant <id>
 *   npx tsx scripts/generate-summaries.ts --tenant <id> --overwrite
 *   npx tsx scripts/generate-summaries.ts --tenant <id> --dry-run
 *   npx tsx scripts/generate-summaries.ts --tenant <id> --limit 10
 */

import { getSummaryService } from "../src/lib/summary/SummaryService";
import { isSummaryGenerationEnabled } from "../src/lib/summary/config";

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let tenantId = "";
  let overwrite = false;
  let dryRun = false;
  let limit: number | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--tenant":
        tenantId = args[++i] || "";
        break;
      case "--overwrite":
        overwrite = true;
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--limit":
        limit = parseInt(args[++i] || "0", 10) || undefined;
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!tenantId) {
    console.error("Usage: npx tsx scripts/generate-summaries.ts --tenant <id>");
    process.exit(1);
  }

  if (!isSummaryGenerationEnabled()) {
    console.error(
      "Error: SUMMARY_LLM_API_KEY is not configured. Set it in your environment."
    );
    process.exit(1);
  }

  console.log(`Batch summary generation for tenant: ${tenantId}`);
  if (overwrite) console.log("  Mode: overwrite all existing summaries");
  if (dryRun) console.log("  Mode: dry run (no changes)");
  if (limit) console.log(`  Limit: ${limit} pages`);

  const service = getSummaryService();
  const result = await service.generateBatch(tenantId, {
    overwrite,
    dryRun,
    limit,
  });

  console.log("\nResults:");
  console.log(`  Total pages: ${result.total}`);
  console.log(`  Processed: ${result.processed}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Errors: ${result.errors}`);

  process.exit(result.errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
