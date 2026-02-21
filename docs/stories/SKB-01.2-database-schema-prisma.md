# Story SKB-01.2: PostgreSQL Database Schema and Prisma Setup

**Epic:** Epic 1 - Project Foundation & Infrastructure
**Story ID:** SKB-01.2
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** SKB-01.1 (project must exist with Prisma dependencies installed)

---

## User Story

As a developer, I want the complete database schema defined in Prisma with all core tables and tenant isolation, So that all features can store and retrieve data consistently.

---

## Acceptance Criteria

- [ ] Prisma 7 initialized with PostgreSQL provider
- [ ] `schema.prisma` defines ALL core tables: `tenants`, `users`, `pages`, `blocks`, `page_links`, `api_keys`, `databases`, `db_rows`
- [ ] Every table has `tenant_id` column (except `tenants` table itself)
- [ ] Composite indexes on `(tenant_id, id)` for all tenant-scoped tables
- [ ] `pages` table: `id`, `tenant_id`, `parent_id` (self-ref), `title`, `icon`, `cover_url`, `position`, `created_at`, `updated_at`
- [ ] `blocks` table: `id`, `page_id`, `tenant_id`, `type` (enum), `content` (Json), `position`, `created_at`, `updated_at`
- [ ] `page_links` table: `id`, `source_page_id`, `target_page_id`, `tenant_id`, `created_at`
- [ ] `api_keys` table: `id`, `user_id`, `tenant_id`, `key_hash`, `name`, `created_at`, `revoked_at` (nullable)
- [ ] `databases` table: `id`, `page_id`, `tenant_id`, `schema` (Json), `created_at`, `updated_at`
- [ ] `db_rows` table: `id`, `database_id`, `page_id`, `tenant_id`, `properties` (Json), `created_at`, `updated_at`
- [ ] `users` table: `id`, `tenant_id`, `email`, `password_hash`, `role` (enum: ADMIN, USER), `name`, `created_at`, `updated_at`
- [ ] `tenants` table: `id`, `name`, `created_at`
- [ ] Prisma Client generates successfully (`npx prisma generate` exits with code 0)
- [ ] `prisma/seed.ts` creates a default tenant, admin user (email: `admin@symbio.local`, password: `changeme`), and a Welcome page
- [ ] `src/lib/db.ts` exports singleton Prisma client (prevents multiple instances in development)
- [ ] Migration runs successfully against PostgreSQL 18

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                     Prisma Schema (schema.prisma)                │
│                                                                  │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐                │
│  │ tenants  │──┬──│  users   │     │ api_keys │                │
│  │          │  │  │          │─────│          │                │
│  │ id (PK)  │  │  │ id (PK)  │     │ id (PK)  │                │
│  │ name     │  │  │ tenant_id│     │ user_id  │                │
│  │ created  │  │  │ email    │     │ tenant_id│                │
│  └──────────┘  │  │ password │     │ key_hash │                │
│                │  │ role     │     │ name     │                │
│                │  └──────────┘     │ revoked  │                │
│                │                    └──────────┘                │
│                │                                                │
│                │  ┌──────────┐     ┌──────────┐                │
│                ├──│  pages   │──┬──│  blocks  │                │
│                │  │          │  │  │          │                │
│                │  │ id (PK)  │  │  │ id (PK)  │                │
│                │  │ tenant_id│  │  │ page_id  │                │
│                │  │ parent_id│  │  │ tenant_id│                │
│                │  │ title    │  │  │ type     │                │
│                │  │ icon     │  │  │ content  │                │
│                │  │ cover_url│  │  │ position │                │
│                │  │ position │  │  └──────────┘                │
│                │  └──────────┘                                  │
│                │       │                                        │
│                │  ┌──────────┐                                  │
│                │  │page_links│                                  │
│                │  │          │                                  │
│                │  │ id (PK)  │                                  │
│                │  │ source_id│                                  │
│                │  │ target_id│                                  │
│                │  │ tenant_id│                                  │
│                │  └──────────┘                                  │
│                │                                                │
│                │  ┌──────────┐     ┌──────────┐                │
│                └──│databases │─────│ db_rows  │                │
│                   │          │     │          │                │
│                   │ id (PK)  │     │ id (PK)  │                │
│                   │ page_id  │     │ db_id    │                │
│                   │ tenant_id│     │ page_id  │                │
│                   │ schema   │     │ tenant_id│                │
│                   └──────────┘     │ props    │                │
│                                    └──────────┘                │
└──────────────────────────────────────────────────────────────────┘

