import "dotenv/config";
import { PrismaClient, BlockType } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Use the existing tenant and user
const TENANT_ID = "00000000-0000-4000-a000-000000000001";

// Fixed UUIDs for idempotent seeding (valid UUID v4: pos 13=4, pos 17=a)
const PAGE = {
  welcome:    "d0000000-0000-4000-a000-000000000001",
  arch:       "d0000000-0000-4000-a000-000000000002",
  api:        "d0000000-0000-4000-a000-000000000003",
  research:   "d0000000-0000-4000-a000-000000000004",
  meeting:    "d0000000-0000-4000-a000-000000000005",
  roadmap:    "d0000000-0000-4000-a000-000000000006",
  devSetup:   "d0000000-0000-4000-a000-000000000007",
  llmGuide:   "d0000000-0000-4000-a000-000000000008",
  dataModels: "d0000000-0000-4000-a000-000000000009",
  changelog:  "d0000000-0000-4000-a000-00000000000a",
  bugTracker: "d0000000-0000-4000-a000-00000000000b",
  designDoc:  "d0000000-0000-4000-a000-00000000000c",
};

const DB = {
  bugs: "d1000000-0000-4000-a000-000000000001",
};

function text(t: string, marks?: Array<{ type: string; attrs?: Record<string, unknown> }>) {
  const node: Record<string, unknown> = { type: "text", text: t };
  if (marks) node.marks = marks;
  return node;
}

function paragraph(...content: unknown[]) {
  return { type: "paragraph", content };
}

function heading(level: number, t: string) {
  return { type: "heading", attrs: { level }, content: [text(t)] };
}

function bulletList(...items: string[]) {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(text(item))],
    })),
  };
}

function orderedList(...items: string[]) {
  return {
    type: "orderedList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(text(item))],
    })),
  };
}

function taskList(...items: Array<{ text: string; checked: boolean }>) {
  return {
    type: "taskList",
    content: items.map((item) => ({
      type: "taskItem",
      attrs: { checked: item.checked },
      content: [paragraph(text(item.text))],
    })),
  };
}

function codeBlock(language: string, code: string) {
  return { type: "codeBlock", attrs: { language }, content: [text(code)] };
}

function blockquote(t: string) {
  return { type: "blockquote", content: [paragraph(text(t))] };
}

function divider() {
  return { type: "horizontalRule" };
}

function doc(...content: unknown[]) {
  return { type: "doc", content };
}

