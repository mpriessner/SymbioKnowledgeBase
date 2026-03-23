/**
 * Conflict Detection Service — Identifies when newly promoted knowledge
 * conflicts with existing institutional knowledge in the Team Chemistry KB.
 *
 * Detection is stateless — runs on demand by comparing knowledge statements
 * between a target page and existing pages in the same category.
 */

import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";
import { createNotification } from "@/lib/notifications/create";
import { extractStatements, findSimilarPairs } from "./textSimilarity";
import { randomUUID } from "crypto";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Conflict {
  id: string;
  type: "contradictory" | "superseded" | "conditional";
  existingPage: { id: string; title: string; statement: string };
  newPage: { id: string; title: string; statement: string };
  similarity: number;
  suggestion: string;
}

export interface ConflictReport {
  conflicts: Conflict[];
  totalConflicts: number;
  autoResolvable: number;
  requiresReview: number;
}

// ─── Conflict Type Classification ────────────────────────────────────────────

const SUPERSEDED_INDICATORS = [
  "updated", "revised", "replaced", "new protocol", "improved",
  "better", "instead", "no longer", "deprecated", "obsolete",
];

const CONDITIONAL_INDICATORS = [
  "when", "if", "unless", "except", "for", "with",
  "at", "above", "below", "under", "depending",
];

function classifyConflictType(
  existingStatement: string,
  newStatement: string
): "contradictory" | "superseded" | "conditional" {
  // Check for conditional language in both
  const existingHas = CONDITIONAL_INDICATORS.some((ind) =>
    existingStatement.toLowerCase().includes(ind)
  );
  const newHas = CONDITIONAL_INDICATORS.some((ind) =>
    newStatement.toLowerCase().includes(ind)
  );
  if (existingHas && newHas) return "conditional";

  // Check for superseded indicators in the new statement
  const hasSuperseded = SUPERSEDED_INDICATORS.some((ind) =>
    newStatement.toLowerCase().includes(ind)
  );
  if (hasSuperseded) return "superseded";

  return "contradictory";
}

function generateSuggestion(
  type: "contradictory" | "superseded" | "conditional"
): string {
  switch (type) {
    case "contradictory":
      return "These statements appear to contradict each other. Review both and determine which is correct, or if they apply to different conditions.";
    case "superseded":
      return "The new statement may supersede the existing one. Consider replacing the old statement if the new one reflects updated knowledge.";
    case "conditional":
      return "Both statements may be valid under different conditions. Consider adding explicit conditions to distinguish when each applies.";
  }
}

// ─── Core Detection ──────────────────────────────────────────────────────────

/**
 * Detect conflicts between a newly promoted page and existing pages
 * in the same category of the Team KB.
 */
export async function detectConflicts(
  tenantId: string,
  newPageId: string,
  targetCategoryId: string
): Promise<ConflictReport> {
  const emptyReport: ConflictReport = {
    conflicts: [],
    totalConflicts: 0,
    autoResolvable: 0,
    requiresReview: 0,
  };

  // 1. Get the new page and its content
  const newPage = await prisma.page.findFirst({
    where: { id: newPageId, tenantId },
    select: { id: true, title: true },
  });

  if (!newPage) return emptyReport;

  const newBlock = await prisma.block.findFirst({
    where: { pageId: newPageId, tenantId, type: "DOCUMENT", deletedAt: null },
    select: { content: true },
  });

  const newMarkdown = newBlock ? tiptapToMarkdown(newBlock.content) : "";
  const newStatements = extractStatements(newMarkdown);

  if (newStatements.length === 0) return emptyReport;

  // 2. Find existing pages in the same category
  const existingPages = await prisma.page.findMany({
    where: {
      tenantId,
      parentId: targetCategoryId,
      spaceType: "TEAM",
      id: { not: newPageId },
    },
    select: { id: true, title: true },
    take: 50,
  });

  if (existingPages.length === 0) return emptyReport;

  // 3. Extract statements from existing pages and compare
  const conflicts: Conflict[] = [];

  for (const existing of existingPages) {
    const block = await prisma.block.findFirst({
      where: {
        pageId: existing.id,
        tenantId,
        type: "DOCUMENT",
        deletedAt: null,
      },
      select: { content: true },
    });

    if (!block) continue;

    const existingMarkdown = tiptapToMarkdown(block.content);
    const existingStatements = extractStatements(existingMarkdown);

    if (existingStatements.length === 0) continue;

    // 4. Find similar pairs above threshold
    const pairs = findSimilarPairs(existingStatements, newStatements, 0.7);

    for (const pair of pairs) {
      const type = classifyConflictType(pair.statementA, pair.statementB);

      conflicts.push({
        id: randomUUID(),
        type,
        existingPage: {
          id: existing.id,
          title: existing.title,
          statement: pair.statementA,
        },
        newPage: {
          id: newPage.id,
          title: newPage.title,
          statement: pair.statementB,
        },
        similarity: Math.round(pair.similarity * 100) / 100,
        suggestion: generateSuggestion(type),
      });
    }
  }

  const autoResolvable = conflicts.filter((c) => c.type === "superseded").length;

  return {
    conflicts,
    totalConflicts: conflicts.length,
    autoResolvable,
    requiresReview: conflicts.length - autoResolvable,
  };
}

