import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withTenant } from "@/lib/auth/withTenant";
import { generateApiKey } from "@/lib/apiAuth";
import { createApiKeySchema } from "@/lib/validation/apiKeys";
import type { TenantContext } from "@/types/auth";

// GET /api/keys — List all API keys for the authenticated user
export const GET = withTenant(
  async (_req: NextRequest, ctx: TenantContext) => {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedKeys = apiKeys.map((key) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      createdAt: key.createdAt.toISOString(),
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      revokedAt: key.revokedAt?.toISOString() || null,
      isRevoked: key.revokedAt !== null,
    }));

    return NextResponse.json({
      data: formattedKeys,
      meta: {
        total: formattedKeys.length,
        timestamp: new Date().toISOString(),
      },
    });
  }
);

// POST /api/keys — Generate a new API key
export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    const body = await req.json();

    const parsed = createApiKeySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid API key data",
            details: parsed.error.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    const { name } = parsed.data;
    const { rawKey, keyHash } = generateApiKey();

    // Store last 4 characters of the raw key for display purposes
    const keyPrefix = `...${rawKey.slice(-4)}`;

    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        keyHash,
        keyPrefix,
        userId: ctx.userId,
        tenantId: ctx.tenantId,
      },
    });

    // Return the raw key ONCE — it will never be shown again
    return NextResponse.json(
      {
        data: {
          id: apiKey.id,
          name: apiKey.name,
          key: rawKey, // One-time display only
          keyPrefix: apiKey.keyPrefix,
          createdAt: apiKey.createdAt.toISOString(),
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  }
);
