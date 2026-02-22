import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid registration data",
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

    const { name, email, password } = parsed.data;
    const supabaseUserId = body.supabaseUserId as string | undefined;

    if (!supabaseUserId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "supabaseUserId is required — register via Supabase Auth first",
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 400 }
      );
    }

    // Check for existing user
    const existingUser = await prisma.user.findFirst({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: {
            code: "CONFLICT",
            message: "A user with this email already exists",
          },
          meta: { timestamp: new Date().toISOString() },
        },
        { status: 409 }
      );
    }

    // Hash password (kept for backward compat during migration)
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
          id: supabaseUserId,
          name,
          email,
          passwordHash,
          role: "USER",
          tenantId: tenant.id,
        },
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: tenant.id,
          createdAt: user.createdAt.toISOString(),
        },
      };
    });

    return NextResponse.json(
      {
        data: result.user,
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "An unexpected error occurred during registration",
        },
        meta: { timestamp: new Date().toISOString() },
      },
      { status: 500 }
    );
  }
}