async function main() {
  console.log("Seeding demo data...\n");

  // ── Pages ──────────────────────────────────────────────

  const pages = [
    {
      id: PAGE.welcome,
      title: "Welcome to SymbioKnowledgeBase",
      icon: "\u{1F44B}",
      position: 0,
      parentId: null,
    },
    {
      id: PAGE.arch,
      title: "System Architecture",
      icon: "\u{1F3D7}\u{FE0F}",
      position: 1,
      parentId: null,
    },
    {
      id: PAGE.api,
      title: "API Reference",
      icon: "\u{1F4E1}",
      position: 2,
      parentId: null,
    },
    {
      id: PAGE.research,
      title: "AI Research Notes",
      icon: "\u{1F9EA}",
      position: 3,
      parentId: null,
    },
    {
      id: PAGE.meeting,
      title: "Meeting Notes - Sprint 14",
      icon: "\u{1F4DD}",
      position: 4,
      parentId: null,
    },
    {
      id: PAGE.roadmap,
      title: "Product Roadmap Q1 2026",
      icon: "\u{1F5FA}\u{FE0F}",
      position: 5,
      parentId: null,
    },
    {
      id: PAGE.devSetup,
      title: "Developer Setup Guide",
      icon: "\u{1F4BB}",
      position: 0,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.llmGuide,
      title: "LLM Integration Guide",
      icon: "\u{1F916}",
      position: 1,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.dataModels,
      title: "Data Models & Schema",
      icon: "\u{1F4CA}",
      position: 2,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.changelog,
      title: "Changelog",
      icon: "\u{1F4C3}",
      position: 6,
      parentId: null,
    },
    {
      id: PAGE.bugTracker,
      title: "Bug Tracker",
      icon: "\u{1F41B}",
      position: 7,
      parentId: null,
    },
    {
      id: PAGE.designDoc,
      title: "Design System",
      icon: "\u{1F3A8}",
      position: 8,
      parentId: null,
    },
  ];

  for (const p of pages) {
    await prisma.page.upsert({
      where: { id: p.id },
      update: { title: p.title, icon: p.icon, position: p.position, parentId: p.parentId },
      create: { id: p.id, tenantId: TENANT_ID, ...p },
    });
    console.log(`  Page: ${p.icon} ${p.title}`);
  }

  // ── Blocks (DOCUMENT type with full TipTap content) ──

  const blocks: Array<{
    id: string;
    pageId: string;
    type: BlockType;
    content: unknown;
    position: number;
    plainText: string;
  }> = [
    // ─── Welcome Page ───
    {
      id: "b0000000-0000-4000-a001-000000000001",
      pageId: PAGE.welcome,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Welcome to SymbioKnowledgeBase. Your AI-agent-first knowledge management platform.",
      content: doc(
        heading(1, "Welcome to SymbioKnowledgeBase"),
        paragraph(
          text("Your "),
          text("AI-agent-first", [{ type: "bold" }]),
          text(" knowledge management platform. Build structured knowledge bases that both humans and AI agents can read, write, and query through a unified interface.")
        ),
        divider(),
        heading(2, "Quick Start"),
        orderedList(
          "Create pages and organize them into a hierarchy",
          "Link ideas together using [[wikilinks]] for a connected knowledge graph",
          "Generate API keys in Settings for programmatic access",
          "Connect your AI agents via the REST API",
          "Explore the Knowledge Graph to visualize connections"
        ),
        heading(2, "Key Features"),
        bulletList(
          "Block-based editor with rich text, code blocks, and embeds",
          "Wikilink-based page linking with automatic backlink tracking",
          "Interactive knowledge graph visualization",
          "Notion-style database tables with filtering and sorting",
          "Full REST API with OpenAPI documentation",
          "Multi-tenant architecture with API key authentication"
        ),
        heading(2, "Getting Started Checklist"),
        taskList(
          { text: "Read the System Architecture overview", checked: false },
          { text: "Set up your development environment", checked: false },
          { text: "Explore the API Reference", checked: false },
          { text: "Create your first database", checked: false },
          { text: "Connect an AI agent", checked: false }
        ),
        blockquote("The best knowledge base is one that grows organically through both human curation and AI contribution."),
      ),
    },

    // ─── System Architecture ───
    {
      id: "b0000000-0000-4000-a002-000000000001",
      pageId: PAGE.arch,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "System Architecture. SymbioKnowledgeBase is built on a modern stack.",
      content: doc(
        heading(1, "System Architecture"),
        paragraph(
          text("SymbioKnowledgeBase is built on a modern full-stack TypeScript architecture designed for both human and AI-agent interaction.")
        ),
        heading(2, "Tech Stack"),
        bulletList(
          "Frontend: Next.js 16 with React 19 and TailwindCSS 4",
          "Editor: TipTap (ProseMirror-based block editor)",
          "Backend: Next.js API Routes with Zod validation",
          "Database: PostgreSQL 18 with Prisma ORM",
          "Auth: NextAuth.js with JWT sessions",
          "Graph: react-force-graph for knowledge visualization"
        ),
        heading(2, "Request Flow"),
        codeBlock("text",
`Client (Browser / AI Agent)
    |
    v
Next.js Middleware (JWT auth check)
    |
    v
API Route Handler (Zod validation)
    |
    v
Service Layer (business logic)
    |
    v
Prisma ORM (tenant-scoped queries)
    |
    v
PostgreSQL (multi-tenant data)`
        ),
        heading(2, "Multi-Tenant Design"),
        paragraph(
          text("Every table includes a "),
          text("tenant_id", [{ type: "code" }]),
          text(" column. All queries are scoped by tenant to ensure complete data isolation. Composite indexes on "),
          text("(tenant_id, id)", [{ type: "code" }]),
          text(" ensure efficient lookups.")
        ),
        heading(2, "Key Design Decisions"),
        bulletList(
          "Single DOCUMENT block per page stores full TipTap JSON for atomic saves",
          "Wikilinks parsed from content JSON for automatic link tracking",
          "Full-text search via PostgreSQL tsvector with trigram support",
          "API key auth alongside session auth for agent access"
        ),
        divider(),
        paragraph(
          text("See also: "),
          text("Data Models & Schema", [{ type: "bold" }]),
          text(" and "),
          text("Developer Setup Guide", [{ type: "bold" }]),
        ),
      ),
    },

    // ─── API Reference ───
    {
      id: "b0000000-0000-4000-a003-000000000001",
      pageId: PAGE.api,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "API Reference. Complete REST API documentation for SymbioKnowledgeBase.",
      content: doc(
        heading(1, "API Reference"),
        paragraph(text("Complete REST API for programmatic access. All endpoints require authentication via session cookie or API key header.")),
        heading(2, "Authentication"),
        paragraph(
          text("Include your API key in the "),
          text("Authorization", [{ type: "code" }]),
          text(" header:")
        ),
        codeBlock("bash", `curl -H "Authorization: Bearer sk_your_api_key_here" \\
  http://localhost:3000/api/pages`),
        heading(2, "Pages"),
        codeBlock("text",
`GET    /api/pages          List all pages
POST   /api/pages          Create a new page
GET    /api/pages/:id      Get a page by ID
PUT    /api/pages/:id      Update a page
DELETE /api/pages/:id      Delete a page
GET    /api/pages/tree     Get page hierarchy tree`),
        heading(2, "Blocks"),
        codeBlock("text",
`GET    /api/pages/:id/blocks   Get blocks for a page
PUT    /api/pages/:id/blocks   Save page content (full doc)
POST   /api/blocks             Create a block
PUT    /api/blocks/:id         Update a block
DELETE /api/blocks/:id         Delete a block`),
        heading(2, "Databases"),
        codeBlock("text",
`GET    /api/databases              List databases
POST   /api/databases              Create a database
GET    /api/databases/:id          Get database with schema
PUT    /api/databases/:id          Update database schema
DELETE /api/databases/:id          Delete a database
GET    /api/databases/:id/rows     List rows
POST   /api/databases/:id/rows     Create a row
PUT    /api/databases/:id/rows/:r  Update a row
DELETE /api/databases/:id/rows/:r  Delete a row`),
        heading(2, "Search & Graph"),
        codeBlock("text",
`GET    /api/search?q=term    Full-text search across blocks
GET    /api/graph            Knowledge graph (nodes + edges)`),
        heading(2, "Example: Create a Page with Content"),
        codeBlock("javascript",
`const response = await fetch("/api/pages", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    title: "New Page",
    icon: "📄",
  }),
});

const { data: page } = await response.json();

// Save content
await fetch(\`/api/pages/\${page.id}/blocks\`, {
  method: "PUT",
  headers: {
    "Authorization": "Bearer sk_your_key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Hello from API" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Created programmatically!" }],
        },
      ],
    },
  }),
});`),
      ),
    },

    // ─── AI Research Notes ───
    {
      id: "b0000000-0000-4000-a004-000000000001",
      pageId: PAGE.research,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "AI Research Notes. Collection of findings from LLM integration experiments.",
      content: doc(
        heading(1, "AI Research Notes"),
        paragraph(text("Collection of findings from our LLM integration experiments and agent-based knowledge management research.")),
        divider(),
        heading(2, "RAG Architecture Findings"),
        paragraph(
          text("After testing multiple retrieval-augmented generation approaches, we found that "),
          text("hybrid search", [{ type: "bold" }]),
          text(" (combining BM25 with vector embeddings) outperforms pure semantic search for knowledge base queries.")
        ),
        bulletList(
          "BM25 alone: 68% relevance on our benchmark",
          "Vector search alone: 74% relevance",
          "Hybrid (RRF fusion): 82% relevance",
          "Hybrid + metadata filtering: 89% relevance"
        ),
        heading(2, "Agent Interaction Patterns"),
        paragraph(text("Three primary patterns emerged for how AI agents use the knowledge base:")),
        orderedList(
          "Read-heavy: Agent queries existing knowledge to answer user questions (80% of requests)",
          "Write-after-read: Agent reads context, performs reasoning, writes conclusions back (15%)",
          "Structured data: Agent populates database tables from unstructured sources (5%)"
        ),
        heading(2, "Prompt Engineering for Knowledge Extraction"),
        codeBlock("text",
`System: You are a knowledge extraction agent. Given a document,
extract structured facts and store them in the knowledge base.

Rules:
1. Each fact should be atomic (one concept per block)
2. Use wikilinks [[Page Name]] to reference related concepts
3. Prefer specific over general statements
4. Include source attribution when available`),
        heading(2, "Open Questions"),
        taskList(
          { text: "How to handle conflicting information from different agents?", checked: false },
          { text: "Should we version block content for audit trails?", checked: false },
          { text: "Evaluate pg_vector vs. external vector DB for embeddings", checked: true },
          { text: "Benchmark concurrent agent writes (optimistic locking)", checked: true },
          { text: "Test context window impact on extraction quality", checked: false }
        ),
        blockquote("Knowledge bases that integrate AI agents from the ground up will define the next generation of productivity tools. The key is treating the API as a first-class interface, not an afterthought."),
      ),
    },

    // ─── Meeting Notes ───
    {
      id: "b0000000-0000-4000-a005-000000000001",
      pageId: PAGE.meeting,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Meeting Notes Sprint 14. Weekly standup and sprint planning.",
      content: doc(
        heading(1, "Meeting Notes - Sprint 14"),
        paragraph(
          text("Date: "),
          text("February 18, 2026", [{ type: "bold" }]),
          text(" | Attendees: Martin, Sarah, James, Priya")
        ),
        divider(),
        heading(2, "Sprint Review"),
        paragraph(text("Completed items from Sprint 13:")),
        taskList(
          { text: "Database table view with sorting and filtering", checked: true },
          { text: "API key management in Settings page", checked: true },
          { text: "Full-text search with PostgreSQL tsvector", checked: true },
          { text: "Wikilink parsing and backlink display", checked: true },
          { text: "Knowledge graph visualization (basic)", checked: true }
        ),
        heading(2, "Sprint 14 Planning"),
        paragraph(text("Priority items for this sprint:")),
        taskList(
          { text: "Page templates and quick-create flows", checked: false },
          { text: "Collaborative editing (WebSocket foundation)", checked: false },
          { text: "Import/Export (Markdown, JSON)", checked: false },
          { text: "Graph view: local neighborhood mode", checked: false },
          { text: "Performance: virtualize block list for large pages", checked: false }
        ),
        heading(2, "Discussion Notes"),
        bulletList(
          "Sarah raised concern about real-time sync - agreed to start with last-write-wins for v1",
          "James will prototype WebSocket integration with Hocuspocus",
          "Priya to design the import/export UX flow",
          "Martin to finalize the OpenAPI spec for external consumers"
        ),
        heading(2, "Action Items"),
        taskList(
          { text: "@james - WebSocket spike by Wednesday", checked: false },
          { text: "@priya - Import flow wireframes by Thursday", checked: false },
          { text: "@martin - OpenAPI spec review with API consumers", checked: false },
          { text: "@sarah - Write performance benchmarks for block rendering", checked: false }
        ),
      ),
    },

    // ─── Product Roadmap ───
    {
      id: "b0000000-0000-4000-a006-000000000001",
      pageId: PAGE.roadmap,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Product Roadmap Q1 2026.",
      content: doc(
        heading(1, "Product Roadmap Q1 2026"),
        paragraph(text("Strategic priorities and milestones for Q1.")),
        divider(),
        heading(2, "January - Foundation"),
        taskList(
          { text: "Core block editor with TipTap", checked: true },
          { text: "Page CRUD and hierarchy (parent/child)", checked: true },
          { text: "User auth (NextAuth + JWT)", checked: true },
          { text: "Multi-tenant data isolation", checked: true },
          { text: "REST API with Zod validation", checked: true }
        ),
        heading(2, "February - Intelligence"),
        taskList(
          { text: "Full-text search (PostgreSQL tsvector)", checked: true },
          { text: "Wikilink parsing and bidirectional links", checked: true },
          { text: "Knowledge graph visualization", checked: true },
          { text: "Database tables (Notion-style)", checked: true },
          { text: "API key auth for agents", checked: true },
          { text: "OpenAPI documentation", checked: false }
        ),
        heading(2, "March - Scale & Polish"),
        taskList(
          { text: "Real-time collaboration (WebSocket)", checked: false },
          { text: "Import/Export (Markdown, Notion JSON)", checked: false },
          { text: "Page templates", checked: false },
          { text: "Advanced graph filters and search", checked: false },
          { text: "Performance optimization (virtualized rendering)", checked: false },
          { text: "Mobile responsive layout", checked: false }
        ),
        heading(2, "Success Metrics"),
        bulletList(
          "API response time p95 < 200ms",
          "Support 10,000+ blocks per tenant without degradation",
          "Knowledge graph renders 500+ nodes at 60fps",
          "AI agent can populate 100 pages/hour via API"
        ),
      ),
    },

    // ─── Developer Setup Guide ───
    {
      id: "b0000000-0000-4000-a007-000000000001",
      pageId: PAGE.devSetup,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Developer Setup Guide. How to get the development environment running.",
      content: doc(
        heading(1, "Developer Setup Guide"),
        paragraph(text("Get the development environment running in under 5 minutes.")),
        heading(2, "Prerequisites"),
        bulletList(
          "Node.js 20+ (recommend using fnm or nvm)",
          "Docker & Docker Compose (for PostgreSQL)",
          "Git"
        ),
        heading(2, "1. Clone & Install"),
        codeBlock("bash",
`git clone https://github.com/mpriessner/SymbioKnowledgeBase.git
cd SymbioKnowledgeBase
npm install`),
        heading(2, "2. Environment Setup"),
        codeBlock("bash",
`cp .env.example .env
# Default values work with Docker Compose`),
        heading(2, "3. Database"),
        codeBlock("bash",
`# Start PostgreSQL
docker compose up db -d

# Run migrations
npm run db:generate
npm run db:migrate

# Optional: seed demo data
npm run db:seed`),
        heading(2, "4. Run the App"),
        codeBlock("bash",
`npm run dev
# Open http://localhost:3000`),
        heading(2, "5. Run Tests"),
        codeBlock("bash",
`npm test           # Run once
npm run test:watch # Watch mode`),
        heading(2, "Common Issues"),
        bulletList(
          "Port 5432 in use: stop local PostgreSQL or change the port in .env",
          "Postgres 18 volume error: use docker compose down -v to reset volumes",
          "Prisma generate fails: ensure DATABASE_URL is set correctly"
        ),
      ),
    },

    // ─── LLM Integration Guide ───
    {
      id: "b0000000-0000-4000-a008-000000000001",
      pageId: PAGE.llmGuide,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "LLM Integration Guide. How to connect AI agents to SymbioKnowledgeBase.",
      content: doc(
        heading(1, "LLM Integration Guide"),
        paragraph(
          text("This guide covers how to connect AI agents (Claude, GPT, etc.) to SymbioKnowledgeBase as a "),
          text("knowledge backend", [{ type: "bold" }]),
          text(".")
        ),
        heading(2, "Overview"),
        paragraph(text("AI agents interact with SymbioKnowledgeBase through the REST API. The typical flow is:")),
        orderedList(
          "Agent receives a user query",
          "Agent searches the knowledge base for relevant context",
          "Agent uses context to formulate a response",
          "Optionally, agent writes new knowledge back to the KB"
        ),
        heading(2, "Tool Definitions"),
        paragraph(text("Here's how to define SymbioKnowledgeBase tools for an AI agent:")),
        codeBlock("json",
`{
  "tools": [
    {
      "name": "search_knowledge",
      "description": "Search the knowledge base for information",
      "parameters": {
        "type": "object",
        "properties": {
          "query": { "type": "string", "description": "Search query" }
        }
      }
    },
    {
      "name": "read_page",
      "description": "Read the full content of a knowledge base page",
      "parameters": {
        "type": "object",
        "properties": {
          "page_id": { "type": "string", "description": "Page UUID" }
        }
      }
    },
    {
      "name": "create_page",
      "description": "Create a new knowledge base page",
      "parameters": {
        "type": "object",
        "properties": {
          "title": { "type": "string" },
          "content": { "type": "string", "description": "Markdown content" }
        }
      }
    }
  ]
}`),
        heading(2, "Best Practices"),
        bulletList(
          "Use search before creating - avoid duplicate pages",
          "Keep pages focused on a single topic",
          "Use wikilinks to connect related concepts",
          "Write plain text in blocks for better search indexing",
          "Rate limit agent writes to prevent flooding"
        ),
      ),
    },

    // ─── Data Models & Schema ───
    {
      id: "b0000000-0000-4000-a009-000000000001",
      pageId: PAGE.dataModels,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Data Models and Schema. Core data models powering SymbioKnowledgeBase.",
      content: doc(
        heading(1, "Data Models & Schema"),
        paragraph(text("Core data models powering SymbioKnowledgeBase. All models are tenant-scoped.")),
        heading(2, "Entity Relationship"),
        codeBlock("text",
`Tenant
  ├── User (1:N)
  │     └── ApiKey (1:N)
  ├── Page (1:N, self-referencing hierarchy)
  │     ├── Block (1:N)
  │     ├── PageLink (N:N via source/target)
  │     └── Database (1:N)
  │           └── DbRow (1:N)
  └── (all above scoped by tenant_id)`),
        heading(2, "Key Models"),
        heading(3, "Page"),
        codeBlock("typescript",
`interface Page {
  id: string;          // UUID
  tenantId: string;    // Tenant scope
  parentId?: string;   // Hierarchy (nullable)
  title: string;       // Default: "Untitled"
  icon?: string;       // Emoji
  coverUrl?: string;   // Cover image
  position: number;    // Sort order
}`),
        heading(3, "Block"),
        codeBlock("typescript",
`interface Block {
  id: string;
  pageId: string;
  tenantId: string;
  type: BlockType;     // DOCUMENT, PARAGRAPH, HEADING_1, etc.
  content: JsonValue;  // TipTap JSONContent
  position: number;
  plainText: string;   // Extracted text for search
  searchVector?: unknown; // PostgreSQL tsvector
}`),
        heading(3, "Database & DbRow"),
        codeBlock("typescript",
`interface Database {
  id: string;
  pageId: string;      // Linked to a page
  tenantId: string;
  schema: JsonValue;   // Column definitions
}

interface DbRow {
  id: string;
  databaseId: string;
  pageId?: string;     // Optional linked page
  tenantId: string;
  properties: JsonValue; // Row data matching schema
}`),
      ),
    },

    // ─── Changelog ───
    {
      id: "b0000000-0000-4000-a00a-000000000001",
      pageId: PAGE.changelog,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Changelog. History of notable changes and releases.",
      content: doc(
        heading(1, "Changelog"),
        heading(2, "v0.4.0 - 2026-02-21"),
        bulletList(
          "Added: Full-text search with PostgreSQL tsvector and ts_headline",
          "Added: Knowledge graph visualization with react-force-graph",
          "Added: Wikilink parsing and automatic backlink tracking",
          "Added: Database tables with column schema and row CRUD",
          "Fixed: Block reordering race condition on rapid drag-and-drop",
          "Improved: API response envelope with consistent error format"
        ),
        heading(2, "v0.3.0 - 2026-02-07"),
        bulletList(
          "Added: API key management (generate, revoke, rotate)",
          "Added: Settings page with user profile and API keys",
          "Added: OpenAPI specification at /api/openapi.yaml",
          "Fixed: Page deletion not cascading to child pages",
          "Improved: Prisma query performance with composite indexes"
        ),
        heading(2, "v0.2.0 - 2026-01-24"),
        bulletList(
          "Added: TipTap block editor with code blocks, quotes, callouts",
          "Added: Page hierarchy (parent/child) with sidebar tree",
          "Added: Auto-save with debounce (1000ms)",
          "Fixed: JWT token not refreshing on session extension",
          "Improved: Tenant isolation with middleware-level checks"
        ),
        heading(2, "v0.1.0 - 2026-01-10"),
        bulletList(
          "Initial release",
          "User registration and login (NextAuth.js)",
          "Basic page CRUD with title and icon",
          "Multi-tenant architecture with Prisma",
          "Docker Compose development setup"
        ),
      ),
    },

    // ─── Bug Tracker (page for the database) ───
    {
      id: "b0000000-0000-4000-a00b-000000000001",
      pageId: PAGE.bugTracker,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Bug Tracker. Active bugs and issues.",
      content: doc(
        heading(1, "Bug Tracker"),
        paragraph(text("Active bugs and issues tracked in the database below. Use the table to filter by status and priority.")),
      ),
    },

    // ─── Design System ───
    {
      id: "b0000000-0000-4000-a00c-000000000001",
      pageId: PAGE.designDoc,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Design System. Visual language and component guidelines.",
      content: doc(
        heading(1, "Design System"),
        paragraph(text("Visual language and component guidelines for SymbioKnowledgeBase.")),
        heading(2, "Color Palette"),
        paragraph(text("We use CSS custom properties for theming. All colors are defined as semantic tokens.")),
        codeBlock("css",
`:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f9fafb;
  --bg-hover: #f3f4f6;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-inverse: #ffffff;
  --accent-primary: #3b82f6;
  --accent-primary-hover: #2563eb;
  --border-default: #e5e7eb;
  --border-strong: #d1d5db;
}`),
        heading(2, "Typography"),
        bulletList(
          "Headings: System font stack, semibold weight",
          "Body: 16px base, 1.6 line height for readability",
          "Code: JetBrains Mono or system monospace",
          "Sidebar: 14px, medium weight"
        ),
        heading(2, "Component Patterns"),
        bulletList(
          "Buttons: Rounded-lg, 2.5rem height, primary/secondary/ghost variants",
          "Inputs: Border with focus ring, consistent padding",
          "Cards: Subtle border, no shadow (flat design)",
          "Modals: Centered overlay with backdrop blur",
          "Tooltips: Dark background, small text, 200ms delay"
        ),
        heading(2, "Spacing Scale"),
        codeBlock("text",
`4px  - tight (inline elements, icon gaps)
8px  - compact (list items, small cards)
12px - default (form elements, buttons)
16px - comfortable (card padding)
24px - spacious (section gaps)
32px - loose (page sections)
48px - extra (hero spacing)`),
        heading(2, "Iconography"),
        paragraph(text("We use native emoji for page icons and system UI icons are from a minimal SVG set. No icon library dependency.")),
      ),
    },
  ];

  for (const b of blocks) {
    await prisma.block.upsert({
      where: { id: b.id },
      update: { content: b.content as object, plainText: b.plainText },
      create: {
        id: b.id,
        pageId: b.pageId,
        tenantId: TENANT_ID,
        type: b.type,
        content: b.content as object,
        position: b.position,
        plainText: b.plainText,
      },
    });
  }
  console.log(`\n  Created ${blocks.length} document blocks`);

  // ── Page Links ─────────────────────────────────────────

  const links = [
    // Welcome hub — links to most top-level pages
    { id: "10000000-0000-4000-a000-000000000001", sourcePageId: PAGE.welcome, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000002", sourcePageId: PAGE.welcome, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000003", sourcePageId: PAGE.welcome, targetPageId: PAGE.research },
    { id: "10000000-0000-4000-a000-000000000010", sourcePageId: PAGE.welcome, targetPageId: PAGE.roadmap },
    { id: "10000000-0000-4000-a000-000000000011", sourcePageId: PAGE.welcome, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000012", sourcePageId: PAGE.welcome, targetPageId: PAGE.bugTracker },

    // Architecture cluster — dense interconnections
    { id: "10000000-0000-4000-a000-000000000004", sourcePageId: PAGE.arch, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000005", sourcePageId: PAGE.arch, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000006", sourcePageId: PAGE.arch, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-000000000013", sourcePageId: PAGE.arch, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000014", sourcePageId: PAGE.arch, targetPageId: PAGE.designDoc },

    // API Reference — central node many pages reference
    { id: "10000000-0000-4000-a000-000000000007", sourcePageId: PAGE.api, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-00000000000b", sourcePageId: PAGE.devSetup, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-00000000000c", sourcePageId: PAGE.dataModels, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-00000000000d", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000015", sourcePageId: PAGE.api, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000016", sourcePageId: PAGE.api, targetPageId: PAGE.devSetup },

    // Research & LLM cluster
    { id: "10000000-0000-4000-a000-000000000008", sourcePageId: PAGE.research, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-000000000017", sourcePageId: PAGE.research, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000018", sourcePageId: PAGE.research, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000019", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.research },
    { id: "10000000-0000-4000-a000-00000000001a", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.devSetup },

    // Planning cluster — roadmap, meeting, changelog
    { id: "10000000-0000-4000-a000-000000000009", sourcePageId: PAGE.roadmap, targetPageId: PAGE.meeting },
    { id: "10000000-0000-4000-a000-00000000000a", sourcePageId: PAGE.meeting, targetPageId: PAGE.roadmap },
    { id: "10000000-0000-4000-a000-00000000000f", sourcePageId: PAGE.changelog, targetPageId: PAGE.roadmap },
    { id: "10000000-0000-4000-a000-00000000001b", sourcePageId: PAGE.roadmap, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-00000000001c", sourcePageId: PAGE.roadmap, targetPageId: PAGE.bugTracker },
    { id: "10000000-0000-4000-a000-00000000001d", sourcePageId: PAGE.meeting, targetPageId: PAGE.bugTracker },
    { id: "10000000-0000-4000-a000-00000000001e", sourcePageId: PAGE.meeting, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-00000000001f", sourcePageId: PAGE.changelog, targetPageId: PAGE.arch },

    // Design & Bug Tracker cross-links
    { id: "10000000-0000-4000-a000-00000000000e", sourcePageId: PAGE.designDoc, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000020", sourcePageId: PAGE.designDoc, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000021", sourcePageId: PAGE.designDoc, targetPageId: PAGE.welcome },
    { id: "10000000-0000-4000-a000-000000000022", sourcePageId: PAGE.bugTracker, targetPageId: PAGE.changelog },
    { id: "10000000-0000-4000-a000-000000000023", sourcePageId: PAGE.bugTracker, targetPageId: PAGE.arch },

    // Data Models cross-links
    { id: "10000000-0000-4000-a000-000000000024", sourcePageId: PAGE.dataModels, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000025", sourcePageId: PAGE.dataModels, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000026", sourcePageId: PAGE.devSetup, targetPageId: PAGE.dataModels },
  ];

  for (const link of links) {
    await prisma.pageLink.upsert({
      where: {
        sourcePageId_targetPageId: {
          sourcePageId: link.sourcePageId,
          targetPageId: link.targetPageId,
        },
      },
      update: {},
      create: {
        id: link.id,
        tenantId: TENANT_ID,
        sourcePageId: link.sourcePageId,
        targetPageId: link.targetPageId,
      },
    });
  }
  console.log(`  Created ${links.length} page links`);

  // ── Database (Bug Tracker) ─────────────────────────────

  await prisma.database.upsert({
    where: { id: DB.bugs },
    update: {},
    create: {
      id: DB.bugs,
      pageId: PAGE.bugTracker,
      tenantId: TENANT_ID,
      schema: {
        columns: [
          { id: "col-title", name: "Title", type: "text" },
          { id: "col-status", name: "Status", type: "select", options: ["Open", "In Progress", "Resolved", "Closed"] },
          { id: "col-priority", name: "Priority", type: "select", options: ["Critical", "High", "Medium", "Low"] },
          { id: "col-assignee", name: "Assignee", type: "text" },
          { id: "col-date", name: "Reported", type: "date" },
          { id: "col-resolved", name: "Fixed", type: "checkbox" },
        ],
      },
    },
  });

  const bugRows = [
    {
      id: "f0000000-0000-4000-a000-000000000001",
      properties: {
        "col-title": "Block reorder flickers on fast drag",
        "col-status": "In Progress",
        "col-priority": "High",
        "col-assignee": "Sarah",
        "col-date": "2026-02-15",
        "col-resolved": false,
      },
    },
    {
      id: "f0000000-0000-4000-a000-000000000002",
      properties: {
        "col-title": "Search results don't highlight matched terms",
        "col-status": "Open",
        "col-priority": "Medium",
        "col-assignee": "James",
        "col-date": "2026-02-17",
        "col-resolved": false,
      },
    },
    {
      id: "f0000000-0000-4000-a000-000000000003",
      properties: {
        "col-title": "API returns 500 for empty page title",
        "col-status": "Resolved",
        "col-priority": "High",
        "col-assignee": "Martin",
        "col-date": "2026-02-10",
        "col-resolved": true,
      },
    },
    {
      id: "f0000000-0000-4000-a000-000000000004",
      properties: {
        "col-title": "Graph layout resets on window resize",
        "col-status": "Open",
        "col-priority": "Low",
        "col-assignee": "Priya",
        "col-date": "2026-02-18",
        "col-resolved": false,
      },
    },
    {
      id: "f0000000-0000-4000-a000-000000000005",
      properties: {
        "col-title": "JWT refresh token not rotating",
        "col-status": "Resolved",
        "col-priority": "Critical",
        "col-assignee": "Martin",
        "col-date": "2026-02-05",
        "col-resolved": true,
      },
    },
    {
      id: "f0000000-0000-4000-a000-000000000006",
      properties: {
        "col-title": "Code block syntax highlight missing for Rust",
        "col-status": "Open",
        "col-priority": "Low",
        "col-assignee": "",
        "col-date": "2026-02-19",
        "col-resolved": false,
      },
    },
    {
      id: "f0000000-0000-4000-a000-000000000007",
      properties: {
        "col-title": "Deleting parent page orphans children",
        "col-status": "Resolved",
        "col-priority": "High",
        "col-assignee": "Sarah",
        "col-date": "2026-02-08",
        "col-resolved": true,
      },
    },
    {
      id: "f0000000-0000-4000-a000-000000000008",
      properties: {
        "col-title": "Wikilink autocomplete shows deleted pages",
        "col-status": "In Progress",
        "col-priority": "Medium",
        "col-assignee": "James",
        "col-date": "2026-02-20",
        "col-resolved": false,
      },
    },
  ];

  for (const row of bugRows) {
    await prisma.dbRow.upsert({
      where: { id: row.id },
      update: { properties: row.properties },
      create: {
        id: row.id,
        databaseId: DB.bugs,
        tenantId: TENANT_ID,
        properties: row.properties,
      },
    });
  }
  console.log(`  Created bug tracker database with ${bugRows.length} rows`);

  console.log("\nDemo seed complete!");
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
