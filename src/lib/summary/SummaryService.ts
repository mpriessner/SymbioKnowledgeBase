import { prisma } from "@/lib/db";
import {
  SUMMARY_CHANGE_THRESHOLD,
  SUMMARY_RATE_LIMIT,
  SUMMARY_LLM_PROVIDER,
  SUMMARY_LLM_MODEL,
  isSummaryGenerationEnabled,
} from "./config";
import {
  approximateChangeRatio,
  shouldRegenerateSummary,
} from "./changeDetection";
import { createLLMProvider } from "./llmProvider";
import { RateLimiter } from "./rateLimiter";
import type {
  LLMProvider,
  BatchOptions,
  BatchResult,
  SummaryLogEntry,
} from "./types";

// Singleton rate limiter shared across all requests
const rateLimiter = new RateLimiter(SUMMARY_RATE_LIMIT);

/**
 * Core summary generation service.
 *
 * Handles change detection, LLM generation, rate limiting,
 * and batch processing for page summaries.
 */
export class SummaryService {
  private provider: LLMProvider | null;

  constructor() {
    this.provider = createLLMProvider();
  }

  /**
   * Called after every page save. Checks if content changed enough
   * to warrant summary regeneration, and queues it if so.
   *
   * Runs the change detection synchronously (fast check), then
   * fires off the LLM call asynchronously (non-blocking).
   */
  async onPageSaved(
    pageId: string,
    tenantId: string,
    oldPlainText: string,
    newPlainText: string
  ): Promise<void> {
    if (!this.provider) return;

    // Get current summary state
    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId },
      select: { oneLiner: true },
    });

    const changeRatio = approximateChangeRatio(oldPlainText, newPlainText);
    const shouldRegenerate = shouldRegenerateSummary(
      changeRatio,
      page?.oneLiner ?? null,
      SUMMARY_CHANGE_THRESHOLD
    );

    if (!shouldRegenerate) {
      return;
    }

    // Fire-and-forget async generation
    this.generateForPage(pageId, tenantId).catch((err) =>
      console.error(`Summary generation failed for page ${pageId}:`, err)
    );
  }

  /**
   * Generate summary for a specific page.
   * Respects rate limiting.
   */
  async generateForPage(
    pageId: string,
    tenantId: string
  ): Promise<void> {
    if (!this.provider) {
      throw new Error("Summary generation is not configured");
    }

    // Rate limiting
    if (!rateLimiter.acquire(tenantId)) {
      // Deferred — log and skip (sweep in EPIC-34 will retry)
      console.log(
        `Rate limited: deferring summary generation for page ${pageId}`
      );
      return;
    }

    // Load page data
    const page = await prisma.page.findFirst({
      where: { id: pageId, tenantId },
      select: {
        id: true,
        title: true,
        blocks: {
          where: { type: "DOCUMENT", deletedAt: null },
          select: { plainText: true },
          take: 1,
        },
      },
    });

    if (!page) return;

    const plainText = page.blocks[0]?.plainText || "";
    if (!plainText.trim()) return;

    try {
      const result = await this.provider.generateSummary(
        page.title,
        plainText
      );

      // Update page with generated summary
      await prisma.page.update({
        where: { id: pageId },
        data: {
          oneLiner: result.oneLiner,
          summary: result.summary,
          summaryUpdatedAt: new Date(),
        },
      });

      // Log the generation
      const logEntry: SummaryLogEntry = {
        pageId,
        provider: SUMMARY_LLM_PROVIDER,
        model: SUMMARY_LLM_MODEL,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        latencyMs: result.latencyMs,
        estimatedCost: estimateCost(
          result.inputTokens,
          result.outputTokens
        ),
        timestamp: new Date().toISOString(),
      };

      console.log("Summary generated:", JSON.stringify(logEntry));
    } catch (err) {
      console.error(
        `LLM summary generation error for page ${pageId}:`,
        err
      );
      // Keep existing summary unchanged on error
    }
  }

  /**
   * Batch generate summaries for all pages missing them.
   */
  async generateBatch(
    tenantId: string,
    options: BatchOptions = {}
  ): Promise<BatchResult> {
    const { overwrite = false, dryRun = false, limit } = options;

    if (!this.provider) {
      throw new Error("Summary generation is not configured");
    }

    // Find pages that need summaries
    const where: Record<string, unknown> = { tenantId };
    if (!overwrite) {
      where.oneLiner = null;
    }

    const pages = await prisma.page.findMany({
      where,
      select: {
        id: true,
        title: true,
        oneLiner: true,
        blocks: {
          where: { type: "DOCUMENT", deletedAt: null },
          select: { plainText: true },
          take: 1,
        },
      },
      orderBy: { updatedAt: "desc" },
      ...(limit ? { take: limit } : {}),
    });

    const result: BatchResult = {
      processed: 0,
      skipped: 0,
      errors: 0,
      total: pages.length,
    };

    if (dryRun) {
      return result;
    }

    for (const page of pages) {
      const plainText = page.blocks[0]?.plainText || "";
      if (!plainText.trim()) {
        result.skipped++;
        continue;
      }

      try {
        await rateLimiter.waitForSlot(tenantId);
        await this.generateForPage(page.id, tenantId);
        result.processed++;
      } catch {
        result.errors++;
      }
    }

    return result;
  }
}

/**
 * Rough cost estimate based on token counts.
 * Uses approximate pricing for gpt-4o-mini.
 */
function estimateCost(
  inputTokens: number,
  outputTokens: number
): number {
  // gpt-4o-mini: ~$0.15/1M input, ~$0.60/1M output
  return (
    (inputTokens * 0.00000015) + (outputTokens * 0.0000006)
  );
}

// Export singleton for use in API routes
let _instance: SummaryService | null = null;

export function getSummaryService(): SummaryService {
  if (!_instance) {
    _instance = new SummaryService();
    if (!isSummaryGenerationEnabled()) {
      console.info(
        "Summary generation disabled: no LLM API key configured"
      );
    }
  }
  return _instance;
}
