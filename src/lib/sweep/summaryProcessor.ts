import { getSummaryService } from "@/lib/summary/SummaryService";
import { isSummaryGenerationEnabled } from "@/lib/summary/config";
import type { SelectedPage } from "./pageSelection";
import type { SweepPageLogEntry } from "./types";

/**
 * Sweep processor: detects stale summaries and regenerates them
 * using the existing SummaryService from EPIC-33.
 *
 * Staleness rules:
 *  - summaryUpdatedAt is null → generate fresh
 *  - updatedAt > summaryUpdatedAt → regenerate (content changed)
 *  - Otherwise → skip (summary is current)
 */
export async function summaryProcessor(
  page: SelectedPage,
  tenantId: string,
  dryRun: boolean
): Promise<SweepPageLogEntry> {
  const startTime = Date.now();

  // Check if LLM is configured
  if (!isSummaryGenerationEnabled()) {
    return {
      pageId: page.id,
      title: page.title,
      action: "SKIPPED",
      reason: "llm_not_configured",
      durationMs: Date.now() - startTime,
    };
  }

  // Determine staleness
  const hasSummary = page.summaryUpdatedAt !== null;
  const isStale =
    hasSummary &&
    page.updatedAt > page.summaryUpdatedAt!;
  const needsGeneration = !hasSummary;

  if (hasSummary && !isStale) {
    return {
      pageId: page.id,
      title: page.title,
      action: "SKIPPED",
      reason: "summary_current",
      durationMs: Date.now() - startTime,
    };
  }

  if (dryRun) {
    return {
      pageId: page.id,
      title: page.title,
      action: needsGeneration ? "SUMMARY_GENERATED" : "SUMMARY_REGENERATED",
      reason: needsGeneration
        ? "no_summary_exists_dry_run"
        : "content_newer_than_summary_dry_run",
      durationMs: Date.now() - startTime,
    };
  }

  // Generate/regenerate using the existing SummaryService
  try {
    const summaryService = getSummaryService();
    await summaryService.generateForPage(page.id, tenantId);

    return {
      pageId: page.id,
      title: page.title,
      action: needsGeneration ? "SUMMARY_GENERATED" : "SUMMARY_REGENERATED",
      reason: needsGeneration
        ? "no_summary_exists"
        : "content_newer_than_summary",
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      pageId: page.id,
      title: page.title,
      action: "ERROR",
      reason: `summary_generation_failed: ${err instanceof Error ? err.message : "unknown"}`,
      durationMs: Date.now() - startTime,
    };
  }
}
