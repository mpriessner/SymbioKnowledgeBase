import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import {
  readMirrorFile,
  writeMirrorFile,
  deleteMirrorFile,
} from "@/lib/sync/mirrorOps";

/**
 * GET /api/agent/mirror/:filepath — Read a file from the mirror.
 *
 * Returns the raw file content as text/markdown for .md files.
 */
export const GET = withAgentAuth(
  async (
    _req: NextRequest,
    ctx: AgentContext,
    routeContext: { params: Promise<Record<string, string | string[]>> }
  ) => {
    const params = await routeContext.params;
    const segments = params.filepath;
    const filePath = Array.isArray(segments) ? segments.join("/") : segments;

    if (!filePath) {
      return errorResponse(
        "VALIDATION_ERROR",
        "File path is required",
        undefined,
        400
      );
    }

    try {
      const content = await readMirrorFile(ctx.tenantId, filePath);

      if (content === null) {
        return errorResponse("NOT_FOUND", "File not found", undefined, 404);
      }

      // Return .md files as text/markdown, others as plain text
      const contentType = filePath.endsWith(".md")
        ? "text/markdown; charset=utf-8"
        : "text/plain; charset=utf-8";

      return new Response(content, {
        headers: { "Content-Type": contentType },
      });
    } catch (err) {
      if (err instanceof Error && err.message === "Path traversal detected") {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid file path",
          undefined,
          400
        );
      }
      throw err;
    }
  }
);

/**
 * PUT /api/agent/mirror/:filepath — Write/create a file in the mirror.
 *
 * Accepts raw text body. The file watcher will pick up changes and
 * sync them to the database.
 */
export const PUT = withAgentAuth(
  async (
    req: NextRequest,
    ctx: AgentContext,
    routeContext: { params: Promise<Record<string, string | string[]>> }
  ) => {
    const params = await routeContext.params;
    const segments = params.filepath;
    const filePath = Array.isArray(segments) ? segments.join("/") : segments;

    if (!filePath) {
      return errorResponse(
        "VALIDATION_ERROR",
        "File path is required",
        undefined,
        400
      );
    }

    const content = await req.text();
    if (!content) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Request body is required",
        undefined,
        400
      );
    }

    try {
      await writeMirrorFile(ctx.tenantId, filePath, content);
      return successResponse({ path: filePath, message: "File written" });
    } catch (err) {
      if (err instanceof Error && err.message === "Path traversal detected") {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid file path",
          undefined,
          400
        );
      }
      throw err;
    }
  }
);

/**
 * DELETE /api/agent/mirror/:filepath — Delete a file from the mirror.
 *
 * The file watcher will pick up the deletion and remove the page from DB.
 */
export const DELETE = withAgentAuth(
  async (
    _req: NextRequest,
    ctx: AgentContext,
    routeContext: { params: Promise<Record<string, string | string[]>> }
  ) => {
    const params = await routeContext.params;
    const segments = params.filepath;
    const filePath = Array.isArray(segments) ? segments.join("/") : segments;

    if (!filePath) {
      return errorResponse(
        "VALIDATION_ERROR",
        "File path is required",
        undefined,
        400
      );
    }

    try {
      const deleted = await deleteMirrorFile(ctx.tenantId, filePath);
      if (!deleted) {
        return errorResponse("NOT_FOUND", "File not found", undefined, 404);
      }
      return new Response(null, { status: 204 });
    } catch (err) {
      if (err instanceof Error && err.message === "Path traversal detected") {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid file path",
          undefined,
          400
        );
      }
      throw err;
    }
  }
);
