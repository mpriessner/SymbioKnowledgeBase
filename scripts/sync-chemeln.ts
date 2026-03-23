#!/usr/bin/env tsx
/**
 * ChemELN -> SKB Sync CLI
 *
 * Usage:
 *   npx tsx scripts/sync-chemeln.ts [options]
 *
 * Options:
 *   --dry-run         Preview changes without writing (default: false)
 *   --full            Full sync all pages, ignore content hashes (default: false)
 *   --incremental     Incremental sync using change detection (default mode)
 *   --tenant <id>     Tenant ID (or TENANT_ID env var)
 *   --experiment <id> Sync single experiment by ID
 *   --force           Skip content hash comparison, update all pages
 *   --schedule <min>  Run on interval (e.g., --schedule 30 runs every 30 min)
 *   --once            Run once and exit (default without --schedule)
 *   --verbose         Show detailed logs + diffs
 */

import { parseArgs } from "node:util";
import { SyncStateManager } from "../src/lib/chemEln/sync/syncState";
import { EnhancedSyncStateManager } from "../src/lib/chemEln/sync/enhancedSyncState";
import {
  BatchOrchestrator,
  formatIngestionReport,
} from "../src/lib/chemEln/sync/orchestrator";
import {
  CrossReferenceResolver,
  type LookupData,
} from "../src/lib/chemEln/sync/resolver";
import { createWriter } from "../src/lib/chemEln/sync/writer";
import { ChemElnClient } from "../src/lib/chemEln/client";
import {
  fetchAndTransformExperiments,
  type ChemElnClient as FetcherClient,
} from "../src/lib/chemEln/experimentFetcher";
import {
  IncrementalSyncRunner,
  type IncrementalSyncResult,
} from "../src/lib/chemEln/sync/incrementalSync";
import { SyncScheduler } from "../src/lib/chemEln/sync/scheduler";
import { rebuildAllPageLinks } from "../src/lib/wikilinks/indexer";
import type {
  ExperimentData,
  ChemicalData,
  ReactionTypeAggregation,
  ResearcherProfileData,
  SubstrateClassAggregation,
} from "../src/lib/chemEln/types";

function printUsage(): void {
  console.log(`
Usage: npx tsx scripts/sync-chemeln.ts [options]

Options:
  --dry-run         Preview changes without writing (default: false)
  --full            Full sync all pages, ignore content hashes (default: false)
  --incremental     Incremental sync using change detection (default mode)
  --tenant <id>     Tenant ID (or TENANT_ID env var)
  --experiment <id> Sync single experiment by ID
  --force           Skip content hash comparison, update all pages
  --schedule <min>  Run on interval (e.g., --schedule 30 runs every 30 min)
  --once            Run once and exit (default without --schedule)
  --verbose         Show detailed logs + diffs
  --rebuild-links   Rebuild all PageLinks after sync
  --help            Show this help message
`);
}

function formatSyncSummary(result: IncrementalSyncResult): string {
  const lines: string[] = [
    "",
    "Chemistry KB Sync Summary",
    "\u2500".repeat(25),
    `New experiments:     ${result.changeSet.new}`,
    `Updated experiments: ${result.changeSet.updated}`,
    `Deleted experiments: ${result.changeSet.deleted}`,
    `Unchanged:           ${result.changeSet.unchanged}`,
  ];

  if (result.propagationResult) {
    lines.push(
      `Pages created:       ${result.propagationResult.experimentsCreated}`,
    );
    lines.push(
      `Pages updated:       ${result.propagationResult.experimentsUpdated}`,
    );
    lines.push(
      `Pages archived:      ${result.propagationResult.experimentsArchived}`,
    );
  }

  if (result.entityResult) {
    lines.push(
      `Entities created:    ${result.entityResult.created.length}`,
    );
    lines.push(
      `Entities updated:    ${result.entityResult.updated.length}`,
    );
  }

  lines.push(`Duration:            ${(result.duration / 1000).toFixed(1)}s`);

  if (result.status === "success") {
    lines.push("Status:              Success");
  } else if (result.status === "partial_failure") {
    lines.push("Status:              Partial failure");
    for (const err of result.errors) {
      lines.push(`  - ${err}`);
    }
  } else {
    lines.push("Status:              Failed");
    for (const err of result.errors) {
      lines.push(`  - ${err}`);
    }
  }

  lines.push(`Recommendation:      ${result.nextSyncRecommendation}`);

  return lines.join("\n");
}

