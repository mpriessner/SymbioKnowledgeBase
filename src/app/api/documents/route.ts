import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import type { TenantContext } from "@/types/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { renderDocumentTemplate } from "@/lib/chemistryKb/documentTemplate";
import { markdownToTiptap } from "@/lib/agent/markdown";
import { extractPlainText } from "@/lib/search/indexer";
import { validateUrlScheme, fetchUrlSnapshot } from "@/lib/documents/urlSnapshot";
import type { TipTapDocument } from "@/lib/wikilinks/types";

const createDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    space: z.enum(["private", "team"]),
    teamspace_id: z.string().uuid().optional(),
    source: z.enum(["upload", "url"]),
    url: z.string().trim().min(1).max(2048).optional(),
    tags: z.array(z.string().trim().max(64)).max(20).optional(),
  })
  .refine((body) => body.space !== "team" || !!body.teamspace_id, {
    message: "teamspace_id is required when space is 'team'",
    path: ["teamspace_id"],
  })
  .refine((body) => body.source !== "url" || !!body.url, {
    message: "url is required when source is 'url'",
    path: ["url"],
  });

/** Create a first-class document page for an authenticated browser session. */
export const POST = withTenant(async (req: NextRequest, ctx: TenantContext) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "Expected JSON body", undefined, 400);
  }

  const parsed = createDocumentSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("VALIDATION_ERROR", "Invalid request body", undefined, 400);
  }

  const { title, space, teamspace_id: teamspaceId, source, url, tags } = parsed.data;

  if (teamspaceId) {
    const teamspace = await prisma.teamspace.findFirst({
      where: { id: teamspaceId, tenantId: ctx.tenantId },
    });
    if (!teamspace) {
      return errorResponse("NOT_FOUND", "Teamspace not found", undefined, 404);
    }
  }

  let fetchable = false;
  let snapshot: string | undefined;
  if (source === "url" && url) {
    const scheme = validateUrlScheme(url);
    if (!scheme.ok) {
      return errorResponse(
        "VALIDATION_ERROR",
        scheme.reason ?? "Invalid URL",
        undefined,
        400
      );
    }
    const result = await fetchUrlSnapshot(url);
    fetchable = result.fetchable;
    snapshot = result.snapshot;
  }

  const template = renderDocumentTemplate({
    title,
    source,
    sourceDetail: source === "upload" ? title : (url ?? ""),
    addedBy: ctx.userId,
    tags,
    snapshot,
  });
  const tiptap = markdownToTiptap(template) as TipTapDocument;

  const maxPosition = await prisma.page.aggregate({
    where: {
      tenantId: ctx.tenantId,
      parentId: null,
      teamspaceId: teamspaceId ?? null,
    },
    _max: { position: true },
  });

  const page = await prisma.page.create({
    data: {
      tenantId: ctx.tenantId,
      title,
      kind: "DOCUMENT",
      spaceType: space === "team" ? "TEAM" : "PRIVATE",
      teamspaceId: teamspaceId ?? null,
      position: (maxPosition._max.position ?? -1) + 1,
      sourceUrl: source === "url" ? url : null,
      docSource: source,
      properties:
        source === "url"
          ? ({ document: { fetchable } } as Prisma.InputJsonValue)
          : undefined,
    },
  });

  await prisma.block.create({
    data: {
      tenantId: ctx.tenantId,
      pageId: page.id,
      type: "DOCUMENT",
      content: tiptap as unknown as Prisma.InputJsonValue,
      position: 0,
      plainText: extractPlainText(tiptap),
    },
  });

  return successResponse(
    {
      id: page.id,
      title: page.title,
      kind: "document",
      source,
      source_url: page.sourceUrl,
      fetchable: source === "url" ? fetchable : undefined,
      created_at: page.createdAt.toISOString(),
    },
    undefined,
    201
  );
});
