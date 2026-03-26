import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  findExperimentByElnId,
  findActiveExperiment,
  findArchivedExperiment,
} from "@/lib/chemistryKb/experimentLookup";
import { setupChemistryKbHierarchy } from "@/lib/chemistryKb/setupHierarchy";
import { markWikilinksAsDeleted } from "@/lib/wikilinks/renameUpdater";
import { markdownToTiptap } from "@/lib/markdown/deserializer";
import { processAgentWikilinks } from "@/lib/agent/wikilinks";
import { deletePageFile } from "@/lib/sync/SyncService";
import { z } from "zod";

const SYNC_SERVICE_KEY = process.env.SYNC_SERVICE_KEY;

const syncPayloadSchema = z.object({
  eln_experiment_id: z.string().min(1),
  action: z.enum(["create", "delete", "restore", "update", "purge", "archive"]),
  source: z.string().min(1),
  correlation_id: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
});

type SyncAction = z.infer<typeof syncPayloadSchema>["action"];

/**
 * Authenticate the sync request using the SYNC_SERVICE_KEY.
 */
function authenticateSync(req: NextRequest): boolean {
  if (!SYNC_SERVICE_KEY) {
    console.warn("[sync/experiments] SYNC_SERVICE_KEY not configured");
    return false;
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;

  const token = authHeader.substring(7);
  return token === SYNC_SERVICE_KEY;
}

/**
 * Resolve the tenantId from the request.
 */
function resolveTenantId(req: NextRequest): string | null {
  return (
    req.headers.get("X-Tenant-ID") ||
    process.env.DEFAULT_TENANT_ID ||
    null
  );
}

/**
 * OPTIONS /api/sync/experiments — CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, X-Source, X-Correlation-ID, X-Tenant-ID",
    },
  });
}

/**
 * POST /api/sync/experiments
 *
 * Receives experiment lifecycle events from ChemELN or ExpTube.
 * Actions: create, delete, restore, update, purge.
 *
 * This is the RECEIVING end — never re-propagates events.
 */
export async function POST(req: NextRequest) {
  // Auth
  if (!authenticateSync(req)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid or missing SYNC_SERVICE_KEY" } },
      { status: 401 }
    );
  }

  const tenantId = resolveTenantId(req);
  if (!tenantId) {
    return NextResponse.json(
      { error: { code: "UNPROCESSABLE_ENTITY", message: "Cannot resolve tenantId" } },
      { status: 422 }
    );
  }

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
      { status: 400 }
    );
  }

  const parsed = syncPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid payload",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const { eln_experiment_id, action, source, correlation_id } = parsed.data;
  const correlationId = correlation_id || req.headers.get("X-Correlation-ID") || "none";
  const logPrefix = `[sync/experiments] [${correlationId}] [${source}]`;

  console.log(`${logPrefix} Received ${action} for ${eln_experiment_id}`);

  try {
    const result = await handleAction(action, eln_experiment_id, tenantId, parsed.data, logPrefix);
    return NextResponse.json(result.body, {
      status: result.status,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "X-Correlation-ID": correlationId,
      },
    });
  } catch (error) {
    console.error(`${logPrefix} Error handling ${action}:`, error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 }
    );
  }
}

async function handleAction(
  action: SyncAction,
  elnId: string,
  tenantId: string,
  payload: z.infer<typeof syncPayloadSchema>,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  switch (action) {
    case "create":
      return handleCreate(elnId, tenantId, payload.fields || {}, logPrefix);
    case "delete":
    case "archive":
      return handleArchive(elnId, tenantId, logPrefix);
    case "restore":
      return handleRestore(elnId, tenantId, logPrefix);
    case "update":
      return handleUpdate(elnId, tenantId, payload.fields || {}, logPrefix);
    case "purge":
      return handlePurge(elnId, tenantId, logPrefix);
  }
}

