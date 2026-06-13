import { prisma } from "@/lib/db";
import type { User } from "@supabase/supabase-js";

/**
 * Ensure a Supabase Auth user has a corresponding record in the Prisma database.
 *
 * When cross-app SSO is enabled, a user may authenticate via another Symbio app
 * (e.g. ExpTube) and not yet have a User row in SymbioKnowledgeBase's database.
 * This function checks for the user and creates them with a default tenant if needed.
 *
 * When DEFAULT_TENANT_ID is set (e.g. in dev), new users join that shared workspace
 * so they immediately see seeded demo data.
 */
export async function ensureUserExists(supabaseUser: User) {
  const existing = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, tenantId: true, role: true },
  });

  if (existing) {
    return existing;
  }

  // Resolve tenant placement (audit S4):
  //  - an explicit user_metadata.tenantId always wins;
  //  - otherwise, by default new users join the shared DEFAULT_TENANT_ID so the
  //    seeded chemistry KB + synced experiments + the voice agent's kb-query keep
  //    working for them (kb-query is tenant-scoped with NO cross-tenant
  //    read-through — a personal tenant would silo them into an empty KB);
  //  - personal-tenant-per-user is an OPT-IN multi-tenant posture behind
  //    SKB_PERSONAL_TENANT_BY_DEFAULT=1 (breaks shared-KB visibility for them).
  const personalTenantByDefault =
    process.env.SKB_PERSONAL_TENANT_BY_DEFAULT === "1";

  const metadataTenantId = supabaseUser.user_metadata?.tenantId as
    | string
    | undefined;

  let tenantId: string;
  let isTenantCreator = false;

  if (metadataTenantId) {
    tenantId = metadataTenantId;
  } else if (personalTenantByDefault) {
    // Opt-in isolation: the user owns their freshly-created personal tenant.
    tenantId = await createPersonalTenant(supabaseUser);
    isTenantCreator = true;
  } else {
    const defaultTenantId = await resolveDefaultTenant();
    if (defaultTenantId) {
      tenantId = defaultTenantId;
    } else {
      // No shared tenant exists yet — fall back to a personal one (creator).
      tenantId = await createPersonalTenant(supabaseUser);
      isTenantCreator = true;
    }
  }

  // Least-privilege (audit S4): a brand-new SSO user is provisioned as USER, NOT
  // ADMIN, and as a "member" of the shared tenant, NOT "owner". The only time a
  // new user is "owner" is when they just created their own personal tenant.
  // NOTE: Role enum is ADMIN | USER only — "MEMBER" does NOT exist; do not use it.
  const memberRole = isTenantCreator ? "owner" : "member";

  try {
    // Create the User row and its TenantMember atomically so a partial-failure
    // can't leave a user without a membership (Kimi hardening).
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: supabaseUser.id,
          email: supabaseUser.email!,
          tenantId,
          role: "USER",
          name:
            supabaseUser.user_metadata?.full_name
            ?? supabaseUser.user_metadata?.name
            ?? null,
        },
        select: { id: true, tenantId: true, role: true },
      });

      // Also create a TenantMember record so workspace-switching works.
      await tx.tenantMember.upsert({
        where: {
          userId_tenantId: { userId: supabaseUser.id, tenantId },
        },
        update: {},
        create: {
          userId: supabaseUser.id,
          tenantId,
          role: memberRole,
        },
      });

      return created;
    });

    console.log(
      `[Auth] Created user ${supabaseUser.email} in tenant ${tenantId} (role=USER, member=${memberRole})`
    );
    return user;
  } catch (error: unknown) {
    // Handle unique constraint violation on (tenant_id, email).
    // This occurs when the same email re-authenticates with a different
    // Supabase auth ID (e.g. different OAuth provider, or Supabase reset).
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      const existingByEmail = await prisma.user.findFirst({
        where: { email: supabaseUser.email! },
        select: { id: true, tenantId: true, role: true },
      });
      if (existingByEmail) {
        console.log(
          `[Auth] Found existing user by email ${supabaseUser.email} (auth ID mismatch, returning existing)`
        );
        return existingByEmail;
      }
    }
    throw error;
  }
}

/**
 * If DEFAULT_TENANT_ID is set and the tenant exists, return its id.
 */
async function resolveDefaultTenant(): Promise<string | null> {
  const envId = process.env.DEFAULT_TENANT_ID;
  if (!envId) return null;

  const tenant = await prisma.tenant.findUnique({ where: { id: envId } });
  return tenant ? tenant.id : null;
}

async function createPersonalTenant(supabaseUser: User): Promise<string> {
  const name = supabaseUser.user_metadata?.name || supabaseUser.email || "User";
  const tenant = await prisma.tenant.create({
    data: { name: `${name}'s Workspace` },
  });
  return tenant.id;
}
