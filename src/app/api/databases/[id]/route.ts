import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { UpdateDatabaseSchema, DatabaseViewTypeSchema, ViewConfigSchema } from "@/types/database";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const dbIdSchema = z.string().uuid("Database ID must be a valid UUID");

/**
 * GET /api/databases/[id] — Get a single database with schema
 */
export const GET = withTenant(
  async (
    _req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid database ID", undefined, 400);
      }

      const database = await prisma.database.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
        include: {
          page: { select: { title: true, icon: true } },
        },
      });

      if (!database) {
        return errorResponse("NOT_FOUND", "Database not found", undefined, 404);
      }

      return successResponse({
        id: database.id,
        pageId: database.pageId,
        tenantId: database.tenantId,
        schema: database.schema,
        defaultView: database.defaultView,
        viewConfig: database.viewConfig,
        page: database.page,
        createdAt: database.createdAt.toISOString(),
        updatedAt: database.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("GET /api/databases/[id] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

/**
 * PUT /api/databases/[id] — Update database schema
 */
export const PUT = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid database ID", undefined, 400);
      }

      const body = await req.json();

      const parseResult = UpdateDatabaseSchema.safeParse(body);
      if (!parseResult.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          parseResult.error.issues[0]?.message ?? "Invalid request body",
          undefined,
          400
        );
      }

      // Verify the database exists and belongs to this tenant
      const existing = await prisma.database.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
      });
      if (!existing) {
        return errorResponse("NOT_FOUND", "Database not found", undefined, 404);
      }

      const updateData: Record<string, unknown> = {};
      if (parseResult.data.schema) {
        updateData.schema = JSON.parse(JSON.stringify(parseResult.data.schema));
      }
      if (parseResult.data.defaultView) {
        updateData.defaultView = parseResult.data.defaultView;
      }
      if (parseResult.data.viewConfig !== undefined) {
        updateData.viewConfig = parseResult.data.viewConfig
          ? JSON.parse(JSON.stringify(parseResult.data.viewConfig))
          : null;
      }

      const updated = await prisma.database.update({
        where: { id: idParsed.data },
        data: updateData,
      });

      return successResponse({
        id: updated.id,
        pageId: updated.pageId,
        tenantId: updated.tenantId,
        schema: updated.schema,
        defaultView: updated.defaultView,
        viewConfig: updated.viewConfig,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PUT /api/databases/[id] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

/**
 * PATCH validation schema
 */
const PatchDatabaseSchema = z.object({
  defaultView: DatabaseViewTypeSchema.optional(),
  viewConfig: ViewConfigSchema,
});

/**
 * PATCH /api/databases/[id] — Update view config (defaultView, viewConfig)
 */
export const PATCH = withTenant(
  async (
    req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid database ID", undefined, 400);
      }

      const body = await req.json();
      const parseResult = PatchDatabaseSchema.safeParse(body);
      if (!parseResult.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          parseResult.error.issues[0]?.message ?? "Invalid request body",
          undefined,
          400
        );
      }

      const existing = await prisma.database.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
      });
      if (!existing) {
        return errorResponse("NOT_FOUND", "Database not found", undefined, 404);
      }

      const updateData: Record<string, unknown> = {};
      if (parseResult.data.defaultView) {
        updateData.defaultView = parseResult.data.defaultView;
      }
      if (parseResult.data.viewConfig !== undefined) {
        updateData.viewConfig = parseResult.data.viewConfig
          ? JSON.parse(JSON.stringify(parseResult.data.viewConfig))
          : null;
      }

      const updated = await prisma.database.update({
        where: { id: idParsed.data },
        data: updateData,
      });

      return successResponse({
        id: updated.id,
        pageId: updated.pageId,
        tenantId: updated.tenantId,
        schema: updated.schema,
        defaultView: updated.defaultView,
        viewConfig: updated.viewConfig,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("PATCH /api/databases/[id] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

/**
 * DELETE /api/databases/[id] — Delete database and all rows
 */
export const DELETE = withTenant(
  async (
    _req: NextRequest,
    context: TenantContext,
    { params }
  ) => {
    try {
      const { id } = await params;
      const idParsed = dbIdSchema.safeParse(id);
      if (!idParsed.success) {
        return errorResponse("VALIDATION_ERROR", "Invalid database ID", undefined, 400);
      }

      const database = await prisma.database.findFirst({
        where: { id: idParsed.data, tenantId: context.tenantId },
      });

      if (!database) {
        return errorResponse("NOT_FOUND", "Database not found", undefined, 404);
      }

      // Delete database (cascade deletes rows)
      await prisma.database.delete({ where: { id: idParsed.data } });

      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("DELETE /api/databases/[id] error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
