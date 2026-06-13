/**
 * Promotion Service — Moves validated learnings from Private to Team Chemistry KB.
 *
 * Two modes:
 * - "copy": Creates a new page in Team KB with selected sections
 * - "move": Moves entire page, leaves redirect stub
 *
 * Also handles capture-learning from voice agent debrief.
 */

import * as crypto from "crypto";
import { prisma } from "@/lib/db";
import { tiptapToMarkdown } from "@/lib/agent/markdown";
import { markdownToTiptap } from "@/lib/agent/markdown";
import { createNotification } from "@/lib/notifications/create";
import { findExperimentByElnId } from "./experimentLookup";

/**
 * Stable fingerprint for a captured learning. Embedded as an HTML-comment marker
 * next to the learning so repeated debriefs (retries) don't append duplicates.
 */
function learningFingerprint(experimentId: string, content: string): string {
  return crypto
    .createHash("md5")
    .update(`${experimentId}::${content.trim().toLowerCase()}`)
    .digest("hex")
    .slice(0, 12);
}

function learningMarker(fingerprint: string): string {
  return `<!-- learn:${fingerprint} -->`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PromotionRequest {
  sourcePageId: string;
  targetCategoryId: string;
  promotionType: "copy" | "move";
  sections: string[];
  reviewRequired: boolean;
}

export interface PromotionResult {
  promotedPageId: string;
  action: "copied" | "moved";
  sectionsPromoted: string[];
  duplicateWarning?: string;
  reviewStatus: "approved" | "pending_review";
}

export interface LearningItem {
  type: "best_practice" | "pitfall" | "optimization" | "observation";
  content: string;
  confidence: "high" | "medium" | "low";
  promoteTo?: "team" | null;
}

export interface CaptureLearningRequest {
  experimentId: string;
  learnings: LearningItem[];
  debriefSummary?: string;
}

export interface CaptureLearningResult {
  captured: number;
  promoted: number;
  conflictsDetected: number;
  pageUpdates: Array<{ pageId: string; action: "appended" | "created" }>;
}

// ─── Section Extraction ──────────────────────────────────────────────────────

/**
 * Extract named sections from markdown content.
 * Returns the subset of markdown containing only matching sections.
 */
function extractSections(markdown: string, sectionNames: string[]): string {
  if (sectionNames.includes("all")) return markdown;

  const lines = markdown.split("\n");
  const extracted: string[] = [];
  let capturing = false;
  let currentHeadingLevel = 0;

  const patterns = sectionNames.map(
    (name) => new RegExp(`^(#{2,3})\\s+.*${escapeRegex(name)}`, "i")
  );

  for (const line of lines) {
    const headingMatch = line.match(/^(#{2,3})\s+/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const matchesSection = patterns.some((p) => p.test(line));

      if (matchesSection) {
        capturing = true;
        currentHeadingLevel = level;
        extracted.push(line);
        continue;
      }

      // Stop capturing if we hit same or higher level heading
      if (capturing && level <= currentHeadingLevel) {
        capturing = false;
      }
    }

    if (capturing) {
      extracted.push(line);
    }
  }

  return extracted.join("\n").trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

async function checkDuplicate(
  tenantId: string,
  title: string,
  targetCategoryId: string
): Promise<string | undefined> {
  const similar = await prisma.page.findFirst({
    where: {
      tenantId,
      parentId: targetCategoryId,
      title: { contains: title.split(":")[0].trim(), mode: "insensitive" },
    },
    select: { id: true, title: true },
  });

  if (similar) {
    return `A page with a similar title already exists: "${similar.title}" (${similar.id})`;
  }
  return undefined;
}

// ─── Promote Page ────────────────────────────────────────────────────────────

export async function promotePage(
  tenantId: string,
  userId: string,
  request: PromotionRequest
): Promise<PromotionResult> {
  // 1. Validate source page
  const sourcePage = await prisma.page.findFirst({
    where: { id: request.sourcePageId, tenantId },
    select: { id: true, title: true, icon: true, oneLiner: true, spaceType: true },
  });

  if (!sourcePage) {
    throw new Error("Source page not found");
  }

  // 2. Validate target category is in TEAM space
  const targetCategory = await prisma.page.findFirst({
    where: { id: request.targetCategoryId, tenantId, spaceType: "TEAM" },
    select: { id: true, title: true, teamspaceId: true },
  });

  if (!targetCategory) {
    throw new Error("Target category must be a Team space page");
  }

  // 3. Check for duplicates
  const duplicateWarning = await checkDuplicate(
    tenantId,
    sourcePage.title,
    request.targetCategoryId
  );

  // 4. Get source content
  const sourceBlock = await prisma.block.findFirst({
    where: {
      pageId: request.sourcePageId,
      tenantId,
      type: "DOCUMENT",
    },
    select: { content: true },
  });

  const sourceMarkdown = sourceBlock
    ? tiptapToMarkdown(sourceBlock.content)
    : "";

  // 5. Extract sections
  const promotedContent = extractSections(sourceMarkdown, request.sections);

  // 6. Get researcher name for attribution
  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { name: true, email: true },
  });
  const attribution = user?.name || user?.email || "Unknown";

  let promotedPageId: string;
  let action: "copied" | "moved";
  const reviewStatus = request.reviewRequired
    ? "pending_review" as const
    : "approved" as const;

  if (request.promotionType === "copy") {
    // Create new page in target category
    const maxPos = await prisma.page.aggregate({
      where: { tenantId, parentId: request.targetCategoryId },
      _max: { position: true },
    });

    const contentWithAttribution =
      promotedContent +
      `\n\n---\n*Contributed by ${attribution} from ${sourcePage.title}*`;

    const tiptap = markdownToTiptap(contentWithAttribution);

    const newPage = await prisma.page.create({
      data: {
        tenantId,
        title: sourcePage.title,
        icon: sourcePage.icon,
        oneLiner: sourcePage.oneLiner,
        parentId: request.targetCategoryId,
        spaceType: "TEAM",
        teamspaceId: targetCategory.teamspaceId,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });

    await prisma.block.create({
      data: {
        tenantId,
        pageId: newPage.id,
        type: "DOCUMENT",
        content: tiptap ?? {},
        position: 0,
      },
    });

    promotedPageId = newPage.id;
    action = "copied";
  } else {
    // Move: update page space and parent
    await prisma.page.update({
      where: { id: request.sourcePageId },
      data: {
        spaceType: "TEAM",
        teamspaceId: targetCategory.teamspaceId,
        parentId: request.targetCategoryId,
      },
    });

    // Create redirect stub in original location
    const stubMarkdown = `This page has been promoted to the Chemistry KB.\n\nSee: [[${sourcePage.title}]]`;
    const stubTiptap = markdownToTiptap(stubMarkdown);

    const stub = await prisma.page.create({
      data: {
        tenantId,
        title: `${sourcePage.title} (moved)`,
        icon: "↗️",
        oneLiner: `Promoted to Chemistry KB`,
        parentId: null,
        spaceType: "PRIVATE",
        position: 0,
      },
    });

    await prisma.block.create({
      data: {
        tenantId,
        pageId: stub.id,
        type: "DOCUMENT",
        content: stubTiptap ?? {},
        position: 0,
      },
    });

    promotedPageId = request.sourcePageId;
    action = "moved";
  }

  // 7. Notify admins if review required
  if (request.reviewRequired && targetCategory.teamspaceId) {
    const admins = await prisma.teamspaceMember.findMany({
      where: {
        teamspaceId: targetCategory.teamspaceId,
        role: { in: ["ADMIN", "OWNER"] },
      },
      select: { userId: true },
    });

    for (const admin of admins) {
      await createNotification({
        tenantId,
        userId: admin.userId,
        type: "SYSTEM",
        title: "New content promoted to Chemistry KB",
        body: `"${sourcePage.title}" was promoted by ${attribution} and needs review.`,
        pageId: promotedPageId,
      });
    }
  }

  return {
    promotedPageId,
    action,
    sectionsPromoted: request.sections,
    duplicateWarning,
    reviewStatus,
  };
}

// ─── Capture Learning ────────────────────────────────────────────────────────

/**
 * Capture learnings from a voice agent debrief session.
 * Saves to the experiment's private page and optionally promotes to Team KB.
 */
export async function captureLearning(
  tenantId: string,
  userId: string,
  request: CaptureLearningRequest
): Promise<CaptureLearningResult> {
  const { experimentId, learnings, debriefSummary } = request;

  // Find experiment page by exact ELN id (externalId-keyed; never a loose
  // title prefix that could match the wrong experiment).
  const expPage = await findExperimentByElnId(tenantId, experimentId);

  if (!expPage) {
    throw new Error(`Experiment "${experimentId}" not found`);
  }

  const pageUpdates: CaptureLearningResult["pageUpdates"] = [];
  let promoted = 0;
  let duplicatesSkipped = 0;

  // Read the existing page body up front so we can dedup against learnings that
  // were already captured by an earlier (possibly retried) debrief.
  const block = await prisma.block.findFirst({
    where: {
      pageId: expPage.id,
      tenantId,
      type: "DOCUMENT",
    },
    select: { id: true, content: true },
  });

  const existingMarkdown = block ? tiptapToMarkdown(block.content) : "";

  // Keep only learnings whose fingerprint marker isn't already on the page.
  const newLearnings = learnings.filter((learning) => {
    const fp = learningFingerprint(experimentId, learning.content);
    if (existingMarkdown.includes(learningMarker(fp))) {
      duplicatesSkipped++;
      return false;
    }
    return true;
  });

  // Format the (deduplicated) learnings as markdown. Bullet text is kept clean;
  // the per-learning fingerprint markers are collected into a single trailing
  // comment block so future retries can detect them without polluting the body.
  const learningsByType: Record<string, string[]> = {};
  const fingerprints: string[] = [];
  for (const learning of newLearnings) {
    const label = formatLearningType(learning.type);
    if (!learningsByType[label]) learningsByType[label] = [];
    const confidenceTag =
      learning.confidence === "high"
        ? ""
        : ` *(${learning.confidence} confidence)*`;
    learningsByType[label].push(`- ${learning.content}${confidenceTag}`);
    fingerprints.push(learningFingerprint(experimentId, learning.content));
  }

  // Append to experiment page's DOCUMENT block (only if there's something new).
  if (block && newLearnings.length > 0) {
    let learningMarkdown = "\n\n## Debrief Learnings\n\n";
    if (debriefSummary) {
      learningMarkdown += `> ${debriefSummary}\n\n`;
    }
    for (const [label, items] of Object.entries(learningsByType)) {
      learningMarkdown += `### ${label}\n\n${items.join("\n")}\n\n`;
    }
    // Hidden fingerprint markers for idempotency on retried debriefs.
    learningMarkdown += `${fingerprints.map(learningMarker).join(" ")}\n`;

    const updatedMarkdown = existingMarkdown + learningMarkdown;
    const updatedTiptap = markdownToTiptap(updatedMarkdown);

    await prisma.block.update({
      where: { id: block.id },
      data: { content: updatedTiptap ?? {} },
    });

    pageUpdates.push({ pageId: expPage.id, action: "appended" });
  }

  // Handle promotions — append to relevant Team KB pages.
  // Only promote learnings that are actually new (not already on the experiment
  // page); a retried debrief must not re-promote the same advice.
  const promotableLearnings = newLearnings.filter(
    (l) => l.promoteTo === "team" && l.confidence !== "low"
  );

  if (promotableLearnings.length > 0) {
    // Find the reaction type page linked from this experiment
    const expLinks = await prisma.pageLink.findMany({
      where: { sourcePageId: expPage.id, tenantId },
      include: {
        targetPage: {
          select: { id: true, title: true, spaceType: true, parentId: true },
        },
      },
    });

    // Find parent pages to identify reaction type pages
    const parentIds = expLinks
      .map((l) => l.targetPage.parentId)
      .filter((id): id is string => id !== null);

    const parents =
      parentIds.length > 0
        ? await prisma.page.findMany({
            where: { id: { in: parentIds }, tenantId },
            select: { id: true, title: true },
          })
        : [];
    const parentMap = new Map(parents.map((p) => [p.id, p.title]));

    const reactionTypePage = expLinks.find((l) => {
      const parentTitle = l.targetPage.parentId
        ? parentMap.get(l.targetPage.parentId)
        : null;
      return parentTitle === "Reaction Types" && l.targetPage.spaceType === "TEAM";
    })?.targetPage;

    if (reactionTypePage) {
      // Append learnings to the reaction type page
      const rtBlock = await prisma.block.findFirst({
        where: {
          pageId: reactionTypePage.id,
          tenantId,
          type: "DOCUMENT",
        },
        select: { id: true, content: true },
      });

      if (rtBlock) {
        const rtMarkdown = tiptapToMarkdown(rtBlock.content);

        const user = await prisma.user.findFirst({
          where: { id: userId, tenantId },
          select: { name: true },
        });

        // Dedup against learnings already promoted to this reaction-type page.
        const rtLines: string[] = [];
        const rtFingerprints: string[] = [];
        for (const learning of promotableLearnings) {
          const fp = learningFingerprint(experimentId, learning.content);
          if (rtMarkdown.includes(learningMarker(fp))) {
            duplicatesSkipped++;
            continue;
          }
          rtLines.push(
            `- ${learning.content} *(from ${expPage.title}, ${user?.name ?? "unknown"})*`
          );
          rtFingerprints.push(fp);
          promoted++;
        }

        if (rtLines.length > 0) {
          const appendMarkdown =
            `\n\n### Recent Learnings\n\n${rtLines.join("\n")}\n` +
            `${rtFingerprints.map(learningMarker).join(" ")}\n`;
          const updatedRt = rtMarkdown + appendMarkdown;
          const updatedRtTiptap = markdownToTiptap(updatedRt);

          await prisma.block.update({
            where: { id: rtBlock.id },
            data: { content: updatedRtTiptap ?? {} },
          });

          pageUpdates.push({ pageId: reactionTypePage.id, action: "appended" });
        }
      }
    }
  }

  return {
    captured: newLearnings.length,
    promoted,
    // Number of learnings that were already present (duplicate retries) and so
    // were skipped rather than re-appended.
    conflictsDetected: duplicatesSkipped,
    pageUpdates,
  };
}

function formatLearningType(type: string): string {
  switch (type) {
    case "best_practice":
      return "Best Practices";
    case "pitfall":
      return "Common Pitfalls";
    case "optimization":
      return "Optimizations";
    case "observation":
      return "Observations";
    default:
      return "Notes";
  }
}
