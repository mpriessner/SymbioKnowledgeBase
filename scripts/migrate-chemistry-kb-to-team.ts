#!/usr/bin/env tsx
/**
 * Migrate Chemistry KB from Private space to a Team space.
 *
 * This script:
 * 1. Creates (or finds) a "Chemistry KB" teamspace
 * 2. Adds the first admin user as OWNER
 * 3. Adds all tenant users as MEMBERs
 * 4. Moves the Chemistry KB root page and all descendants to TEAM space
 *
 * Usage:
 *   npx tsx scripts/migrate-chemistry-kb-to-team.ts --tenant <id>
 *   npx tsx scripts/migrate-chemistry-kb-to-team.ts --tenant <id> --dry-run
 *
 * Idempotent: running twice produces the same result.
 */

import { PrismaClient } from "../src/generated/prisma";
import "dotenv/config";

const prisma = new PrismaClient();

const TEAMSPACE_NAME = "Chemistry KB";
const CHEMISTRY_KB_ROOT_TITLE = "Chemistry KB";

async function getAllDescendantIds(
  rootId: string,
  tenantId: string
): Promise<string[]> {
  const descendants: string[] = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const children = await prisma.page.findMany({
      where: { tenantId, parentId },
      select: { id: true },
    });
    for (const child of children) {
      descendants.push(child.id);
      queue.push(child.id);
    }
  }

  return descendants;
}

async function main() {
  const args = process.argv.slice(2);
  let tenantId = process.env.TENANT_ID || "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--tenant":
        tenantId = args[++i] || "";
        break;
      case "--dry-run":
        dryRun = true;
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (!tenantId) {
    console.error("Error: tenantId is required.");
    console.error(
      "Usage: npx tsx scripts/migrate-chemistry-kb-to-team.ts --tenant <id>"
    );
    process.exit(1);
  }

  console.log(
    `\n=== Migrating Chemistry KB to Team Space for tenant: ${tenantId} ===`
  );
  if (dryRun) console.log("(DRY RUN — no changes will be made)\n");

  // 1. Find Chemistry KB root page
  const root = await prisma.page.findFirst({
    where: { tenantId, title: CHEMISTRY_KB_ROOT_TITLE, parentId: null },
    select: { id: true, title: true, spaceType: true, teamspaceId: true },
  });

  if (!root) {
    console.error(
      `Error: Chemistry KB root page "${CHEMISTRY_KB_ROOT_TITLE}" not found for tenant ${tenantId}.`
    );
    console.error("Run the seed script first: npx tsx scripts/seed-chemistry-kb.ts --tenant <id>");
    process.exit(1);
  }

  if (root.spaceType === "TEAM" && root.teamspaceId) {
    console.log(`Chemistry KB is already in TEAM space (teamspace: ${root.teamspaceId}). Nothing to do.`);
    process.exit(0);
  }

  // 2. Get all descendant page IDs
  const descendantIds = await getAllDescendantIds(root.id, tenantId);
  const allPageIds = [root.id, ...descendantIds];
  console.log(`Found ${allPageIds.length} pages to migrate (root + ${descendantIds.length} descendants)`);

  // 3. Find or create teamspace
  let teamspace = await prisma.teamspace.findFirst({
    where: { tenantId, name: TEAMSPACE_NAME },
  });

  if (teamspace) {
    console.log(`Teamspace "${TEAMSPACE_NAME}" already exists: ${teamspace.id}`);
  } else {
    console.log(`Creating teamspace "${TEAMSPACE_NAME}"...`);
    if (!dryRun) {
      teamspace = await prisma.teamspace.create({
        data: {
          tenantId,
          name: TEAMSPACE_NAME,
          slug: "chemistry-kb",
          description:
            "Institutional chemistry knowledge — experiments, best practices, and procedures",
          icon: "\u{1F4DA}",
        },
      });
      console.log(`  Created teamspace: ${teamspace.id}`);
    } else {
      console.log("  (skipped — dry run)");
    }
  }

  // 4. Add users as members
  if (teamspace && !dryRun) {
    const users = await prisma.user.findMany({
      where: { tenantId, deactivatedAt: null },
      select: { id: true, role: true, email: true },
    });

    for (const user of users) {
      const existingMember = await prisma.teamspaceMember.findUnique({
        where: {
          teamspaceId_userId: {
            teamspaceId: teamspace.id,
            userId: user.id,
          },
        },
      });

      if (!existingMember) {
        const role = user.role === "ADMIN" ? "ADMIN" : "MEMBER";
        await prisma.teamspaceMember.create({
          data: {
            teamspaceId: teamspace.id,
            userId: user.id,
            role,
          },
        });
        console.log(`  Added ${user.email} as ${role}`);
      } else {
        console.log(`  ${user.email} already a member (${existingMember.role})`);
      }
    }
  } else if (dryRun) {
    const users = await prisma.user.findMany({
      where: { tenantId, deactivatedAt: null },
      select: { email: true, role: true },
    });
    console.log(`Would add ${users.length} users as members:`);
    for (const u of users) {
      console.log(`  ${u.email} → ${u.role === "ADMIN" ? "ADMIN" : "MEMBER"}`);
    }
  }

  // 5. Migrate pages
  if (!dryRun && teamspace) {
    console.log(`\nMigrating ${allPageIds.length} pages to TEAM space...`);
    const result = await prisma.page.updateMany({
      where: { id: { in: allPageIds } },
      data: {
        spaceType: "TEAM",
        teamspaceId: teamspace.id,
      },
    });
    console.log(`  Updated ${result.count} pages`);
  } else {
    console.log(`\nWould migrate ${allPageIds.length} pages:`);
    const pages = await prisma.page.findMany({
      where: { id: { in: allPageIds } },
      select: { title: true, spaceType: true },
      orderBy: { position: "asc" },
    });
    for (const p of pages) {
      console.log(`  ${p.title}: ${p.spaceType} → TEAM`);
    }
  }

  // Summary
  console.log(`\n=== ${dryRun ? "Dry run complete" : "Migration complete"} ===`);
  console.log(`Pages: ${allPageIds.length}`);
  console.log(`Teamspace: ${TEAMSPACE_NAME}`);
  if (!dryRun) {
    console.log(
      "Chemistry KB now appears in the Team section of the sidebar."
    );
  }

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("Migration failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
