import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import {
  successResponse,
  listResponse,
  errorResponse,
} from "@/lib/apiResponse";
import { CreateRowSchema } from "@/types/database";
import type { DatabaseSchema } from "@/types/database";
import {
  validateProperties,
  extractTitleFromProperties,
} from "@/lib/database/propertyValidators";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});

type RouteContext = { params: Promise<Record<string, string>> };

/**
 * GET /api/agent/databases/:id/rows — List rows with optional sorting
 */
export const GET = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;

      if (!z.string().uuid().safeParse(id).success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid database ID",
          undefined,
          400
        );
      }

      // Validate database exists
      const database = await prisma.database.findFirst({
        where: { id, tenantId: ctx.tenantId },
        select: { id: true },
      });

      if (!database) {
        return errorResponse(
          "NOT_FOUND",
          "Database not found",
          undefined,
          404
        );
      }

      // Parse query params
      const { searchParams } = new URL(req.url);
      const queryParams = Object.fromEntries(searchParams.entries());
      const parsed = querySchema.safeParse(queryParams);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid query parameters",
          undefined,
          400
        );
      }

      const { limit, offset } = parsed.data;

      // Query rows
      const [rows, total] = await Promise.all([
        prisma.dbRow.findMany({
          where: { databaseId: id, tenantId: ctx.tenantId },
          include: {
            page: { select: { id: true, title: true, icon: true } },
          },
          orderBy: { createdAt: "asc" },
          skip: offset,
          take: limit,
        }),
        prisma.dbRow.count({
          where: { databaseId: id, tenantId: ctx.tenantId },
        }),
      ]);

      const data = rows.map((row) => ({
        id: row.id,
        properties: row.properties,
        page_id: row.pageId,
        created_at: row.createdAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
      }));

      return listResponse(data, total, limit, offset);
    } catch (error) {
      console.error("GET /api/agent/databases/:id/rows error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);

/**
 * POST /api/agent/databases/:id/rows — Create a new row
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext, routeContext: RouteContext) => {
    try {
      const { id } = await routeContext.params;

      if (!z.string().uuid().safeParse(id).success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid database ID",
          undefined,
          400
        );
      }

      const body = await req.json();
      const parseResult = CreateRowSchema.safeParse(body);

      if (!parseResult.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          parseResult.error.issues[0]?.message ?? "Invalid request body",
          undefined,
          400
        );
      }

      // Fetch database and validate ownership
      const database = await prisma.database.findFirst({
        where: { id, tenantId: ctx.tenantId },
      });

      if (!database) {
        return errorResponse(
          "NOT_FOUND",
          "Database not found",
          undefined,
          404
        );
      }

      const schema = database.schema as unknown as DatabaseSchema;

      // Validate properties against schema
      const validation = validateProperties(
        parseResult.data.properties,
        schema.columns
      );
      if (!validation.valid) {
        return errorResponse(
          "VALIDATION_ERROR",
          validation.errors.join("; "),
          undefined,
          400
        );
      }

      // Extract title for auto-created page
      const pageTitle = extractTitleFromProperties(
        parseResult.data.properties,
        schema.columns
      );

      // Create page and row in a transaction
      const result = await prisma.$transaction(async (tx) => {
        const page = await tx.page.create({
          data: {
            title: pageTitle,
            tenantId: ctx.tenantId,
          },
        });

        const row = await tx.dbRow.create({
          data: {
            databaseId: id,
            pageId: page.id,
            tenantId: ctx.tenantId,
            properties: JSON.parse(
              JSON.stringify(parseResult.data.properties)
            ),
          },
        });

        return { row, page };
      });

      return successResponse(
        {
          id: result.row.id,
          properties: result.row.properties,
          page_id: result.row.pageId,
          created_at: result.row.createdAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/agent/databases/:id/rows error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