// ─── Notification ────────────────────────────────────────────────────────────

/**
 * Notify Chemistry KB admins about detected conflicts.
 */
export async function notifyConflicts(
  tenantId: string,
  report: ConflictReport,
  teamspaceId: string
): Promise<void> {
  if (report.conflicts.length === 0) return;

  const admins = await prisma.teamspaceMember.findMany({
    where: {
      teamspaceId,
      role: { in: ["ADMIN", "OWNER"] },
    },
    select: { userId: true },
  });

  const conflictSummary = report.conflicts
    .map((c) => `• "${c.existingPage.statement}" vs "${c.newPage.statement}"`)
    .slice(0, 3)
    .join("\n");

  for (const admin of admins) {
    await createNotification({
      tenantId,
      userId: admin.userId,
      type: "SYSTEM",
      title: `${report.totalConflicts} conflict(s) detected in Chemistry KB`,
      body: `${conflictSummary}${report.totalConflicts > 3 ? `\n...and ${report.totalConflicts - 3} more` : ""}`,
      pageId: report.conflicts[0].newPage.id,
    });
  }
}

// ─── Scan Conflicts ──────────────────────────────────────────────────────────

/**
 * Scan all pages in a category for mutual conflicts.
 * Useful for listing current conflicts without a specific promotion event.
 */
export async function scanCategoryConflicts(
  tenantId: string,
  categoryId: string
): Promise<ConflictReport> {
  const pages = await prisma.page.findMany({
    where: {
      tenantId,
      parentId: categoryId,
      spaceType: "TEAM",
    },
    select: { id: true, title: true },
    take: 50,
  });

  const pageStatements: Array<{
    page: { id: string; title: string };
    statements: string[];
  }> = [];

  for (const page of pages) {
    const block = await prisma.block.findFirst({
      where: {
        pageId: page.id,
        tenantId,
        type: "DOCUMENT",
        deletedAt: null,
      },
      select: { content: true },
    });

    if (!block) continue;

    const markdown = tiptapToMarkdown(block.content);
    const statements = extractStatements(markdown);

    if (statements.length > 0) {
      pageStatements.push({ page, statements });
    }
  }

  const conflicts: Conflict[] = [];

  // Pairwise comparison between all pages
  for (let i = 0; i < pageStatements.length; i++) {
    for (let j = i + 1; j < pageStatements.length; j++) {
      const pairs = findSimilarPairs(
        pageStatements[i].statements,
        pageStatements[j].statements,
        0.7
      );

      for (const pair of pairs) {
        const type = classifyConflictType(pair.statementA, pair.statementB);
        conflicts.push({
          id: randomUUID(),
          type,
          existingPage: {
            id: pageStatements[i].page.id,
            title: pageStatements[i].page.title,
            statement: pair.statementA,
          },
          newPage: {
            id: pageStatements[j].page.id,
            title: pageStatements[j].page.title,
            statement: pair.statementB,
          },
          similarity: Math.round(pair.similarity * 100) / 100,
          suggestion: generateSuggestion(type),
        });
      }
    }
  }

  const autoResolvable = conflicts.filter((c) => c.type === "superseded").length;

  return {
    conflicts,
    totalConflicts: conflicts.length,
    autoResolvable,
    requiresReview: conflicts.length - autoResolvable,
  };
}