Tenant Isolation Pattern:
─────────────────────────
Every table (except tenants) has a tenant_id column.
Every query MUST filter by tenant_id.
Composite indexes on (tenant_id, id) ensure efficient tenant-scoped lookups.

  SELECT * FROM pages WHERE tenant_id = $1 AND id = $2;
                              ▲
                              │
               Uses composite index idx_pages_tenant_id_id
```

**Key Design Decisions:**

1. **UUIDs for all primary keys** — Prevents ID enumeration attacks and supports distributed ID generation without coordination.

2. **JSONB for block content** — Each block stores its full content tree as `{ type, content, marks, attrs }`. This matches the TipTap editor's internal document model, allowing direct serialization/deserialization without transformation.

3. **Self-referential `parent_id` on pages** — Enables unlimited-depth page hierarchy (pages within pages, like Notion). The `parent_id` is nullable; top-level pages have `parent_id = null`.

4. **`page_links` as a materialized index** — Instead of parsing wikilinks from block content on every query, links are extracted and stored in `page_links` on save. This enables O(1) backlink queries and efficient graph data generation.

5. **Unique constraint on `(tenant_id, email)` for users** — Allows the same email address to exist in different tenants (multi-tenant isolation) while preventing duplicates within a single tenant.

---

## Implementation Steps

### Step 1: Initialize Prisma

Initialize Prisma with PostgreSQL as the datasource provider. This creates the `prisma/` directory with the initial `schema.prisma` file.

```bash
npx prisma init --datasource-provider postgresql
```

**Expected output:**
- `prisma/schema.prisma` created with PostgreSQL datasource
- `.env` created with placeholder `DATABASE_URL`

---

### Step 2: Define the Complete Prisma Schema

Replace the generated `schema.prisma` with the full schema defining all 8 core tables.

**File: `prisma/schema.prisma`**

```prisma
// SymbioKnowledgeBase — Prisma Schema
// All tables have tenant_id with composite indexes for multi-tenant isolation.

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── Enums ───────────────────────────────────────────────────────────

enum Role {
  ADMIN
  USER
}

enum BlockType {
  PARAGRAPH
  HEADING_1
  HEADING_2
  HEADING_3
  BULLETED_LIST
  NUMBERED_LIST
  TODO
  TOGGLE
  CODE
  QUOTE
  CALLOUT
  DIVIDER
  IMAGE
  BOOKMARK
  TABLE
}

// ─── Tenants ─────────────────────────────────────────────────────────

model Tenant {
  id        String   @id @default(uuid())
  name      String
  createdAt DateTime @default(now()) @map("created_at")

  // Relations
  users     User[]
  pages     Page[]
  blocks    Block[]
  pageLinks PageLink[]
  apiKeys   ApiKey[]
  databases Database[]
  dbRows    DbRow[]

  @@map("tenants")
}

// ─── Users ───────────────────────────────────────────────────────────

model User {
  id           String   @id @default(uuid())
  tenantId     String   @map("tenant_id")
  email        String
  passwordHash String   @map("password_hash")
  role         Role     @default(USER)
  name         String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // Relations
  tenant  Tenant  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  apiKeys ApiKey[]

  // Indexes
  @@unique([tenantId, email], map: "uq_users_email_tenant_id")
  @@index([tenantId, id], map: "idx_users_tenant_id_id")
  @@index([tenantId], map: "idx_users_tenant_id")

  @@map("users")
}

// ─── Pages ───────────────────────────────────────────────────────────

model Page {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  parentId  String?  @map("parent_id")
  title     String   @default("Untitled")
  icon      String?
  coverUrl  String?  @map("cover_url")
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  tenant       Tenant     @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  parent       Page?      @relation("PageHierarchy", fields: [parentId], references: [id], onDelete: SetNull)
  children     Page[]     @relation("PageHierarchy")
  blocks       Block[]
  sourceLinks  PageLink[] @relation("SourcePage")
  targetLinks  PageLink[] @relation("TargetPage")
  databases    Database[]
  dbRows       DbRow[]

  // Indexes
  @@index([tenantId, id], map: "idx_pages_tenant_id_id")
  @@index([tenantId], map: "idx_pages_tenant_id")
  @@index([tenantId, parentId], map: "idx_pages_tenant_id_parent_id")

  @@map("pages")
}

// ─── Blocks ──────────────────────────────────────────────────────────

