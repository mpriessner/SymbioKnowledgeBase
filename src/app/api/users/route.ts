import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { withAdmin } from "@/lib/auth/withAdmin";
import { createUserSchema } from "@/lib/validation/users";
import { successResponse, listResponse, errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";

interface SafeUserResponse {
  id: string;
  name: string | null;
  email: string;
  role: string;
  tenantId: string;
  createdAt: string;
  isDeactivated: boolean;
  deactivatedAt: string | null;
}

function serializeUser(user: {
  id: string;
  name: string | null;
  email: string;
  role: string;
  tenantId: string;
  createdAt: Date;
  deactivatedAt: Date | null;
}): SafeUserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    createdAt: user.createdAt.toISOString(),
    isDeactivated: user.deactivatedAt !== null,
    deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
  };
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  tenantId: true,
  createdAt: true,
  deactivatedAt: true,
} as const;

// GET /api/users — List all users (admin only)
// Supports optional ?email= filter for user lookup
export const GET = withAdmin(
  async (req: NextRequest, ctx: TenantContext) => {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const emailFilter = searchParams.get("email");

    const where = {
      tenantId: ctx.tenantId,
      ...(emailFilter ? { email: emailFilter } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    return listResponse(users.map(serializeUser), total, limit, offset);
  }
);

// POST /api/users — Create a new user with a new tenant (admin only)
export const POST = withAdmin(
  async (req: NextRequest, _ctx: TenantContext) => {
    const body = await req.json();

    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Invalid user data",
        parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
        400
      );
    }

    const { name, email, password, role } = parsed.data;

    // Check for existing user with this email (composite unique, use findFirst)
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return errorResponse(
        "CONFLICT",
        "A user with this email already exists",
        undefined,
        409
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `${name}'s Workspace`,
        },
      });

      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          name,
          email,
          passwordHash,
          role,
          tenantId: tenant.id,
        },
        select: userSelect,
      });

      return user;
    });

    return successResponse(serializeUser(result), undefined, 201);
  }
);
