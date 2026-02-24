import "dotenv/config";
import { PrismaClient, Role, BlockType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // 1. Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-4000-a000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000001",
      name: "Default Workspace",
    },
  });
  console.log(`  Tenant: ${tenant.name} (${tenant.id})`);

  // 2. Create admin user
  const passwordHash = await hash("changeme", 10);
  const admin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "admin@symbio.local",
      },
    },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000002",
      tenantId: tenant.id,
      email: "admin@symbio.local",
      passwordHash: passwordHash,
      role: Role.ADMIN,
      name: "Admin",
    },
  });
  console.log(`  Admin user: ${admin.email} (${admin.id})`);

  // 3. Create Welcome page
  const welcomePage = await prisma.page.upsert({
    where: { id: "00000000-0000-4000-a000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000010",
      tenantId: tenant.id,
      title: "Welcome to SymbioKnowledgeBase",
      icon: "\u{1F44B}",
      position: 0,
    },
  });
  console.log(`  Welcome page: ${welcomePage.title} (${welcomePage.id})`);

  // 4. Create welcome blocks
  await prisma.block.upsert({
    where: { id: "00000000-0000-4000-a000-000000000100" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000100",
      pageId: welcomePage.id,
      tenantId: tenant.id,
      type: BlockType.HEADING_1,
      content: {
        text: "Welcome to SymbioKnowledgeBase",
      },
      position: 0,
    },
  });

  await prisma.block.upsert({
    where: { id: "00000000-0000-4000-a000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000101",
      pageId: welcomePage.id,
      tenantId: tenant.id,
      type: BlockType.PARAGRAPH,
      content: {
        text: "This is your AI-agent-first knowledge management platform. Start creating pages, linking ideas with [[wikilinks]], and let your AI agents populate your knowledge base through the REST API.",
      },
      position: 1,
    },
  });

  await prisma.block.upsert({
    where: { id: "00000000-0000-4000-a000-000000000102" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000102",
      pageId: welcomePage.id,
      tenantId: tenant.id,
      type: BlockType.HEADING_2,
      content: {
        text: "Getting Started",
      },
      position: 2,
    },
  });

  await prisma.block.upsert({
    where: { id: "00000000-0000-4000-a000-000000000103" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000103",
      pageId: welcomePage.id,
      tenantId: tenant.id,
      type: BlockType.TODO,
      content: {
        text: "Create your first page",
        checked: false,
      },
      position: 3,
    },
  });

  await prisma.block.upsert({
    where: { id: "00000000-0000-4000-a000-000000000104" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000104",
      pageId: welcomePage.id,
      tenantId: tenant.id,
      type: BlockType.TODO,
      content: {
        text: "Generate an API key in Settings",
        checked: false,
      },
      position: 4,
    },
  });

  await prisma.block.upsert({
    where: { id: "00000000-0000-4000-a000-000000000105" },
    update: {},
    create: {
      id: "00000000-0000-4000-a000-000000000105",
      pageId: welcomePage.id,
      tenantId: tenant.id,
      type: BlockType.TODO,
      content: {
        text: "Connect your AI agent to the REST API",
        checked: false,
      },
      position: 5,
    },
  });

  console.log("  Welcome page blocks created (6 blocks)");

  console.log("Seeding complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