/**
 * Generate a scaffolded KB page for a newly synced experiment.
 * The page has empty sections for institutional knowledge that users fill in over time.
 */
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

  // Frontmatter
  lines.push("---");
  lines.push(`title: "${title}"`);
  lines.push(`eln_id: "${elnId}"`);
  if (researcher) lines.push(`researcher: "${researcher}"`);
  lines.push(`date: "${date}"`);
  lines.push(`status: "${status}"`);
  if (reactionType) lines.push(`reaction_type: "${reactionType}"`);
  lines.push("tags:");
  lines.push(`  - "eln:${elnId}"`);
  lines.push(`  - "synced"`);
  lines.push("---");
  lines.push("");

  // Title
  lines.push(`# ${title}`);
  lines.push("");
  if (summary) {
    lines.push(`> ${summary}`);
    lines.push("");
  }

  // Metadata
  if (researcher) lines.push(`**Researcher:** [[${researcher}]]`);
  lines.push(`**Date:** ${date}`);
  lines.push(`**Status:** ${status}`);
  if (reactionType) lines.push(`**Reaction Type:** [[${reactionType}]]`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Scaffolded sections for institutional knowledge
  lines.push("## Results & Observations");
  lines.push("");
  lines.push("*Add your observations from this experiment here.*");
  lines.push("");
  lines.push("## What Works Well");
  lines.push("");
  lines.push("*Add best practices and tips discovered during this experiment.*");
  lines.push("");
  lines.push("## Common Challenges");
  lines.push("");
  lines.push("*Document pitfalls and issues encountered.*");
  lines.push("");
  lines.push("## Recommendations for Next Time");
  lines.push("");
  lines.push("*What would you do differently?*");
  lines.push("");
  lines.push("## Related Experiments");
  lines.push("");
  lines.push("*Add [[wikilinks]] to related experiments here.*");
  lines.push("");

  return lines.join("\n");
}

async function handleCreate(
  elnId: string,
  tenantId: string,
  fields: Record<string, string>,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  // Require a title for create
  if (!fields.title) {
    return {
      status: 400,
      body: { error: { code: "BAD_REQUEST", message: "fields.title is required for create action" } },
    };
  }

  // Idempotent: check if page already exists
  const existing = await findExperimentByElnId(tenantId, elnId);
  if (existing) {
    console.log(`${logPrefix} Already exists: ${existing.title} (${existing.id})`);
    return { status: 200, body: { status: "exists", id: existing.id, title: existing.title } };
  }

  // Ensure Chemistry KB hierarchy exists
  const hierarchy = await setupChemistryKbHierarchy(tenantId);

  // Build experiment title (prefix with ELN ID if not already included)
  const title = fields.title.startsWith(elnId)
    ? fields.title
    : `${elnId}: ${fields.title}`;

  // Determine target folder: archived/trashed experiments go to Archive
  const isArchived =
    fields.source_status === "archived" ||
    fields.source_status === "trashed" ||
    !!fields.source_deleted_at;
  const targetParentId = isArchived ? hierarchy.archiveId : hierarchy.experimentsId;

  // Generate page content
  const markdown = generateExperimentKbMarkdown(elnId, { ...fields, title });
  const { content: tiptap } = markdownToTiptap(markdown);

  // Find next position under target folder
  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId: targetParentId },
    _max: { position: true },
  });
  const nextPosition = (maxPosition._max.position ?? -1) + 1;

  // Create the page
  const page = await prisma.page.create({
    data: {
      tenantId,
      title,
      icon: "\u{1F9EA}",
      oneLiner: fields.summary || null,
      parentId: targetParentId,
      position: nextPosition,
      spaceType: "TEAM",
      teamspaceId: hierarchy.teamspaceId || undefined,
    },
  });

  // Create the content block
  await prisma.block.create({
    data: {
      tenantId,
      pageId: page.id,
      type: "DOCUMENT",
      content: tiptap as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
      position: 0,
    },
  });

  // Process wikilinks (creates PageLink records for [[references]])
  await processAgentWikilinks(page.id, tenantId, tiptap);

  const folder = isArchived ? "Archive" : "Experiments";
  console.log(`${logPrefix} Created: ${title} (${page.id}) in ${folder}`);
  return { status: 201, body: { status: "created", id: page.id, title, folder } };
}