async function runIncrementalMode(
  chemElnClient: ChemElnClient,
  tenantId: string,
  dryRun: boolean,
  fullSync: boolean,
  verbose: boolean,
  experimentId?: string,
  force?: boolean,
  scheduleMinutes?: number,
  rebuildLinks?: boolean,
): Promise<void> {
  const enhancedStateManager = new EnhancedSyncStateManager();
  const writer = createWriter();
  const resolver = new CrossReferenceResolver();

  const deps = {
    chemElnClient,
    writer,
    resolver,
    stateManager: enhancedStateManager,
  };

  const syncOptions = {
    tenantId,
    dryRun,
    full: fullSync,
    verbose,
    experimentId,
    force,
  };

  if (scheduleMinutes) {
    const intervalMs = scheduleMinutes * 60 * 1000;
    console.log(
      `\n  Starting scheduled sync every ${scheduleMinutes} minute(s)...`,
    );
    console.log("  Press Ctrl+C to stop.\n");

    const scheduler = new SyncScheduler(deps, syncOptions);
    scheduler.schedule(intervalMs);

    // Handle graceful shutdown
    const shutdown = () => {
      console.log("\n  Stopping scheduler...");
      scheduler.stop();
      const status = scheduler.getStatus();
      console.log(`  Total runs: ${status.runCount}`);
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Keep process alive
    await new Promise(() => {});
  } else {
    // Run once
    const runner = new IncrementalSyncRunner(deps);
    const result = await runner.runIncrementalSync(syncOptions);
    console.log(formatSyncSummary(result));

    if (rebuildLinks) {
      console.log("\n  Rebuilding all PageLinks...");
      const startTime = Date.now();
      await rebuildAllPageLinks(tenantId);
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  PageLinks rebuilt in ${duration}s`);
    }

    if (result.status === "failure") {
      process.exit(2);
    } else if (result.status === "partial_failure") {
      process.exit(1);
    } else {
      process.exit(0);
    }
  }
}

async function runFullBatchMode(
  chemElnClient: ChemElnClient,
  stateManager: SyncStateManager,
  tenantId: string,
  dryRun: boolean,
  fullSync: boolean,
  verbose: boolean,
  rebuildLinks?: boolean,
): Promise<void> {
  console.log("  Extracting data from ChemELN...");

  const dateRange =
    !fullSync && stateManager.getLastSyncTimestamp()
      ? {
          start: stateManager.getLastSyncTimestamp()!,
          end: new Date().toISOString(),
        }
      : undefined;

  const fetchResult = await fetchAndTransformExperiments(
    chemElnClient as unknown as FetcherClient,
    { dateRange },
  );

  console.log(`  Found: ${fetchResult.experiments.length} experiments`);
  console.log(
    `  Transform stats: ${fetchResult.stats.transformed} transformed, ${fetchResult.stats.skipped} skipped, ${fetchResult.stats.errors} errors`,
  );

  const experiments: ExperimentData[] = fetchResult.experiments.map(
    (e) =>
      ({
        id: e.frontmatter.elnId,
        title: e.frontmatter.title,
        experimentType: e.frontmatter.reactionType ?? "unknown",
        status: e.frontmatter.status,
        createdBy: e.frontmatter.researcher,
        createdAt: e.frontmatter.date,
        reagents: [],
        products: [],
        actualProcedure: null,
        procedureMetadata: null,
      }) as ExperimentData,
  );

  const chemicals: ChemicalData[] = [];
  const reactionTypes: ReactionTypeAggregation[] = [];
  const researchers: ResearcherProfileData[] = [];
  const substrateClasses: SubstrateClassAggregation[] = [];

  const resolver = new CrossReferenceResolver();
  const lookupData: LookupData = {
    chemicals: chemicals.map((c) => ({
      id: c.id,
      name: c.name,
      casNumber: c.casNumber,
      molecularFormula: c.molecularFormula,
    })),
    reactionTypes: reactionTypes.map((rt) => ({
      name: rt.name,
      experimentCount: rt.experimentCount,
      avgYield: rt.avgYield,
      researcherCount: rt.researcherCount,
      experiments: rt.experiments,
      keyLearnings: rt.keyLearnings,
      commonPitfalls: rt.commonPitfalls,
      topResearchers: rt.topResearchers,
    })),
    researchers: researchers.map((r) => ({
      name: r.name,
      totalExperiments: r.totalExperiments,
      topReactionTypes: r.topReactionTypes,
      recentExperiments: r.recentExperiments,
      keyContributions: r.keyContributions,
    })),
    substrateClasses: substrateClasses.map((sc) => ({
      name: sc.name,
      experimentCount: sc.experimentCount ?? 0,
    })),
  };
  resolver.buildLookupMap(lookupData);

  console.log("");

  const writer = createWriter();
  const orchestrator = new BatchOrchestrator(writer, resolver, {
    dryRun,
    onProgress: (current, total, passName, pageName) => {
      if (verbose) {
        process.stdout.write(
          `\r  ${passName}: ${current}/${total} - ${pageName}    `,
        );
      }
    },
  });

  const report = await orchestrator.run({
    experiments,
    chemicals,
    reactionTypes,
    researchers,
    substrateClasses,
  });

  if (verbose) {
    process.stdout.write("\r" + " ".repeat(80) + "\r");
  }
  console.log("\n");
  console.log(formatIngestionReport(report));

  if (!dryRun) {
    stateManager.updateResults({
      created: report.totalCreated,
      updated: report.totalUpdated,
      skipped: report.totalSkipped,
      failed: report.totalFailed,
    });
    await stateManager.save();
    console.log("\n  Sync state saved to data/sync-state.json");
  } else {
    console.log(
      "\n  Dry run complete. No changes were written to SKB.",
    );
  }

  if (rebuildLinks) {
    console.log("\n  Rebuilding all PageLinks...");
    const startTime = Date.now();
    await rebuildAllPageLinks(tenantId);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`  PageLinks rebuilt in ${duration}s`);
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      full: { type: "boolean", default: false },
      incremental: { type: "boolean", default: false },
      tenant: { type: "string" },
      experiment: { type: "string" },
      force: { type: "boolean", default: false },
      schedule: { type: "string" },
      once: { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
      "rebuild-links": { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });

  if (values.help) {
    printUsage();
    process.exit(0);
  }

  const dryRun = values["dry-run"] ?? false;
  const fullSync = values.full ?? false;
  const incremental = values.incremental ?? false;
  const verbose = values.verbose ?? false;
  const force = values.force ?? false;
  const tenantId = values.tenant ?? process.env.TENANT_ID ?? "";
  const experimentId = values.experiment;
  const rebuildLinks = values["rebuild-links"] ?? false;
  const scheduleMinutes = values.schedule
    ? parseInt(values.schedule, 10)
    : undefined;

  if (!tenantId) {
    console.error("Error: tenant ID is required.");
    console.error(
      "Usage: npx tsx scripts/sync-chemeln.ts --tenant <id>",
    );
    console.error(
      "   or: TENANT_ID=<id> npx tsx scripts/sync-chemeln.ts",
    );
    process.exit(2);
  }

  if (scheduleMinutes !== undefined && (isNaN(scheduleMinutes) || scheduleMinutes <= 0)) {
    console.error("Error: --schedule must be a positive number of minutes.");
    process.exit(2);
  }

  const modeLabel = dryRun
    ? "(DRY RUN)"
    : incremental || experimentId || scheduleMinutes
      ? "(INCREMENTAL)"
      : fullSync
        ? "(FULL)"
        : "";

  console.log(
    `\nChemELN -> SKB Sync ${modeLabel}\n`,
  );
  console.log(`  Tenant: ${tenantId}`);

  // Validate env vars
  const chemElnUrl = process.env.CHEMELN_API_URL;
  const chemElnKey = process.env.CHEMELN_API_KEY;
  if (!chemElnUrl || !chemElnKey) {
    console.error(
      "Error: CHEMELN_API_URL and CHEMELN_API_KEY environment variables are required.",
    );
    process.exit(2);
  }

  const chemElnClient = new ChemElnClient({
    baseUrl: chemElnUrl,
    apiKey: chemElnKey,
    timeout: 30000,
    retries: 3,
  });

  // Use incremental mode if --incremental, --experiment, or --schedule is specified
  const useIncremental = incremental || !!experimentId || !!scheduleMinutes;

  if (useIncremental) {
    await runIncrementalMode(
      chemElnClient,
      tenantId,
      dryRun,
      fullSync,
      verbose,
      experimentId,
      force,
      scheduleMinutes,
      rebuildLinks,
    );
  } else {
    // Legacy full batch mode
    const stateManager = new SyncStateManager();
    await stateManager.load();

    if (!fullSync) {
      const lastSync = stateManager.getLastSyncTimestamp();
      if (lastSync) {
        console.log(`  Last sync: ${lastSync}`);
        console.log(
          "  Mode: Incremental (only changes since last sync)\n",
        );
      } else {
        console.log("  No previous sync found. Running full sync.\n");
      }
    } else {
      console.log("  Mode: Full sync (ignoring content hashes)\n");
    }

    await runFullBatchMode(
      chemElnClient,
      stateManager,
      tenantId,
      dryRun,
      fullSync,
      verbose,
      rebuildLinks,
    );
  }
}

main().catch((error) => {
  console.error("\n  Sync failed:", error.message);
  process.exit(2);
});
