import "dotenv/config";
import { PrismaClient, Role, BlockType } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

afterAll(async () => {
  await prisma.$disconnect();
});

describe("Database Schema Validation", () => {
  test("all tables exist and are queryable", async () => {
    // These queries will throw if tables don't exist
    await expect(prisma.tenant.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.user.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.page.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.block.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.pageLink.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.apiKey.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.database.count()).resolves.toBeGreaterThanOrEqual(0);
    await expect(prisma.dbRow.count()).resolves.toBeGreaterThanOrEqual(0);
  });

  test("Role enum has ADMIN and USER values", () => {
    expect(Role.ADMIN).toBe("ADMIN");
    expect(Role.USER).toBe("USER");
  });

  test("BlockType enum has all expected values", () => {
    expect(BlockType.PARAGRAPH).toBe("PARAGRAPH");
    expect(BlockType.HEADING_1).toBe("HEADING_1");
    expect(BlockType.HEADING_2).toBe("HEADING_2");
    expect(BlockType.HEADING_3).toBe("HEADING_3");
    expect(BlockType.CODE).toBe("CODE");
    expect(BlockType.TODO).toBe("TODO");
    expect(BlockType.IMAGE).toBe("IMAGE");
    expect(BlockType.QUOTE).toBe("QUOTE");
    expect(BlockType.CALLOUT).toBe("CALLOUT");
    expect(BlockType.DIVIDER).toBe("DIVIDER");
    expect(BlockType.TABLE).toBe("TABLE");
  });
});

describe("Seed Data Validation", () => {
  test("default tenant exists", async () => {
    const tenant = await prisma.tenant.findUnique({
      where: { id: "00000000-0000-0000-0000-000000000001" },
    });
    expect(tenant).not.toBeNull();
    expect(tenant?.name).toBe("Default Workspace");
  });

  test("admin user exists with correct email and role", async () => {
    const admin = await prisma.user.findFirst({
      where: {
        tenantId: "00000000-0000-0000-0000-000000000001",
        email: "admin@symbio.local",
      },
    });
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe(Role.ADMIN);
    expect(admin?.name).toBe("Admin");
    expect(admin?.passwordHash).toBeTruthy();
  });

  test("welcome page exists with correct title", async () => {
    const page = await prisma.page.findUnique({
      where: { id: "00000000-0000-0000-0000-000000000010" },
    });
    expect(page).not.toBeNull();
    expect(page?.title).toBe("Welcome to SymbioKnowledgeBase");
    expect(page?.tenantId).toBe("00000000-0000-0000-0000-000000000001");
    expect(page?.icon).toBe("\u{1F44B}");
  });

  test("welcome page has blocks with various types", async () => {
    const blocks = await prisma.block.findMany({
      where: {
        pageId: "00000000-0000-0000-0000-000000000010",
        tenantId: "00000000-0000-0000-0000-000000000001",
      },
      orderBy: { position: "asc" },
    });
    expect(blocks.length).toBe(6);
    expect(blocks[0].type).toBe(BlockType.HEADING_1);
    expect(blocks[1].type).toBe(BlockType.PARAGRAPH);
    expect(blocks[2].type).toBe(BlockType.HEADING_2);
    expect(blocks[3].type).toBe(BlockType.TODO);
    expect(blocks[4].type).toBe(BlockType.TODO);
    expect(blocks[5].type).toBe(BlockType.TODO);
  });
});

describe("Tenant Isolation", () => {
  test("user has tenantId and it matches tenant", async () => {
    const admin = await prisma.user.findFirst({
      where: { email: "admin@symbio.local" },
      include: { tenant: true },
    });
    expect(admin?.tenantId).toBe(admin?.tenant.id);
  });

  test("page has tenantId matching the default tenant", async () => {
    const page = await prisma.page.findFirst({
      where: { tenantId: "00000000-0000-0000-0000-000000000001" },
    });
    expect(page).not.toBeNull();
    expect(page?.tenantId).toBe("00000000-0000-0000-0000-000000000001");
  });

  test("unique constraint prevents duplicate email within same tenant", async () => {
    await expect(
      prisma.user.create({
        data: {
          tenantId: "00000000-0000-0000-0000-000000000001",
          email: "admin@symbio.local",
          passwordHash: "duplicate",
          role: Role.USER,
        },
      })
    ).rejects.toThrow();
  });
});

describe("Relationship Integrity", () => {
  test("page self-referential hierarchy works", async () => {
    // Create a child page under the welcome page
    const childPage = await prisma.page.create({
      data: {
        tenantId: "00000000-0000-0000-0000-000000000001",
        parentId: "00000000-0000-0000-0000-000000000010",
        title: "Test Child Page",
        position: 1,
      },
    });

    const parent = await prisma.page.findUnique({
      where: { id: "00000000-0000-0000-0000-000000000010" },
      include: { children: true },
    });

    expect(parent?.children.some((c) => c.id === childPage.id)).toBe(true);

    // Clean up
    await prisma.page.delete({ where: { id: childPage.id } });
  });

  test("blocks cascade delete with page", async () => {
    // Create a temporary page with a block
    const tempPage = await prisma.page.create({
      data: {
        tenantId: "00000000-0000-0000-0000-000000000001",
        title: "Temp Page for Cascade Test",
      },
    });
    await prisma.block.create({
      data: {
        pageId: tempPage.id,
        tenantId: "00000000-0000-0000-0000-000000000001",
        type: BlockType.PARAGRAPH,
        content: { text: "This will be cascade deleted" },
      },
    });

    // Delete the page — blocks should cascade
    await prisma.page.delete({ where: { id: tempPage.id } });

    const orphanedBlocks = await prisma.block.findMany({
      where: { pageId: tempPage.id },
    });
    expect(orphanedBlocks.length).toBe(0);
  });

  test("JSONB content stores and retrieves correctly", async () => {
    const complexContent = {
      text: "Hello world",
      marks: [{ type: "bold" }, { type: "italic" }],
      attrs: { level: 1 },
    };

    const block = await prisma.block.create({
      data: {
        pageId: "00000000-0000-0000-0000-000000000010",
        tenantId: "00000000-0000-0000-0000-000000000001",
        type: BlockType.HEADING_1,
        content: complexContent,
      },
    });

    const retrieved = await prisma.block.findUnique({
      where: { id: block.id },
    });
    expect(retrieved?.content).toEqual(complexContent);

    // Clean up
    await prisma.block.delete({ where: { id: block.id } });
  });
});