async function handleArchive(
  elnId: string,
  tenantId: string,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const page = await findActiveExperiment(tenantId, elnId);
  if (!page) {
    // Check if already archived
    const archived = await findArchivedExperiment(tenantId, elnId);
    if (archived) {
      console.log(`${logPrefix} Already archived: ${archived.title} (${archived.id})`);
      return { status: 200, body: { status: "already_archived", id: archived.id, title: archived.title } };
    }
    return { status: 404, body: { error: { code: "NOT_FOUND", message: `Experiment ${elnId} not found` } } };
  }

  const hierarchy = await setupChemistryKbHierarchy(tenantId);

  // Move to Archive folder instead of deleting
  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId: hierarchy.archiveId },
    _max: { position: true },
  });

  await prisma.page.update({
    where: { id: page.id },
    data: {
      parentId: hierarchy.archiveId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  console.log(`${logPrefix} Archived: ${page.title} (${page.id})`);
  return { status: 200, body: { status: "archived", id: page.id, title: page.title } };
}

async function handleRestore(
  elnId: string,
  tenantId: string,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const page = await findArchivedExperiment(tenantId, elnId);
  if (!page) {
    // Check if already active
    const active = await findActiveExperiment(tenantId, elnId);
    if (active) {
      console.log(`${logPrefix} Already active: ${active.title} (${active.id})`);
      return { status: 200, body: { status: "already_active", id: active.id, title: active.title } };
    }
    return { status: 404, body: { error: { code: "NOT_FOUND", message: `Archived experiment ${elnId} not found` } } };
  }

  const hierarchy = await setupChemistryKbHierarchy(tenantId);

  // Move back to Experiments folder
  const maxPosition = await prisma.page.aggregate({
    where: { tenantId, parentId: hierarchy.experimentsId },
    _max: { position: true },
  });

  await prisma.page.update({
    where: { id: page.id },
    data: {
      parentId: hierarchy.experimentsId,
      position: (maxPosition._max.position ?? -1) + 1,
    },
  });

  console.log(`${logPrefix} Restored: ${page.title} (${page.id})`);
  return { status: 200, body: { status: "restored", id: page.id, title: page.title } };
}

async function handleUpdate(
  elnId: string,
  tenantId: string,
  fields: Record<string, string>,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const page = await findActiveExperiment(tenantId, elnId);
  if (!page) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: `Experiment ${elnId} not found` } } };
  }

  // Only allow safe field updates
  const allowedFields: Record<string, string> = {};
  if (fields.title) allowedFields.title = fields.title;
  if (fields.oneLiner) allowedFields.oneLiner = fields.oneLiner;

  if (Object.keys(allowedFields).length === 0) {
    return { status: 400, body: { error: { code: "BAD_REQUEST", message: "No valid fields to update" } } };
  }

  await prisma.page.update({
    where: { id: page.id },
    data: allowedFields,
  });

  console.log(`${logPrefix} Updated: ${page.title} (${page.id}) fields: ${Object.keys(allowedFields).join(", ")}`);
  return { status: 200, body: { status: "updated", id: page.id, fields: Object.keys(allowedFields) } };
}

async function handlePurge(
  elnId: string,
  tenantId: string,
  logPrefix: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  const page = await findExperimentByElnId(tenantId, elnId);
  if (!page) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: `Experiment ${elnId} not found` } } };
  }

  const pageId = page.id;
  await prisma.page.delete({ where: { id: pageId } });
  deletePageFile(tenantId, pageId).catch(() => {});

  console.log(`${logPrefix} Purged: ${page.title} (${pageId})`);
  return { status: 200, body: { status: "purged", id: pageId } };
}
