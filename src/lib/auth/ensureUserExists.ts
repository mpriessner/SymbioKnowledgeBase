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

  // Resolve tenant: metadata > DEFAULT_TENANT_ID env > create new workspace
  const tenantId =
    supabaseUser.user_metadata?.tenantId
    ?? await resolveDefaultTenant()
    ?? await createPersonalTenant(supabaseUser);

  const user = await prisma.user.create({
    data: {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      tenantId,
      role: "ADMIN",
      name:
        supabaseUser.user_metadata?.full_name
        ?? supabaseUser.user_metadata?.name
        ?? null,
    },
    select: { id: true, tenantId: true, role: true },
  });

  // Also create a TenantMember record so workspace-switching works
  await prisma.tenantMember.upsert({
    where: {
      userId_tenantId: { userId: supabaseUser.id, tenantId },
    },
    update: {},
    create: {
      userId: supabaseUser.id,
      tenantId,
      role: "owner",
    },
  });

  console.log(
    `[Auth] Created user ${supabaseUser.email} in tenant ${tenantId}`
  );
  return user;
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
