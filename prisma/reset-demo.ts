/**
 * Tenant-wide demo reset (DESTRUCTIVE — manual only).
 *
 * Wipes ALL pages, blocks, page links, embedded databases, db rows, and
 * teamspaces in the Default Workspace tenant — including any user-created
 * content. Useful for "I want a clean slate before reseeding" moments.
 *
 * NOT invoked by the docker entrypoint. Run via:
 *   npm run reset-demo
 * or:
 *   docker exec symbioknowledgebase-app-1 sh -c 'cd /app && npx tsx prisma/reset-demo.ts'
 *
 * After running, follow up with the regular seed to repopulate:
 *   docker exec symbioknowledgebase-app-1 sh -c 'cd /app && npx tsx prisma/seed-demo.ts'
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const TENANT_ID = "00000000-0000-4000-a000-000000000001";

async function main() {
  console.log("DESTRUCTIVE: wiping ALL content for tenant", TENANT_ID);

  // Reclaim Tenant.storageUsed from any FileAttachments before deleting.
  const files = await prisma.fileAttachment.findMany({
    where: { tenantId: TENANT_ID },
    select: { fileSize: true },
  });
  const reclaimed = files.reduce(
    (acc, f) => acc + (typeof f.fileSize === "bigint" ? f.fileSize : BigInt(f.fileSize ?? 0)),
    0n,
  );
  if (reclaimed > 0n) {
    await prisma.tenant.update({
      where: { id: TENANT_ID },
      data: { storageUsed: { decrement: reclaimed } },
    });
    console.log(`  Reclaimed ${reclaimed} bytes from Tenant.storageUsed.`);
  }

  await prisma.$transaction([
    prisma.dbRow.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.database.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.pageLink.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.fileAttachment.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.notification.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.block.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.page.deleteMany({ where: { tenantId: TENANT_ID } }),
    prisma.teamspaceMember.deleteMany({ where: { teamspace: { tenantId: TENANT_ID } } }),
    prisma.teamspace.deleteMany({ where: { tenantId: TENANT_ID } }),
  ]);

  console.log("Done. Run `npx tsx prisma/seed-demo.ts` to repopulate.");
}

main()
  .catch((e) => {
    console.error("Reset error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
