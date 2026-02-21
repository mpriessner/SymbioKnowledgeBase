import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, listResponse, errorResponse } from "@/lib/apiResponse";
import { CreateDatabaseSchema } from "@/types/database";
import type { TenantContext } from "@/types/auth";

/**
 * POST /api/databases — Create a new database
 */
export const POST = withTenant(
  async (req: NextRequest, context: TenantContext) => {
    try {
      const body = await req.json();

      const parseResult = CreateDatabaseSchema.safeParse(body);
      if (!parseResult.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          parseResult.error.issues[0]?.message ?? "Invalid request body",
          undefined,
          400
        );
      }

      const { pageId, schema } = parseResult.data;

      // Verify the page exists and belongs to this tenant
      const page = await prisma.page.findFirst({
        where: { id: pageId, tenantId: context.tenantId },
      });

      if (!page) {
        return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
      }

      // Check if a database already exists for this page
      const existingDb = await prisma.database.findFirst({
        where: { pageId, tenantId: context.tenantId },
      });
      if (existingDb) {
        return errorResponse(
          "CONFLICT",
          "A database already exists for this page",
          undefined,
          409
        );
      }

      const database = await prisma.database.create({
        data: {
          pageId,
          tenantId: context.tenantId,
          schema: JSON.parse(JSON.stringify(schema)),
        },
      });

      return successResponse(
        {
          id: database.id,
          pageId: database.pageId,
          tenantId: database.tenantId,
          schema: database.schema,
          createdAt: database.createdAt.toISOString(),
          updatedAt: database.updatedAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/databases error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);

/**
 * GET /api/databases — List all databases for the tenant
 */
export const GET = withTenant(
  async (_req: NextRequest, context: TenantContext) => {
    try {
      const databases = await prisma.database.findMany({
        where: { tenantId: context.tenantId },
        include: {
          page: { select: { title: true, icon: true } },
          _count: { select: { rows: true } },
        },
        orderBy: { updatedAt: "desc" },
      });

      const serialized = databases.map((db) => ({
        id: db.id,
        pageId: db.pageId,
        tenantId: db.tenantId,
        schema: db.schema,
        page: db.page,
        rowCount: db._count.rows,
        createdAt: db.createdAt.toISOString(),
        updatedAt: db.updatedAt.toISOString(),
      }));

      return listResponse(
        serialized,
        serialized.length,
        serialized.length,
        0
      );
    } catch (error) {
      console.error("GET /api/databases error:", error);
      return errorResponse("INTERNAL_ERROR", "Internal server error", undefined, 500);
    }
  }
);