model Block {
  id        String    @id @default(uuid())
  pageId    String    @map("page_id")
  tenantId  String    @map("tenant_id")
  type      BlockType @default(PARAGRAPH)
  content   Json      @default("{}")
  position  Int       @default(0)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  page   Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([tenantId, id], map: "idx_blocks_tenant_id_id")
  @@index([tenantId], map: "idx_blocks_tenant_id")
  @@index([pageId], map: "idx_blocks_page_id")
  @@index([tenantId, pageId], map: "idx_blocks_tenant_id_page_id")

  @@map("blocks")
}

// ─── Page Links ──────────────────────────────────────────────────────

model PageLink {
  id           String   @id @default(uuid())
  sourcePageId String   @map("source_page_id")
  targetPageId String   @map("target_page_id")
  tenantId     String   @map("tenant_id")
  createdAt    DateTime @default(now()) @map("created_at")

  // Relations
  tenant     Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  sourcePage Page   @relation("SourcePage", fields: [sourcePageId], references: [id], onDelete: Cascade)
  targetPage Page   @relation("TargetPage", fields: [targetPageId], references: [id], onDelete: Cascade)

  // Indexes
  @@unique([sourcePageId, targetPageId], map: "uq_page_links_source_target")
  @@index([tenantId, id], map: "idx_page_links_tenant_id_id")
  @@index([tenantId], map: "idx_page_links_tenant_id")
  @@index([tenantId, sourcePageId], map: "idx_page_links_tenant_id_source")
  @@index([tenantId, targetPageId], map: "idx_page_links_tenant_id_target")

  @@map("page_links")
}

// ─── API Keys ────────────────────────────────────────────────────────

model ApiKey {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  tenantId  String    @map("tenant_id")
  keyHash   String    @map("key_hash")
  name      String
  createdAt DateTime  @default(now()) @map("created_at")
  revokedAt DateTime? @map("revoked_at")

  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([tenantId, id], map: "idx_api_keys_tenant_id_id")
  @@index([tenantId], map: "idx_api_keys_tenant_id")
  @@index([keyHash], map: "idx_api_keys_key_hash")

  @@map("api_keys")
}

// ─── Databases (Notion-style typed tables) ───────────────────────────

model Database {
  id        String   @id @default(uuid())
  pageId    String   @map("page_id")
  tenantId  String   @map("tenant_id")
  schema    Json     @default("{}") @map("schema")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  // Relations
  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  page   Page   @relation(fields: [pageId], references: [id], onDelete: Cascade)
  rows   DbRow[]

  // Indexes
  @@index([tenantId, id], map: "idx_databases_tenant_id_id")
  @@index([tenantId], map: "idx_databases_tenant_id")
  @@index([pageId], map: "idx_databases_page_id")

  @@map("databases")
}

// ─── Database Rows ───────────────────────────────────────────────────

model DbRow {
  id         String   @id @default(uuid())
  databaseId String   @map("database_id")
  pageId     String?  @map("page_id")
  tenantId   String   @map("tenant_id")
  properties Json     @default("{}") @map("properties")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  // Relations
  tenant   Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  database Database @relation(fields: [databaseId], references: [id], onDelete: Cascade)
  page     Page?    @relation(fields: [pageId], references: [id], onDelete: SetNull)

  // Indexes
  @@index([tenantId, id], map: "idx_db_rows_tenant_id_id")
  @@index([tenantId], map: "idx_db_rows_tenant_id")
  @@index([databaseId], map: "idx_db_rows_database_id")
  @@index([tenantId, databaseId], map: "idx_db_rows_tenant_id_database_id")

  @@map("db_rows")
}
```

**Schema design notes:**

- **`@@map("table_name")`** — Maps PascalCase Prisma model names to snake_case PostgreSQL table names (convention from architecture doc)
- **`@map("column_name")`** — Maps camelCase Prisma field names to snake_case column names
- **`@default(uuid())`** — Uses PostgreSQL's `gen_random_uuid()` for all primary keys
- **`@updatedAt`** — Prisma automatically updates this timestamp on every write
- **`onDelete: Cascade`** — Deleting a tenant cascades to all tenant data; deleting a page cascades to its blocks
- **`onDelete: SetNull`** — Deleting a parent page sets children's `parent_id` to null (promotes to top-level)

---

### Step 3: Create Prisma Client Singleton

Create the Prisma client singleton that prevents multiple database connections during Next.js hot reloads in development.

**File: `src/lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

**Why this pattern is necessary:**

