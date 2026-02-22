import { prisma } from "@/lib/db";
import type { User } from "@supabase/supabase-js";

/**
 * Ensure a Supabase Auth user has a corresponding record in the Prisma database.
 *
 * When cross-app SSO is enabled, a user may authenticate via another Symbio app
 * (e.g. ExpTube) and not yet have a User row in SymbioKnowledgeBase's database.
 * This function checks for the user and creates them with a default tenant if needed.
 */
export async function ensureUserExists(supabaseUser: User) {
  const existing = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    select: { id: true, tenantId: true, role: true },
  });

  if (existing) {
    return existing;
  }

  // User authenticated via another Symbio app — create record with default tenant
  const tenantId =
    supabaseUser.user_metadata?.tenantId ?? (await createDefaultTenant(supabaseUser));

  const user = await prisma.user.create({
    data: {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      tenantId,
      name: supabaseUser.user_metadata?.name ?? null,
    },
    select: { id: true, tenantId: true, role: true },
  });

  console.log(`[SSO] Created user ${supabaseUser.email} from cross-app login`);
  return user;
}

async function createDefaultTenant(supabaseUser: User): Promise<string> {
  const name = supabaseUser.user_metadata?.name || supabaseUser.email || "User";
  const tenant = await prisma.tenant.create({
    data: { name: `${name}'s Workspace` },
  });
  return tenant.id;
}
