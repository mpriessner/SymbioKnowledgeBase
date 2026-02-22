import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { successResponse, errorResponse } from "@/lib/apiResponse";
import { prisma } from "@/lib/db";
import type { TenantContext } from "@/types/auth";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";

const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(["read", "write"])).min(1),
});

/**
 * POST /api/settings/api-keys — Generate a new API key
 */
export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    try {
      const body = await req.json();
      const parsed = createKeySchema.safeParse(body);

      if (!parsed.success) {
        return errorResponse(
          "VALIDATION_ERROR",
          "Invalid request body",
          undefined,
          400
        );
      }

      const { name, scopes } = parsed.data;

      // Generate API key: skb_live_ + 32 hex chars
      const key = `skb_live_${randomBytes(16).toString("hex")}`;
      const keyHash = await bcrypt.hash(key, 10);
      const keyPrefix = key.substring(0, 15);

      const apiKey = await prisma.apiKey.create({
        data: {
          userId: ctx.userId,
          tenantId: ctx.tenantId,
          keyHash,
          keyPrefix,
          name,
          scopes,
        },
      });

      // Return key ONCE (never stored in plaintext)
      return successResponse(
        {
          id: apiKey.id,
          key,
          keyPrefix,
          name,
          scopes,
          created_at: apiKey.createdAt.toISOString(),
        },
        undefined,
        201
      );
    } catch (error) {
      console.error("POST /api/settings/api-keys error:", error);
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
 * GET /api/settings/api-keys — List all API keys for the tenant
 */
export const GET = withTenant(
  async (_req: NextRequest, ctx: TenantContext) => {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { tenantId: ctx.tenantId, userId: ctx.userId, revokedAt: null },
        select: {
          id: true,
          name: true,
          keyPrefix: true,
          scopes: true,
          createdAt: true,
          lastUsedAt: true,
        },
        orderBy: { createdAt: "desc" },
      });

      return successResponse(
        keys.map((k) => ({
          id: k.id,
          name: k.name,
          key_prefix: k.keyPrefix,
          scopes: k.scopes,
          created_at: k.createdAt.toISOString(),
          last_used_at: k.lastUsedAt?.toISOString() ?? null,
        }))
      );
    } catch (error) {
      console.error("GET /api/settings/api-keys error:", error);
      return errorResponse(
        "INTERNAL_ERROR",
        "Internal server error",
        undefined,
        500
      );
    }
  }
);
