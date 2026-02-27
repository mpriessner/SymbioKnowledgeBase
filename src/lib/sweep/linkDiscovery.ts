import { prisma } from "@/lib/db";
import {
  MIN_TITLE_LENGTH_FOR_LINK_DISCOVERY,
  AUTO_LINK_CONFIDENCE_THRESHOLD,
  LINK_CONTEXT_CHARS,
} from "./config";
import type { SelectedPage } from "./pageSelection";
import type { SweepPageLogEntry, LinkSuggestion } from "./types";

/**
 * Calculate confidence score for a title match in plain text.
 *
 * Higher confidence for:
 *  - Longer titles (less likely to be a false positive)
 *  - Whole-word matches
 *  - Title appears multiple times
 */
export function calculateConfidence(
  plainText: string,
  titleLower: string
): number {
  let score = 0.5;

  // Longer titles → higher confidence
  if (titleLower.length >= 10) score += 0.15;
  if (titleLower.length >= 20) score += 0.1;

  // Whole-word match (bounded by non-alphanumeric chars or string edges)
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegex(titleLower)}(?:[^a-z0-9]|$)`);
  if (pattern.test(plainText)) {
    score += 0.2;
  }

  // Multiple occurrences
  const firstIdx = plainText.indexOf(titleLower);
  const secondIdx = plainText.indexOf(titleLower, firstIdx + titleLower.length);
  if (secondIdx !== -1) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Extract surrounding context for a title match.
 */
export function extractContext(
  plainText: string,
  titleLower: string,
  chars: number = LINK_CONTEXT_CHARS
): string {
  const idx = plainText.indexOf(titleLower);
  if (idx === -1) return "";

  const start = Math.max(0, idx - chars);
  const end = Math.min(plainText.length, idx + titleLower.length + chars);

  let context = plainText.slice(start, end).trim();
  if (start > 0) context = "..." + context;
  if (end < plainText.length) context = context + "...";

  return context;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Discover unlinked references in a page's content.
 * Finds mentions of other page titles that aren't already linked.
 */
export async function discoverUnlinkedReferences(
  page: SelectedPage,
  tenantId: string
): Promise<LinkSuggestion[]> {
  // Load page's plain text
  const blocks = await prisma.block.findMany({
    where: { pageId: page.id, type: "DOCUMENT", deletedAt: null },
    select: { plainText: true },
    take: 1,
  });

  const plainText = (blocks[0]?.plainText || "").toLowerCase();
  if (!plainText.trim()) return [];

  // Get existing outgoing links for this page
  const existingLinks = await prisma.pageLink.findMany({
    where: { sourcePageId: page.id, tenantId },
    select: { targetPageId: true },
  });
  const linkedPageIds = new Set(existingLinks.map((l) => l.targetPageId));

  // Get all other pages in the tenant
  const allPages = await prisma.page.findMany({
    where: { tenantId, id: { not: page.id } },
    select: { id: true, title: true },
  });

  const suggestions: LinkSuggestion[] = [];

  for (const otherPage of allPages) {
    // Skip already-linked pages
    if (linkedPageIds.has(otherPage.id)) continue;

    const titleLower = otherPage.title.toLowerCase();

    // Skip very short titles (high false positive rate)
    if (titleLower.length < MIN_TITLE_LENGTH_FOR_LINK_DISCOVERY) continue;

    // Skip "Untitled" pages
    if (titleLower === "untitled") continue;

    // Check if the title appears in the plain text
    if (plainText.includes(titleLower)) {
      const confidence = calculateConfidence(plainText, titleLower);
      const context = extractContext(plainText, titleLower);

      suggestions.push({
        sourcePageId: page.id,
        targetPageId: otherPage.id,
        targetTitle: otherPage.title,
        confidence,
        context,
      });
    }
  }

  // Sort by confidence descending
  suggestions.sort((a, b) => b.confidence - a.confidence);

  return suggestions;
}

/**
 * Sweep processor for link discovery.
 * Finds unlinked page references and reports them as suggestions.
 */
export async function linkDiscoveryProcessor(
  page: SelectedPage,
  tenantId: string,
  dryRun: boolean
): Promise<SweepPageLogEntry> {
  const startTime = Date.now();

  try {
    const suggestions = await discoverUnlinkedReferences(page, tenantId);

    if (suggestions.length === 0) {
      return {
        pageId: page.id,
        title: page.title,
        action: "SKIPPED",
        reason: "no_unlinked_references",
        durationMs: Date.now() - startTime,
      };
    }

    // Optionally auto-create high-confidence links (future: controlled by autoLink flag)
    if (!dryRun) {
      const highConfidence = suggestions.filter(
        (s) => s.confidence >= AUTO_LINK_CONFIDENCE_THRESHOLD
      );
      // Note: auto-link creation would go here if enabled.
      // For now, we only report suggestions. Auto-linking would
      // create wikilinks in the page content, which is complex
      // and deferred to user review.
      void highConfidence; // acknowledged but not auto-linked yet
    }

    return {
      pageId: page.id,
      title: page.title,
      action: "LINKS_DISCOVERED",
      reason: `${suggestions.length}_unlinked_references_found`,
      suggestions: suggestions.map((s) => s.targetTitle),
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    return {
      pageId: page.id,
      title: page.title,
      action: "ERROR",
      reason: `link_discovery_failed: ${err instanceof Error ? err.message : "unknown"}`,
      durationMs: Date.now() - startTime,
    };
  }
}
