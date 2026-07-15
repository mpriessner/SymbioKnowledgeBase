/**
 * Reconciliation sync: pulls all experiments from ExpTube and creates/updates/moves
 * missing or changed KB pages.
 *
 * Per the revised architecture (SKB-52.12), ExpTube is the sole source of truth for SKB.
 * This module compares ExpTube's experiment list with existing SKB pages and reconciles.
 */

import { stringify as yamlStringify } from "yaml";
import { prisma } from "@/lib/db";
import {
  findExperimentByElnId,
  findActiveExperiment,
  findArchivedExperiment,
} from "./experimentLookup";
import { setupChemistryKbHierarchy, type HierarchyResult } from "./setupHierarchy";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { FIXED_SECTION_HEADINGS } from "@/lib/sync/contentMerge";
import { regenerateExperimentsIndex } from "./indexRegeneration";
import type { Prisma } from "@/generated/prisma/client";

/** Postgres unique-constraint violation surfaced by Prisma. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "P2002"
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpTubeExperiment {
  eln_experiment_id: string;
  title: string;
  summary?: string;
  researcher?: string;
  date?: string;
  status?: string;
  reaction_type?: string;
  deleted_at?: string | null;
}

export interface ReconciliationChange {
  elnId: string;
  title: string;
  action: "created" | "moved_to_archive" | "moved_to_experiments" | "title_updated" | "skipped";
  detail?: string;
}

export interface ReconciliationResult {
  syncId: string;
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string;
  duration: number;
  changeSet: {
    created: number;
    movedToArchive: number;
    movedToExperiments: number;
    titleUpdated: number;
    skipped: number;
    errors: number;
  };
  changes: ReconciliationChange[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// Concurrency guard
// ---------------------------------------------------------------------------

let activeSyncId: string | null = null;
let lastResult: ReconciliationResult | null = null;

export function isReconciliationRunning(): boolean {
  return activeSyncId !== null;
}

export function getLastReconciliationResult(): ReconciliationResult | null {
  return lastResult;
}

export function getActiveSyncId(): string | null {
  return activeSyncId;
}

// ---------------------------------------------------------------------------
// ExpTube client
// ---------------------------------------------------------------------------

async function fetchExpTubeExperiments(): Promise<ExpTubeExperiment[]> {
  const url = process.env.EXPTUBE_API_URL;
  const key = process.env.EXPTUBE_API_KEY || process.env.SYNC_SERVICE_KEY;

  if (!url) {
    throw new Error("EXPTUBE_API_URL is not configured");
  }

  const response = await fetch(`${url}/api/experiments`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`ExpTube API returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();

  // Handle both array response and { data: [...] } wrapper
  const experiments: ExpTubeExperiment[] = Array.isArray(data) ? data : data.data || data.experiments || [];
  return experiments;
}

// ---------------------------------------------------------------------------
// Page creation helper (mirrors handleCreate in sync/experiments/route.ts)
// ---------------------------------------------------------------------------

function generateExperimentKbMarkdown(
  elnId: string,
  fields: Record<string, string>
): string {
  const title = fields.title || elnId;
  const summary = fields.summary || "";
  const researcher = fields.researcher || "";
  const date = fields.date || new Date().toISOString().split("T")[0];
  const status = fields.status || "unknown";
  const reactionType = fields.reaction_type || "";

  const lines: string[] = [];

  // Frontmatter via the yaml library so quotes/colons/newlines in field values
  // are escaped safely rather than corrupting the YAML.
  const frontmatter: Record<string, unknown> = {
    title,
    eln_id: elnId,
  };
  if (researcher) frontmatter.researcher = researcher;
  frontmatter.date = date;
  frontmatter.status = status;
  if (reactionType) frontmatter.reaction_type = reactionType;
  frontmatter.tags = [`eln:${elnId}`, "synced"];

  lines.push("---");
  lines.push(yamlStringify(frontmatter).trimEnd());
  lines.push("---");
  lines.push("");
  lines.push(`# ${title}`);
  lines.push("");
  if (summary) {
    lines.push(`> ${summary}`);
    lines.push("");
  }
  if (researcher) lines.push(`**Researcher:** [[${researcher}]]`);
  lines.push(`**Date:** ${date}`);
  lines.push(`**Status:** ${status}`);
  if (reactionType) lines.push(`**Reaction Type:** [[${reactionType}]]`);
  lines.push("");
  lines.push("---");
  lines.push("");
  // a71-02: fixed section scaffold — must stay identical to the create-path
  // copy in src/app/api/sync/experiments/route.ts, or a page first
  // materialized via reconcile (this path) gets a different body structure
  // than one created via the push path, breaking contentMerge's
  // section-locate step for whichever path didn't run first.
  lines.push(`## ${FIXED_SECTION_HEADINGS[0]}`);
  lines.push("");
  lines.push("*Awaiting notebook content sync.*");
  lines.push("");
  lines.push(`## ${FIXED_SECTION_HEADINGS[1]}`);
  lines.push("");
  lines.push("*Awaiting notebook content sync.*");
  lines.push("");
  lines.push(`## ${FIXED_SECTION_HEADINGS[2]}`);
  lines.push("");
  lines.push("*Awaiting ExpTube analysis sync.*");
  lines.push("");
  lines.push(`## ${FIXED_SECTION_HEADINGS[3]}`);
  lines.push("");
  lines.push("*Add your own notes here — this section is never touched by automated sync.*");
  lines.push("");

  return lines.join("\n");
}

async function createExperimentPage(
  tenantId: string,
  experiment: ExpTubeExperiment,
  parentId: string,
  teamspaceId?: string
): Promise<string> {
  const elnId = experiment.eln_experiment_id;
  const title = experiment.title.startsWith(elnId)
    ? experiment.title
    : `${elnId}: ${experiment.title}`;

  const markdown = generateExperimentKbMarkdown(elnId, {
    title,
    summary: experiment.summary || "",
    researcher: experiment.researcher || "",
    date: experiment.date || "",
    status: experiment.status || "",
    reaction_type: experiment.reaction_type || "",
  });

  const { content: tiptap } = markdownToTiptap(markdown);

  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId },
    _max: { position: true },
  });

  // Page + content block are created atomically so a block failure can't leave
  // a contentless page. The unique (tenantId, externalId) index turns a
  // concurrent reconcile/ingest race into a P2002 we treat as idempotent.
  let page: { id: string };
  try {
    page = await prisma.$transaction(async (tx) => {
      const created = await tx.page.create({
        data: {
          tenantId,
          externalId: elnId,
          title,
          icon: "\u{1F9EA}",
          oneLiner: experiment.summary || null,
          parentId,
          position: (maxPosition._max.position ?? -1) + 1,
          spaceType: "TEAM",
          teamspaceId: teamspaceId || undefined,
        },
      });

      await tx.block.create({
        data: {
          tenantId,
          pageId: created.id,
          type: "DOCUMENT",
          content: tiptap as unknown as Prisma.InputJsonValue,
          position: 0,
        },
      });

      return created;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existing = await findExperimentByElnId(tenantId, elnId);
      if (existing) return existing.id;
    }
    throw error;
  }

  // Wikilinks resolved outside the transaction (reconcilable; must not roll back
  // the durable page+block record on a link-resolution error).
  await processAgentWikilinks(page.id, tenantId, tiptap);

  return page.id;
}

// ---------------------------------------------------------------------------
// Reconciliation logic
// ---------------------------------------------------------------------------

function isArchivedInSource(exp: ExpTubeExperiment): boolean {
  return (
    exp.deleted_at != null ||
    exp.status === "archived" ||
    exp.status === "trashed"
  );
}

export async function runReconciliation(
  tenantId: string,
  options: { full?: boolean; dryRun?: boolean } = {}
): Promise<ReconciliationResult> {
  const syncId = `recon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  activeSyncId = syncId;

  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const changes: ReconciliationChange[] = [];
  const errors: string[] = [];
  const changeSet = {
    created: 0,
    movedToArchive: 0,
    movedToExperiments: 0,
    titleUpdated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    console.log(`[sync/reconcile] [${syncId}] Starting reconciliation (full=${options.full ?? false}, dryRun=${options.dryRun ?? false})`);

    // 1. Fetch all experiments from ExpTube
    const experiments = await fetchExpTubeExperiments();
    console.log(`[sync/reconcile] [${syncId}] Fetched ${experiments.length} experiments from ExpTube`);

    // 2. Ensure hierarchy
    const hierarchy = await setupChemistryKbHierarchy(tenantId);

    // 3. Process each experiment
    for (const exp of experiments) {
      try {
        const change = await reconcileOneExperiment(
          tenantId,
          exp,
          hierarchy,
          options.dryRun ?? false
        );

        changes.push(change);

        switch (change.action) {
          case "created":
            changeSet.created++;
            break;
          case "moved_to_archive":
            changeSet.movedToArchive++;
            break;
          case "moved_to_experiments":
            changeSet.movedToExperiments++;
            break;
          case "title_updated":
            changeSet.titleUpdated++;
            break;
          case "skipped":
            changeSet.skipped++;
            break;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${exp.eln_experiment_id}: ${msg}`);
        changeSet.errors++;
        console.error(`[sync/reconcile] [${syncId}] Error processing ${exp.eln_experiment_id}: ${msg}`);
      }
    }

    // Keep the cheap Chemistry KB orientation page aligned with the pages
    // reconciled above. A dry run deliberately performs no secondary writes.
    if (!options.dryRun) {
      try {
        await regenerateExperimentsIndex(tenantId, {
          correlationId: syncId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(
          `[sync/reconcile] [${syncId}] Index regeneration failed: ${msg}`
        );
      }
    }

    const result: ReconciliationResult = {
      syncId,
      status: errors.length > 0 && changeSet.created === 0 ? "failed" : "completed",
      startedAt,
      completedAt: new Date().toISOString(),
      duration: Date.now() - startMs,
      changeSet,
      changes: changes.filter((c) => c.action !== "skipped"),
      errors,
    };

    lastResult = result;
    console.log(
      `[sync/reconcile] [${syncId}] Completed: ${changeSet.created} created, ${changeSet.movedToArchive} archived, ${changeSet.movedToExperiments} restored, ${changeSet.titleUpdated} updated, ${changeSet.skipped} skipped, ${changeSet.errors} errors`
    );

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[sync/reconcile] [${syncId}] Fatal error: ${msg}`);

    const result: ReconciliationResult = {
      syncId,
      status: "failed",
      startedAt,
      completedAt: new Date().toISOString(),
      duration: Date.now() - startMs,
      changeSet,
      changes,
      errors: [msg, ...errors],
    };

    lastResult = result;
    return result;
  } finally {
    activeSyncId = null;
  }
}

async function reconcileOneExperiment(
  tenantId: string,
  exp: ExpTubeExperiment,
  hierarchy: HierarchyResult,
  dryRun: boolean
): Promise<ReconciliationChange> {
  const elnId = exp.eln_experiment_id;
  const archived = isArchivedInSource(exp);

  // Check if page exists in SKB
  const existingActive = await findActiveExperiment(tenantId, elnId);
  const existingArchived = await findArchivedExperiment(tenantId, elnId);
  const existing = existingActive || existingArchived;

  // Case 1: New experiment — create
  if (!existing) {
    const targetParentId = archived ? hierarchy.archiveId : hierarchy.experimentsId;
    const folder = archived ? "Archive" : "Experiments";

    if (!dryRun) {
      await createExperimentPage(tenantId, exp, targetParentId, hierarchy.teamspaceId);
    }

    return {
      elnId,
      title: exp.title,
      action: "created",
      detail: `Created in ${folder}`,
    };
  }

  // Case 2: Exists in Experiments but archived in source → move to Archive
  if (existingActive && archived) {
    if (!dryRun) {
      const maxPos = await prisma.page.aggregate({
        where: { tenantId, parentId: hierarchy.archiveId },
        _max: { position: true },
      });

      await prisma.page.update({
        where: { id: existingActive.id },
        data: {
          parentId: hierarchy.archiveId,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
    }

    return {
      elnId,
      title: exp.title,
      action: "moved_to_archive",
      detail: "Source is trashed/archived",
    };
  }

  // Case 3: Exists in Archive but active in source → move to Experiments
  if (existingArchived && !archived) {
    if (!dryRun) {
      const maxPos = await prisma.page.aggregate({
        where: { tenantId, parentId: hierarchy.experimentsId },
        _max: { position: true },
      });

      await prisma.page.update({
        where: { id: existingArchived.id },
        data: {
          parentId: hierarchy.experimentsId,
          position: (maxPos._max.position ?? -1) + 1,
        },
      });
    }

    return {
      elnId,
      title: exp.title,
      action: "moved_to_experiments",
      detail: "Source is active again",
    };
  }

  // Case 4: Title changed — update title and oneLiner
  const expectedTitle = exp.title.startsWith(elnId)
    ? exp.title
    : `${elnId}: ${exp.title}`;

  if (existing.title !== expectedTitle) {
    if (!dryRun) {
      await prisma.page.update({
        where: { id: existing.id },
        data: {
          title: expectedTitle,
          oneLiner: exp.summary || undefined,
        },
      });
    }

    return {
      elnId,
      title: exp.title,
      action: "title_updated",
      detail: `"${existing.title}" → "${expectedTitle}"`,
    };
  }

  // Case 5: No change
  return {
    elnId,
    title: exp.title,
    action: "skipped",
  };
}