Next.js hot module replacement (HMR) in development creates a new module context on every file change. Without the singleton pattern, each reload creates a new `PrismaClient` instance, opening a new database connection pool. After ~10 reloads, PostgreSQL's default `max_connections` (100) is exhausted, causing `FATAL: too many connections` errors.

The pattern stores the `PrismaClient` instance on `globalThis`, which persists across HMR reloads. In production, a new instance is always created since HMR does not run.

**Logging configuration:**
- **Development:** Logs all queries (`query`), errors (`error`), and warnings (`warn`) for debugging
- **Production:** Logs only errors to minimize log volume

---

### Step 4: Create the Seed Script

Create the seed script that populates the database with initial data: a default tenant, an admin user, and a Welcome page with a sample block.

**File: `prisma/seed.ts`**

```typescript
import { PrismaClient, Role, BlockType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // 1. Create default tenant
  const tenant = await prisma.tenant.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
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
    where: { id: "00000000-0000-0000-0000-000000000010" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000010",
      tenantId: tenant.id,
      title: "Welcome to SymbioKnowledgeBase",
      icon: "👋",
      position: 0,
    },
  });
  console.log(`  Welcome page: ${welcomePage.title} (${welcomePage.id})`);

  // 4. Create welcome blocks
  await prisma.block.upsert({
    where: { id: "00000000-0000-0000-0000-000000000100" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000100",
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
    where: { id: "00000000-0000-0000-0000-000000000101" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000101",
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
    where: { id: "00000000-0000-0000-0000-000000000102" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000102",
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
    where: { id: "00000000-0000-0000-0000-000000000103" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000103",
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
    where: { id: "00000000-0000-0000-0000-000000000104" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000104",
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
    where: { id: "00000000-0000-0000-0000-000000000105" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000105",
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
```

**Seed script design decisions:**

- **`upsert` instead of `create`** — Makes the seed script idempotent. Running it multiple times does not create duplicate records.
- **Fixed UUIDs** — Uses deterministic UUIDs (all zeros with incrementing suffixes) for seed data so that tests and development can reference these IDs reliably.
- **bcryptjs with 10 salt rounds** — Matches the architecture document's security requirement (min 10 salt rounds).
- **Multiple block types** — Seeds a mix of `HEADING_1`, `PARAGRAPH`, `HEADING_2`, and `TODO` blocks to demonstrate the block type system.

---

### Step 5: Configure Prisma Seed in package.json

Add the Prisma seed configuration to `package.json` so that `npx prisma db seed` knows which file to execute.

**Add to `package.json` (top level, not inside scripts):**

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

**Why `tsx`:** The seed script is written in TypeScript and uses ES module imports. `tsx` (TypeScript Execute) runs TypeScript files directly without a separate compilation step. It is included as a dependency of Prisma 7.

---

### Step 6: Set Up Environment Variable

Update the `.env` file (or create `.env.local`) with the PostgreSQL connection string that matches the Docker Compose configuration from SKB-01.3.

**File: `.env`** (for local development — gitignored)

```
DATABASE_URL="postgresql://symbio:symbio_dev_password@localhost:5432/symbio?schema=public"
```

---

### Step 7: Generate Prisma Client and Run Migration

Run the Prisma commands to generate the TypeScript client and create the initial database migration.

```bash
# Generate Prisma Client (TypeScript types from schema)
npx prisma generate

# Create initial migration (requires running PostgreSQL)
npx prisma migrate dev --name init

# Run seed script
npx prisma db seed
```

**Expected results:**
- `prisma generate` — Creates `node_modules/.prisma/client/` with full TypeScript types for all models
- `prisma migrate dev` — Creates `prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql` and applies it
- `prisma db seed` — Outputs seed log messages confirming tenant, user, page, and block creation

---

## Testing Requirements

### Test File: `tests/api/schema.test.ts`

Integration tests that verify the database schema is correctly applied and the seed data exists.

```typescript
import { PrismaClient, Role, BlockType } from "@prisma/client";

const prisma = new PrismaClient();

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
    expect(page?.icon).toBe("👋");
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
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `prisma/schema.prisma` |
| CREATE | `prisma/seed.ts` |
| CREATE | `src/lib/db.ts` |
| MODIFY | `package.json` (add prisma.seed configuration) |
| MODIFY | `.env` (add DATABASE_URL) |
| CREATE | `prisma/migrations/YYYYMMDDHHMMSS_init/migration.sql` (auto-generated) |
| CREATE | `tests/api/schema.test.ts` |

---

**Last Updated:** 2026-02-21
