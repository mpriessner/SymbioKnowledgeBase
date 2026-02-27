import { prisma } from "@/lib/db";
import { selectPagesForSweep, type SelectedPage } from "./pageSelection";
import { MAX_SWEEP_BUDGET } from "./config";
import type {
  SweepOptions,
  SweepSessionData,
  SweepResults,
  SweepPageLogEntry,
  SweepReport,
  SweepStatus,
} from "./types";

/**
 * Core sweep engine: selects pages by priority, processes each within
 * budget, tracks lastAgentVisitAt, and produces structured session logs.
 *
 * Processing hooks (summary regeneration, link discovery) are injected
 * via `addProcessor()` to keep the core engine independent.
 */
export type PageProcessor = (
  page: SelectedPage,
  tenantId: string,
  dryRun: boolean
) => Promise<SweepPageLogEntry>;

export class SweepService {
  private processors: PageProcessor[] = [];

  /** Register a processing step (summary regen, link discovery, etc.) */
  addProcessor(processor: PageProcessor): void {
    this.processors.push(processor);
  }

  /**
   * Execute a sweep with the given options.
   * Returns a full report including session data and per-page log.
   */
  async execute(options: SweepOptions): Promise<SweepReport> {
    const { tenantId, dryRun = false } = options;
    const budget = Math.min(options.budget, MAX_SWEEP_BUDGET);

    const session = this.createSession(tenantId, budget);
    const pageLog: SweepPageLogEntry[] = [];
    const results: SweepResults = {
      pagesProcessed: 0,
      summariesRegenerated: 0,
      summariesSkipped: 0,
      linkSuggestionsFound: 0,
      errors: 0,
    };

    // Persist session start (unless dry-run)
    if (!dryRun) {
      await prisma.sweepSession.create({
        data: {
          id: session.id,
          tenantId: session.tenantId,
          budget: session.budget,
          status: "RUNNING",
          results: results as unknown as Record<string, unknown>,
        },
      });
    }

    try {
      // Select pages to process
      const pages = await selectPagesForSweep(budget, tenantId);

      // Process each page
      for (const page of pages) {
        const startTime = Date.now();

        try {
          // Run all registered processors
          for (const processor of this.processors) {
            const entry = await processor(page, tenantId, dryRun);
            pageLog.push(entry);

            // Aggregate results
            switch (entry.action) {
              case "SUMMARY_REGENERATED":
              case "SUMMARY_GENERATED":
                results.summariesRegenerated++;
                break;
              case "LINKS_DISCOVERED":
                results.linkSuggestionsFound += entry.suggestions?.length ?? 0;
                break;
              case "SKIPPED":
                results.summariesSkipped++;
                break;
              case "ERROR":
                results.errors++;
                break;
            }
          }

          results.pagesProcessed++;

          // Update lastAgentVisitAt (unless dry-run)
          if (!dryRun) {
            await prisma.page.update({
              where: { id: page.id },
              data: { lastAgentVisitAt: new Date() },
            });
          }
        } catch (err) {
          results.errors++;
          pageLog.push({
            pageId: page.id,
            title: page.title,
            action: "ERROR",
            reason: err instanceof Error ? err.message : "unknown_error",
            durationMs: Date.now() - startTime,
          });
        }
      }

      session.status = "COMPLETED";
    } catch (err) {
      session.status = "FAILED";
      console.error("Sweep failed:", err);
    }

    session.completedAt = new Date();
    session.results = results;

    // Persist final session state (unless dry-run)
    if (!dryRun) {
      await prisma.sweepSession.update({
        where: { id: session.id },
        data: {
          status: session.status,
          completedAt: session.completedAt,
          results: results as unknown as Record<string, unknown>,
        },
      });
    }

    // Extract link suggestions from page log
    const linkSuggestions = pageLog
      .filter((e) => e.action === "LINKS_DISCOVERED" && e.suggestions)
      .flatMap((e) =>
        (e.suggestions ?? []).map((title) => ({
          sourcePageId: e.pageId,
          targetPageId: "",
          targetTitle: title,
          confidence: 0,
          context: "",
        }))
      );

    return {
      session,
      pageLog,
      linkSuggestions,
    };
  }

  private createSession(tenantId: string, budget: number): SweepSessionData {
    const now = new Date();
    return {
      id: `sweep-${now.toISOString().replace(/[:.]/g, "").slice(0, 15)}`,
      tenantId,
      startedAt: now,
      completedAt: null,
      budget,
      status: "RUNNING" as SweepStatus,
      results: {
        pagesProcessed: 0,
        summariesRegenerated: 0,
        summariesSkipped: 0,
        linkSuggestionsFound: 0,
        errors: 0,
      },
    };
  }
}
