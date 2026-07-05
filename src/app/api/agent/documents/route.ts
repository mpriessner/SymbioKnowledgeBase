import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { logAgentAction } from "@/lib/agent/audit";
import { markdownToTiptap } from "@/lib/agent/markdown";
import { extractPlainText } from "@/lib/search/indexer";
import { generatePagePath } from "@/lib/agent/pageTree";
import { renderDocumentTemplate } from "@/lib/chemistryKb/documentTemplate";
import { validateUrlScheme, fetchUrlSnapshot } from "@/lib/documents/urlSnapshot";
import type { TipTapDocument } from "@/lib/wikilinks/types";
import type { Prisma } from "@/generated/prisma/client";
import { z } from "zod";

const createDocumentSchema = z
  .object({
    title: z.string().min(1).max(255),
    space: z.enum(["private", "team"]),
    teamspace_id: z.string().uuid().optional(),
    source: z.enum(["upload", "url"]),
    url: z.string().min(1).max(2048).optional(),
    tags: z.array(z.string().max(64)).max(20).optional(),
  })
  .refine((body) => body.space !== "team" || !!body.teamspace_id, {
    message: "teamspace_id is required when space is 'team'",
    path: ["teamspace_id"],
  })
  .refine((body) => body.source !== "url" || !!body.url, {
    message: "url is required when source is 'url'",
    path: ["url"],
  });

/**
 * POST /api/agent/documents — Create a document page (a71-08).
 *
 * Documents are ordinary `Page` rows discriminated by `kind='DOCUMENT'`, with
 * a standard body template. For `source: "url"`, a best-effort SSRF-guarded
 * snapshot is fetched (non-fatal on failure — the page still saves as
 * link-only). For `source: "upload"`, this call only creates the page shell;
 * the caller must follow up with `POST /api/agent/pages/:id/attachments` to
 * upload bytes and have the reference linked into the body (AC4).
 *
 * `teamspace_id`, when supplied, is verified to belong to the caller's
 * tenant before use — mirrors the parent-page tenant check in
 * `POST /api/agent/pages` (Round 2 finding 3 / AC8).
 *
 * The DOCUMENT block's `plainText` is populated at creation time so the page
 * is immediately findable via FTS (Round 2 finding 1 / AC5) — the existing
 * `POST /api/agent/pages` endpoint does not do this; this endpoint must not
 * repeat that gap.
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    try {
      const body = await req.json();
      const parsed = createDocumentSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const { title, space, teamspace_id, source, url, tags } = parsed.data;

      // Cross-tenant leak guard (AC8): a caller-supplied teamspace_id must
      // belong to ctx.tenantId, otherwise a document could be created
      // pointing at another tenant's teamspace.
      if (teamspace_id) {
        const teamspace = await prisma.teamspace.findFirst({
          where: { id: teamspace_id, tenantId: ctx.tenantId },
        });
        if (!teamspace) {
          return errorResponse(
            "NOT_FOUND",
            "Teamspace not found",
            undefined,
            404
          );
        }
      }

      let fetchable = false;
      let snapshot: string | undefined;

      if (source === "url" && url) {
        // Scheme allowlist gate (AC7): reject javascript:/file:/etc. at
        // creation time, before any network access is attempted.
        const scheme = validateUrlScheme(url);
        if (!scheme.ok) {
          return errorResponse(
            "VALIDATION_ERROR",
            scheme.reason ?? "Invalid URL",
            undefined,
            400
          );
        }

        // Resolved-IP SSRF gate + timeout + size cap live inside
        // fetchUrlSnapshot (AC7, AC9). Failure here is non-fatal — the
        // document still saves as a link-only page.
        const result = await fetchUrlSnapshot(url);
        fetchable = result.fetchable;
        snapshot = result.snapshot;
      }

      const docSource = source; // "upload" | "url" — "drive" is a71-12's addition
      const template = renderDocumentTemplate({
        title,
        source: docSource,
        sourceDetail: source === "upload" ? title : (url ?? ""),
        addedBy: ctx.userId,
        tags,
        snapshot,
      });

      const spaceType = space === "team" ? "TEAM" : "PRIVATE";

      const maxPosition = await prisma.page.aggregate({
        where: {
          tenantId: ctx.tenantId,
          parentId: null,
          teamspaceId: teamspace_id ?? null,
        },
        _max: { position: true },
      });
      const nextPosition = (maxPosition._max.position ?? -1) + 1;

      const page = await prisma.page.create({
        data: {
          tenantId: ctx.tenantId,
          title,
          kind: "DOCUMENT",
          spaceType,
          teamspaceId: teamspace_id ?? null,
          position: nextPosition,
          sourceUrl: source === "url" ? url : null,
          docSource,
          metadata:
            source === "url"
              ? ({ fetchable } as Prisma.InputJsonValue)
              : undefined,
        },
      });

      const tiptap = markdownToTiptap(template) as TipTapDocument;
      const plainText = extractPlainText(tiptap);

      await prisma.block.create({
        data: {
          tenantId: ctx.tenantId,
          pageId: page.id,
          type: "DOCUMENT",
          content: tiptap as unknown as Prisma.InputJsonValue,
          position: 0,
          plainText,
        },
      });

      await logAgentAction(ctx, "document.create", "page", page.id, {
        space,
        teamspaceId: teamspace_id ?? null,
        source,
        docSource,
        fetchable: source === "url" ? fetchable : undefined,
        tags: tags ?? [],
      });

      const pagesById = new Map<
        string,
        { title: string; parentId: string | null }
      >([[page.id, { title: page.title, parentId: page.parentId }]]);

      return successResponse(
        {
          id: page.id,
          title: page.title,
          kind: "document",
          space,
          teamspace_id: teamspace_id ?? null,
          path: generatePagePath(page.id, pagesById),
          source,
          source_url: page.sourceUrl,
          fetchable: source === "url" ? fetchable : undefined,
          created_at: page.createdAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/agent/documents error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
