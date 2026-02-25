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
  // ── New pages (18 more) ──
  security:       "d0000000-0000-4000-a000-000000000010",
  testing:        "d0000000-0000-4000-a000-000000000011",
  deployment:     "d0000000-0000-4000-a000-000000000012",
  frontend:       "d0000000-0000-4000-a000-000000000013",
  performance:    "d0000000-0000-4000-a000-000000000014",
  vectorSearch:   "d0000000-0000-4000-a000-000000000015",
  agentWorkflows: "d0000000-0000-4000-a000-000000000016",
  promptLibrary:  "d0000000-0000-4000-a000-000000000017",
  knowledgePipe:  "d0000000-0000-4000-a000-000000000018",
  meetingSprint13:"d0000000-0000-4000-a000-000000000019",
  meetingSprint12:"d0000000-0000-4000-a000-00000000001a",
  onboarding:     "d0000000-0000-4000-a000-00000000001b",
  contributing:   "d0000000-0000-4000-a000-00000000001c",
  troubleshoot:   "d0000000-0000-4000-a000-00000000001d",
  cicd:           "d0000000-0000-4000-a000-00000000001e",
  dbMigration:    "d0000000-0000-4000-a000-00000000001f",
  accessibility:  "d0000000-0000-4000-a000-000000000020",
  mobileDesign:   "d0000000-0000-4000-a000-000000000021",
};

const DB = {
  bugs: "d1000000-0000-4000-a000-000000000001",
  features: "d1000000-0000-4000-a000-000000000002",
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
    // ── New pages (18 more) ──
    {
      id: PAGE.security,
      title: "Security & Authentication",
      icon: "\u{1F512}",
      position: 3,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.testing,
      title: "Testing Strategy",
      icon: "\u{2705}",
      position: 4,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.deployment,
      title: "Deployment Guide",
      icon: "\u{1F680}",
      position: 5,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.frontend,
      title: "Frontend Components",
      icon: "\u{1F3AF}",
      position: 6,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.performance,
      title: "Performance Optimization",
      icon: "\u{26A1}",
      position: 9,
      parentId: null,
    },
    {
      id: PAGE.vectorSearch,
      title: "Embedding & Vector Search",
      icon: "\u{1F50D}",
      position: 0,
      parentId: PAGE.research,
    },
    {
      id: PAGE.agentWorkflows,
      title: "Agent Workflows",
      icon: "\u{1F916}",
      position: 1,
      parentId: PAGE.research,
    },
    {
      id: PAGE.promptLibrary,
      title: "Prompt Library",
      icon: "\u{1F4AC}",
      position: 2,
      parentId: PAGE.research,
    },
    {
      id: PAGE.knowledgePipe,
      title: "Knowledge Extraction Pipeline",
      icon: "\u{1F52C}",
      position: 3,
      parentId: PAGE.research,
    },
    {
      id: PAGE.meetingSprint13,
      title: "Meeting Notes - Sprint 13",
      icon: "\u{1F4DD}",
      position: 10,
      parentId: null,
    },
    {
      id: PAGE.meetingSprint12,
      title: "Meeting Notes - Sprint 12",
      icon: "\u{1F4DD}",
      position: 11,
      parentId: null,
    },
    {
      id: PAGE.onboarding,
      title: "Onboarding Guide",
      icon: "\u{1F44B}",
      position: 12,
      parentId: null,
    },
    {
      id: PAGE.contributing,
      title: "Contributing Guide",
      icon: "\u{1F91D}",
      position: 13,
      parentId: null,
    },
    {
      id: PAGE.troubleshoot,
      title: "Troubleshooting FAQ",
      icon: "\u{2753}",
      position: 14,
      parentId: null,
    },
    {
      id: PAGE.cicd,
      title: "CI/CD Pipeline",
      icon: "\u{1F504}",
      position: 7,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.dbMigration,
      title: "Database Migration Guide",
      icon: "\u{1F4E6}",
      position: 8,
      parentId: PAGE.arch,
    },
    {
      id: PAGE.accessibility,
      title: "Accessibility Guidelines",
      icon: "\u{267F}",
      position: 0,
      parentId: PAGE.designDoc,
    },
    {
      id: PAGE.mobileDesign,
      title: "Mobile Design Specs",
      icon: "\u{1F4F1}",
      position: 1,
      parentId: PAGE.designDoc,
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

    // ─── Security & Authentication ───
    {
      id: "b0000000-0000-4000-a010-000000000001",
      pageId: PAGE.security,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Security and Authentication. Multi-layered auth and tenant isolation.",
      content: doc(
        heading(1, "Security & Authentication"),
        paragraph(text("Multi-layered security model combining session-based auth for humans and API key auth for agents.")),
        heading(2, "Authentication Methods"),
        bulletList(
          "Session auth: NextAuth.js with JWT tokens, 30-day expiry",
          "API key auth: Bearer token in Authorization header",
          "Middleware validation on every API route",
          "Tenant scoping enforced at the Prisma query level"
        ),
        heading(2, "API Key Lifecycle"),
        orderedList(
          "User generates key in Settings > API Keys",
          "Key is hashed with bcrypt before storage",
          "Only the prefix (sk_...abc) is stored for identification",
          "User can revoke keys at any time",
          "Revoked keys return 401 immediately"
        ),
        heading(2, "Security Headers"),
        codeBlock("typescript",
`// Middleware security headers
response.headers.set("X-Content-Type-Options", "nosniff");
response.headers.set("X-Frame-Options", "DENY");
response.headers.set("X-XSS-Protection", "1; mode=block");
response.headers.set("Strict-Transport-Security", "max-age=31536000");`),
        heading(2, "Data Isolation"),
        paragraph(
          text("Every database query is scoped by "),
          text("tenantId", [{ type: "code" }]),
          text(". Even if an attacker obtains a valid session, they can only access data within their own tenant. Cross-tenant access is architecturally impossible.")
        ),
        heading(2, "Known Limitations"),
        bulletList(
          "No rate limiting on API endpoints yet (planned for v0.5)",
          "No IP allowlist for API keys",
          "No MFA support (planned for Q2)",
          "Audit logging not yet implemented"
        ),
      ),
    },

    // ─── Testing Strategy ───
    {
      id: "b0000000-0000-4000-a011-000000000001",
      pageId: PAGE.testing,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Testing Strategy. Comprehensive testing approach for the platform.",
      content: doc(
        heading(1, "Testing Strategy"),
        paragraph(text("Our testing pyramid ensures confidence at every level of the stack.")),
        heading(2, "Testing Pyramid"),
        codeBlock("text",
`    /  E2E Tests  \\        (Playwright - 15 tests)
   / Integration    \\      (API route tests - 45 tests)
  /  Unit Tests      \\    (Service layer - 120 tests)
 /  Type Checking     \\  (TypeScript strict mode)`),
        heading(2, "Test Commands"),
        codeBlock("bash",
`npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npm run test:e2e            # Playwright E2E
npx tsc --noEmit            # Type check`),
        heading(2, "What We Test"),
        bulletList(
          "Service layer: All CRUD operations with tenant isolation",
          "API routes: Request validation, auth, error responses",
          "Prisma queries: Edge cases (empty results, large datasets)",
          "TipTap content: Wikilink extraction, content normalization",
          "Search: Full-text search relevance and ranking"
        ),
        heading(2, "Test Data Strategy"),
        paragraph(text("Tests use isolated tenants created in beforeAll. Each test suite gets its own tenant to prevent interference. Cleanup happens in afterAll.")),
        heading(2, "Coverage Targets"),
        bulletList(
          "Service layer: 90%+ line coverage",
          "API routes: 85%+ line coverage",
          "UI components: 60%+ (growing)",
          "E2E: Critical user journeys covered"
        ),
      ),
    },

    // ─── Deployment Guide ───
    {
      id: "b0000000-0000-4000-a012-000000000001",
      pageId: PAGE.deployment,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Deployment Guide. How to deploy SymbioKnowledgeBase to production.",
      content: doc(
        heading(1, "Deployment Guide"),
        paragraph(text("Production deployment options and configuration for SymbioKnowledgeBase.")),
        heading(2, "Docker Compose (Recommended)"),
        codeBlock("bash",
`# Production build
docker compose -f docker-compose.prod.yml up -d

# With custom environment
docker compose --env-file .env.production up -d`),
        heading(2, "Environment Variables"),
        codeBlock("bash",
`DATABASE_URL=postgresql://user:pass@db:5432/symbio
NEXTAUTH_SECRET=your-secret-key-min-32-chars
NEXTAUTH_URL=https://your-domain.com
NODE_ENV=production`),
        heading(2, "Database Setup"),
        orderedList(
          "Provision PostgreSQL 16+ (RDS, Cloud SQL, or self-hosted)",
          "Run migrations: npx prisma migrate deploy",
          "Run base seed: npx tsx prisma/seed.ts",
          "Optionally run demo seed: npx tsx prisma/seed-demo.ts"
        ),
        heading(2, "Reverse Proxy"),
        paragraph(text("Place nginx or Caddy in front for TLS termination and caching of static assets.")),
        heading(2, "Health Check"),
        codeBlock("bash", `curl -f http://localhost:3000/api/health || exit 1`),
        heading(2, "Monitoring"),
        bulletList(
          "Application logs via Docker stdout/stderr",
          "PostgreSQL monitoring via pg_stat_statements",
          "Memory usage: Watch for Next.js memory leaks in long-running processes",
          "Disk usage: TipTap content JSON can grow; consider archiving old versions"
        ),
      ),
    },

    // ─── Frontend Components ───
    {
      id: "b0000000-0000-4000-a013-000000000001",
      pageId: PAGE.frontend,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Frontend Components. React component architecture and patterns.",
      content: doc(
        heading(1, "Frontend Components"),
        paragraph(text("React component architecture using Next.js App Router with server and client components.")),
        heading(2, "Component Organization"),
        codeBlock("text",
`src/components/
  ├── ui/           # Reusable primitives (Button, Input, Toggle)
  ├── editor/       # TipTap editor and extensions
  ├── workspace/    # Sidebar, page tree, navigation
  ├── settings/     # Settings page sections
  ├── graph/        # Knowledge graph visualization
  └── database/     # Table view, row editor`),
        heading(2, "Key Components"),
        bulletList(
          "BlockEditor: TipTap instance with custom extensions for wikilinks, slash commands",
          "Sidebar: Collapsible page tree with drag-and-drop reordering",
          "GraphView: Force-directed graph using react-force-graph-2d",
          "DatabaseTable: Sortable/filterable table with inline editing",
          "CommandPalette: Cmd+K quick actions and page search"
        ),
        heading(2, "State Management"),
        paragraph(text("We use a combination of approaches:")),
        bulletList(
          "Server state: TanStack Query (React Query) for all API data",
          "Local UI state: React useState/useReducer",
          "Persistent preferences: localStorage via useSyncExternalStore",
          "URL state: Next.js searchParams for filters and views"
        ),
        heading(2, "Performance Patterns"),
        bulletList(
          "React.memo for expensive list items",
          "useDeferredValue for search input debouncing",
          "Dynamic imports for heavy components (Graph, Editor)",
          "Optimistic updates via TanStack Query mutations"
        ),
      ),
    },

    // ─── Performance Optimization ───
    {
      id: "b0000000-0000-4000-a014-000000000001",
      pageId: PAGE.performance,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Performance Optimization. Benchmarks and optimization techniques.",
      content: doc(
        heading(1, "Performance Optimization"),
        paragraph(text("Benchmarks, bottlenecks, and optimization techniques for the platform.")),
        heading(2, "Current Benchmarks"),
        codeBlock("text",
`Endpoint                    p50     p95     p99
GET /api/pages              12ms    28ms    45ms
GET /api/pages/:id          8ms     15ms    22ms
PUT /api/pages/:id/blocks   18ms    42ms    68ms
GET /api/search?q=...       35ms    85ms    120ms
GET /api/graph              45ms    110ms   180ms`),
        heading(2, "Database Optimization"),
        bulletList(
          "Composite indexes on (tenant_id, id) for all tables",
          "GIN index on search_vector for full-text search",
          "pg_trgm extension for fuzzy matching",
          "Connection pooling via PgBouncer in production"
        ),
        heading(2, "Frontend Optimization"),
        bulletList(
          "Code splitting: Editor loaded only when page is open",
          "Image optimization: Next.js Image component with lazy loading",
          "Font subsetting: Only Latin character set loaded",
          "Bundle size: <200KB first load JS (gzipped)"
        ),
        heading(2, "Caching Strategy"),
        bulletList(
          "TanStack Query: 10s staleTime for page data",
          "Next.js: Static generation for public pages",
          "Browser: Service worker for offline access (planned)",
          "CDN: Static assets cached at edge"
        ),
        heading(2, "Known Bottlenecks"),
        taskList(
          { text: "Graph endpoint slow for >200 nodes (needs pagination)", checked: false },
          { text: "Search re-indexes on every block save (batch it)", checked: false },
          { text: "TipTap large doc serialization blocks main thread", checked: false },
          { text: "Sidebar tree re-renders on any page update", checked: true },
        ),
      ),
    },

    // ─── Embedding & Vector Search ───
    {
      id: "b0000000-0000-4000-a015-000000000001",
      pageId: PAGE.vectorSearch,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Embedding and Vector Search. Semantic search implementation.",
      content: doc(
        heading(1, "Embedding & Vector Search"),
        paragraph(text("Design and implementation of semantic search using vector embeddings alongside PostgreSQL full-text search.")),
        heading(2, "Architecture"),
        codeBlock("text",
`User Query
    |
    ├─> BM25 (PostgreSQL tsvector)  ──┐
    |                                  ├─> RRF Fusion ─> Results
    └─> Semantic (pgvector cosine)  ──┘`),
        heading(2, "Embedding Models Evaluated"),
        bulletList(
          "OpenAI text-embedding-3-small: 1536 dims, best quality/cost ratio",
          "Cohere embed-v3: 1024 dims, good for multilingual",
          "all-MiniLM-L6-v2: 384 dims, free but lower quality",
          "BGE-large-en-v1.5: 1024 dims, open-source best performer"
        ),
        heading(2, "Implementation Status"),
        taskList(
          { text: "pgvector extension installed and configured", checked: true },
          { text: "Embedding generation pipeline (batch async)", checked: true },
          { text: "Hybrid search with RRF fusion", checked: false },
          { text: "Re-embed on block content change", checked: false },
          { text: "Embedding cache to avoid recomputation", checked: false },
        ),
        heading(2, "Cost Estimation"),
        paragraph(
          text("At ~1000 blocks averaging 500 tokens each: ~$0.01/day for embeddings with OpenAI. Scales linearly. For 100K blocks: ~$1/day.")
        ),
      ),
    },

    // ─── Agent Workflows ───
    {
      id: "b0000000-0000-4000-a016-000000000001",
      pageId: PAGE.agentWorkflows,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Agent Workflows. Common patterns for AI agent interaction.",
      content: doc(
        heading(1, "Agent Workflows"),
        paragraph(text("Documented patterns for how AI agents interact with the knowledge base.")),
        heading(2, "Workflow 1: Research Assistant"),
        codeBlock("text",
`User asks question
  → Agent searches KB via /api/search
  → Agent reads top 3 pages via /api/pages/:id
  → Agent synthesizes answer with citations
  → Agent optionally creates summary page`),
        heading(2, "Workflow 2: Meeting Summarizer"),
        codeBlock("text",
`Meeting transcript input
  → Agent extracts action items
  → Agent creates new meeting notes page
  → Agent links to relevant existing pages via wikilinks
  → Agent updates bug tracker database rows`),
        heading(2, "Workflow 3: Documentation Generator"),
        codeBlock("text",
`Code repository input
  → Agent analyzes code structure
  → Agent creates/updates architecture pages
  → Agent generates API documentation
  → Agent creates cross-reference links`),
        heading(2, "Error Handling"),
        bulletList(
          "Retry with exponential backoff on 429 (rate limit)",
          "Skip and log on 404 (page deleted between search and read)",
          "Alert human on 500 (server error)",
          "Validate content before write (prevent malformed TipTap JSON)"
        ),
        heading(2, "Rate Limits"),
        paragraph(text("Current limits: 100 requests/minute per API key. Planned: configurable per-tenant limits.")),
      ),
    },

    // ─── Prompt Library ───
    {
      id: "b0000000-0000-4000-a017-000000000001",
      pageId: PAGE.promptLibrary,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Prompt Library. Curated prompts for knowledge base operations.",
      content: doc(
        heading(1, "Prompt Library"),
        paragraph(text("Curated system prompts for AI agent interactions with the knowledge base.")),
        heading(2, "Knowledge Extraction"),
        codeBlock("text",
`System: You are a knowledge extraction agent. Given a document:
1. Extract atomic facts (one concept per statement)
2. Identify entities and their relationships
3. Use [[wikilinks]] to reference existing KB pages
4. Create new pages for novel concepts
5. Always include source attribution`),
        heading(2, "Summarization"),
        codeBlock("text",
`System: Summarize the following content for a knowledge base entry.
Rules:
- Use bullet points for key facts
- Keep under 500 words
- Preserve technical accuracy
- Link to related concepts using [[Page Name]] syntax
- Include a "Related Pages" section at the end`),
        heading(2, "Question Answering"),
        codeBlock("text",
`System: Answer questions using only the provided knowledge base context.
Rules:
- Cite specific pages: "According to [[Page Name]]..."
- If the answer isn't in the KB, say so explicitly
- Suggest which pages might need updating if info is stale
- Never fabricate information not in the provided context`),
        heading(2, "Code Documentation"),
        codeBlock("text",
`System: Generate documentation for the following code.
Output format:
- Title: Component/function name
- Purpose: One-line description
- Parameters: Type-annotated list
- Examples: At least one usage example
- Related: Links to relevant architecture pages`),
      ),
    },

    // ─── Knowledge Extraction Pipeline ───
    {
      id: "b0000000-0000-4000-a018-000000000001",
      pageId: PAGE.knowledgePipe,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Knowledge Extraction Pipeline. Automated pipeline for ingesting unstructured data.",
      content: doc(
        heading(1, "Knowledge Extraction Pipeline"),
        paragraph(text("Automated pipeline for converting unstructured data sources into structured knowledge base entries.")),
        heading(2, "Pipeline Architecture"),
        codeBlock("text",
`Source Documents ─> Chunking ─> Entity Extraction ─> Deduplication ─> KB Write
     │                                                        │
     └──────── Embedding Generation ──────────────────────────┘`),
        heading(2, "Supported Sources"),
        bulletList(
          "Markdown files (.md)",
          "PDF documents (via pdf-parse)",
          "Notion exports (JSON)",
          "Confluence exports (XML)",
          "Slack conversations (JSON export)",
          "GitHub issues and PRs (via API)"
        ),
        heading(2, "Deduplication Strategy"),
        paragraph(text("Before writing a new page, the pipeline:")),
        orderedList(
          "Searches for pages with similar titles (fuzzy match > 0.8)",
          "Computes embedding similarity against existing blocks",
          "If match > 0.9: updates existing page instead of creating new",
          "If match 0.7-0.9: creates page with link to potential duplicate",
          "If match < 0.7: creates new page"
        ),
        heading(2, "Implementation Status"),
        taskList(
          { text: "Markdown ingestion", checked: true },
          { text: "PDF ingestion", checked: true },
          { text: "Notion JSON import", checked: false },
          { text: "Deduplication pipeline", checked: false },
          { text: "Scheduled batch processing", checked: false },
        ),
      ),
    },

    // ─── Meeting Notes Sprint 13 ───
    {
      id: "b0000000-0000-4000-a019-000000000001",
      pageId: PAGE.meetingSprint13,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Meeting Notes Sprint 13. Sprint review and planning.",
      content: doc(
        heading(1, "Meeting Notes - Sprint 13"),
        paragraph(
          text("Date: "),
          text("February 11, 2026", [{ type: "bold" }]),
          text(" | Attendees: Martin, Sarah, James, Priya")
        ),
        divider(),
        heading(2, "Sprint Review"),
        paragraph(text("Completed items from Sprint 12:")),
        taskList(
          { text: "Wikilink autocomplete with page search", checked: true },
          { text: "Block drag-and-drop reordering", checked: true },
          { text: "Settings page redesign", checked: true },
          { text: "API key rotation support", checked: true },
          { text: "Page cover images", checked: false },
        ),
        heading(2, "Velocity"),
        paragraph(text("Sprint 12 velocity: 34 points. Sprint 13 capacity: 38 points.")),
        heading(2, "Discussion Notes"),
        bulletList(
          "Team agreed to prioritize search improvements over collaboration features",
          "Martin demoed the knowledge graph - team excited about visualization potential",
          "Sarah reported intermittent test failures in CI - investigating Docker memory",
          "Priya completed design specs for mobile-responsive layout"
        ),
      ),
    },

    // ─── Meeting Notes Sprint 12 ───
    {
      id: "b0000000-0000-4000-a01a-000000000001",
      pageId: PAGE.meetingSprint12,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Meeting Notes Sprint 12. Sprint review and planning.",
      content: doc(
        heading(1, "Meeting Notes - Sprint 12"),
        paragraph(
          text("Date: "),
          text("February 4, 2026", [{ type: "bold" }]),
          text(" | Attendees: Martin, Sarah, James")
        ),
        divider(),
        heading(2, "Sprint Review"),
        taskList(
          { text: "User authentication with NextAuth", checked: true },
          { text: "Basic page CRUD", checked: true },
          { text: "Sidebar page tree", checked: true },
          { text: "TipTap editor integration", checked: true },
        ),
        heading(2, "Key Decisions"),
        bulletList(
          "Chose TipTap over Slate.js for editor (better docs, ProseMirror ecosystem)",
          "Decided on single DOCUMENT block per page instead of block-per-paragraph",
          "PostgreSQL chosen over MongoDB for relational integrity and tsvector search",
          "Priya joining the team starting Sprint 13"
        ),
        heading(2, "Tech Debt"),
        taskList(
          { text: "Add TypeScript strict mode", checked: true },
          { text: "Set up Prettier + ESLint", checked: true },
          { text: "Configure CI pipeline", checked: false },
          { text: "Write initial unit tests", checked: false },
        ),
      ),
    },

    // ─── Onboarding Guide ───
    {
      id: "b0000000-0000-4000-a01b-000000000001",
      pageId: PAGE.onboarding,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Onboarding Guide. For new team members joining the project.",
      content: doc(
        heading(1, "Onboarding Guide"),
        paragraph(text("Welcome to the team! This guide will get you up to speed within your first week.")),
        heading(2, "Day 1: Environment Setup"),
        taskList(
          { text: "Get access to GitHub repo and Slack channels", checked: false },
          { text: "Follow the Developer Setup Guide to get running locally", checked: false },
          { text: "Read the System Architecture overview", checked: false },
          { text: "Run the test suite to verify everything works", checked: false },
        ),
        heading(2, "Day 2-3: Codebase Tour"),
        taskList(
          { text: "Read Data Models & Schema", checked: false },
          { text: "Read Frontend Components guide", checked: false },
          { text: "Explore the API Reference", checked: false },
          { text: "Make a small PR (fix a typo, add a test)", checked: false },
        ),
        heading(2, "Day 4-5: Deep Dives"),
        taskList(
          { text: "Read Testing Strategy and write a test", checked: false },
          { text: "Read Security & Authentication", checked: false },
          { text: "Review recent Meeting Notes for context", checked: false },
          { text: "Pick up your first issue from the Bug Tracker", checked: false },
        ),
        heading(2, "Key Contacts"),
        bulletList(
          "Martin - Architecture, backend, API design",
          "Sarah - Performance, testing, infrastructure",
          "James - Frontend, editor, real-time features",
          "Priya - Design, UX, accessibility"
        ),
      ),
    },

    // ─── Contributing Guide ───
    {
      id: "b0000000-0000-4000-a01c-000000000001",
      pageId: PAGE.contributing,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Contributing Guide. How to contribute code to the project.",
      content: doc(
        heading(1, "Contributing Guide"),
        paragraph(text("How to contribute to SymbioKnowledgeBase. We welcome contributions of all sizes!")),
        heading(2, "Branch Naming"),
        codeBlock("text",
`feat/short-description    # New features
fix/short-description     # Bug fixes
refactor/short-desc       # Code improvements
docs/short-description    # Documentation
test/short-description    # Test additions`),
        heading(2, "Commit Messages"),
        paragraph(text("We follow Conventional Commits:")),
        codeBlock("text",
`feat: add wikilink autocomplete
fix: resolve search ranking for short queries
refactor: extract PageService from API route
docs: update API reference for /search endpoint
test: add unit tests for tenant isolation`),
        heading(2, "Pull Request Process"),
        orderedList(
          "Create a branch from main",
          "Write tests for your changes",
          "Ensure all tests pass: npm test",
          "Ensure types check: npx tsc --noEmit",
          "Open PR with description of changes",
          "Get at least one review approval",
          "Squash merge into main"
        ),
        heading(2, "Code Style"),
        bulletList(
          "TypeScript strict mode (no any, no implicit returns)",
          "Functional components with hooks (no class components)",
          "Named exports (no default exports except pages)",
          "Zod schemas for all API input validation"
        ),
      ),
    },

    // ─── Troubleshooting FAQ ───
    {
      id: "b0000000-0000-4000-a01d-000000000001",
      pageId: PAGE.troubleshoot,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Troubleshooting FAQ. Common issues and solutions.",
      content: doc(
        heading(1, "Troubleshooting FAQ"),
        paragraph(text("Common issues and their solutions.")),
        heading(2, "Database connection refused"),
        paragraph(text("Error: Can't reach database server at localhost:5432")),
        codeBlock("bash",
`# Check if PostgreSQL is running
docker compose ps
# Restart the database
docker compose restart db
# Check logs
docker compose logs db --tail 50`),
        heading(2, "Prisma generate fails"),
        paragraph(text("Error: Can't find generator client")),
        codeBlock("bash",
`# Regenerate Prisma client
npx prisma generate
# If that fails, clear node_modules
rm -rf node_modules/.prisma
npm install`),
        heading(2, "Next.js build fails with type errors"),
        codeBlock("bash",
`# Check types first
npx tsc --noEmit
# Common fix: regenerate Prisma types
npx prisma generate`),
        heading(2, "Search returns no results"),
        bulletList(
          "Ensure blocks have plainText populated",
          "Run: SELECT count(*) FROM blocks WHERE search_vector IS NOT NULL",
          "If 0: the search_vector trigger may not be installed",
          "Run migration: npx prisma migrate deploy"
        ),
        heading(2, "Knowledge graph is empty"),
        bulletList(
          "Graph requires PageLink records to show edges",
          "Wikilinks in content are parsed on save and stored as PageLinks",
          "Check: SELECT count(*) FROM page_links",
          "Run demo seed for sample data: npx tsx prisma/seed-demo.ts"
        ),
      ),
    },

    // ─── CI/CD Pipeline ───
    {
      id: "b0000000-0000-4000-a01e-000000000001",
      pageId: PAGE.cicd,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "CI/CD Pipeline. Continuous integration and deployment setup.",
      content: doc(
        heading(1, "CI/CD Pipeline"),
        paragraph(text("GitHub Actions-based CI/CD for automated testing and deployment.")),
        heading(2, "Pipeline Stages"),
        codeBlock("text",
`Push to PR branch
  → Lint (ESLint + Prettier)
  → Type Check (tsc --noEmit)
  → Unit Tests (Vitest)
  → Integration Tests (with test DB)
  → Build (next build)
  → E2E Tests (Playwright)

Merge to main
  → All above +
  → Docker image build
  → Push to registry
  → Deploy to staging`),
        heading(2, "GitHub Actions Config"),
        codeBlock("yaml",
`name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        env:
          POSTGRES_DB: symbio_test
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm test
      - run: npm run build`),
        heading(2, "Deployment Targets"),
        bulletList(
          "Staging: Auto-deploy on merge to main",
          "Production: Manual trigger with approval gate",
          "Preview: Vercel preview deployments for PRs"
        ),
      ),
    },

    // ─── Database Migration Guide ───
    {
      id: "b0000000-0000-4000-a01f-000000000001",
      pageId: PAGE.dbMigration,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Database Migration Guide. How to write and run migrations.",
      content: doc(
        heading(1, "Database Migration Guide"),
        paragraph(text("Best practices for writing and running Prisma migrations.")),
        heading(2, "Creating Migrations"),
        codeBlock("bash",
`# After editing schema.prisma:
npx prisma migrate dev --name add_embedding_column

# This will:
# 1. Generate SQL migration file
# 2. Apply it to your local DB
# 3. Regenerate Prisma client`),
        heading(2, "Migration Best Practices"),
        bulletList(
          "Always test migrations against a copy of production data",
          "Use --create-only to review SQL before applying",
          "Never edit a migration that's already been applied",
          "Add indexes concurrently for large tables (manual SQL)",
          "Include rollback instructions in migration comments"
        ),
        heading(2, "Common Patterns"),
        heading(3, "Adding a column with default"),
        codeBlock("sql",
`-- Safe: adds with default, no table rewrite
ALTER TABLE pages ADD COLUMN archived BOOLEAN DEFAULT FALSE;`),
        heading(3, "Adding an index concurrently"),
        codeBlock("sql",
`-- Won't lock the table during creation
CREATE INDEX CONCURRENTLY idx_blocks_plain_text ON blocks USING gin(to_tsvector('english', plain_text));`),
        heading(2, "Production Deployment"),
        orderedList(
          "Run migrations in a maintenance window",
          "Take a database backup first",
          "Apply: npx prisma migrate deploy",
          "Verify: npx prisma migrate status",
          "Test critical queries after migration"
        ),
      ),
    },

    // ─── Accessibility Guidelines ───
    {
      id: "b0000000-0000-4000-a020-000000000001",
      pageId: PAGE.accessibility,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Accessibility Guidelines. WCAG compliance and a11y patterns.",
      content: doc(
        heading(1, "Accessibility Guidelines"),
        paragraph(text("WCAG 2.1 AA compliance guidelines for all UI components.")),
        heading(2, "Core Requirements"),
        bulletList(
          "All interactive elements must be keyboard accessible",
          "Color contrast ratio: 4.5:1 for normal text, 3:1 for large text",
          "All images and icons must have alt text or aria-label",
          "Focus indicators must be visible on all interactive elements",
          "Screen reader announcements for dynamic content changes"
        ),
        heading(2, "Component Checklist"),
        taskList(
          { text: "Sidebar: keyboard navigation with arrow keys", checked: true },
          { text: "Editor: ARIA roles for toolbar buttons", checked: true },
          { text: "Modals: focus trap and Escape to close", checked: true },
          { text: "Tables: proper th/td semantics", checked: false },
          { text: "Graph: text alternative for visualization", checked: false },
          { text: "Color blind mode: icons alongside color indicators", checked: false },
        ),
        heading(2, "Testing Tools"),
        bulletList(
          "axe-core: Automated a11y testing in CI",
          "Lighthouse: Accessibility audit scores",
          "VoiceOver (macOS): Manual screen reader testing",
          "Keyboard-only navigation: Tab through entire app"
        ),
      ),
    },

    // ─── Mobile Design Specs ───
    {
      id: "b0000000-0000-4000-a021-000000000001",
      pageId: PAGE.mobileDesign,
      type: BlockType.DOCUMENT,
      position: 0,
      plainText: "Mobile Design Specs. Responsive design specifications.",
      content: doc(
        heading(1, "Mobile Design Specs"),
        paragraph(text("Responsive design specifications for tablet and mobile viewports.")),
        heading(2, "Breakpoints"),
        codeBlock("css",
`/* Tailwind breakpoints */
sm: 640px    /* Large phones */
md: 768px    /* Tablets */
lg: 1024px   /* Small laptops */
xl: 1280px   /* Desktop */`),
        heading(2, "Mobile Layout Changes"),
        bulletList(
          "Sidebar: Collapses to hamburger menu below md",
          "Editor toolbar: Sticky at bottom on mobile (thumb-friendly)",
          "Page tree: Full-screen overlay on mobile",
          "Settings: Single-column layout below lg",
          "Graph: Touch gestures for pan/zoom, tap to select node"
        ),
        heading(2, "Touch Targets"),
        paragraph(text("All interactive elements must be at least 44x44px on mobile viewports per Apple HIG guidelines.")),
        heading(2, "Implementation Status"),
        taskList(
          { text: "Responsive sidebar (hamburger on mobile)", checked: false },
          { text: "Mobile-optimized editor toolbar", checked: false },
          { text: "Touch-friendly page tree", checked: false },
          { text: "Responsive settings layout", checked: true },
          { text: "Graph touch gestures", checked: false },
        ),
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
    // ── Welcome hub — links to most top-level pages ──
    { id: "10000000-0000-4000-a000-000000000001", sourcePageId: PAGE.welcome, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000002", sourcePageId: PAGE.welcome, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000003", sourcePageId: PAGE.welcome, targetPageId: PAGE.research },
    { id: "10000000-0000-4000-a000-000000000010", sourcePageId: PAGE.welcome, targetPageId: PAGE.roadmap },
    { id: "10000000-0000-4000-a000-000000000011", sourcePageId: PAGE.welcome, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000012", sourcePageId: PAGE.welcome, targetPageId: PAGE.bugTracker },
    { id: "10000000-0000-4000-a000-000000000030", sourcePageId: PAGE.welcome, targetPageId: PAGE.onboarding },
    { id: "10000000-0000-4000-a000-000000000031", sourcePageId: PAGE.welcome, targetPageId: PAGE.contributing },
    { id: "10000000-0000-4000-a000-000000000032", sourcePageId: PAGE.welcome, targetPageId: PAGE.designDoc },
    { id: "10000000-0000-4000-a000-000000000033", sourcePageId: PAGE.welcome, targetPageId: PAGE.changelog },

    // ── Architecture cluster — dense hub ──
    { id: "10000000-0000-4000-a000-000000000004", sourcePageId: PAGE.arch, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000005", sourcePageId: PAGE.arch, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000006", sourcePageId: PAGE.arch, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-000000000013", sourcePageId: PAGE.arch, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000014", sourcePageId: PAGE.arch, targetPageId: PAGE.designDoc },
    { id: "10000000-0000-4000-a000-000000000034", sourcePageId: PAGE.arch, targetPageId: PAGE.security },
    { id: "10000000-0000-4000-a000-000000000035", sourcePageId: PAGE.arch, targetPageId: PAGE.testing },
    { id: "10000000-0000-4000-a000-000000000036", sourcePageId: PAGE.arch, targetPageId: PAGE.deployment },
    { id: "10000000-0000-4000-a000-000000000037", sourcePageId: PAGE.arch, targetPageId: PAGE.frontend },
    { id: "10000000-0000-4000-a000-000000000038", sourcePageId: PAGE.arch, targetPageId: PAGE.performance },
    { id: "10000000-0000-4000-a000-000000000039", sourcePageId: PAGE.arch, targetPageId: PAGE.cicd },
    { id: "10000000-0000-4000-a000-00000000003a", sourcePageId: PAGE.arch, targetPageId: PAGE.dbMigration },

    // ── API Reference — central node many pages reference ──
    { id: "10000000-0000-4000-a000-000000000007", sourcePageId: PAGE.api, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-00000000000b", sourcePageId: PAGE.devSetup, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-00000000000c", sourcePageId: PAGE.dataModels, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-00000000000d", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000015", sourcePageId: PAGE.api, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000016", sourcePageId: PAGE.api, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-00000000003b", sourcePageId: PAGE.api, targetPageId: PAGE.security },
    { id: "10000000-0000-4000-a000-00000000003c", sourcePageId: PAGE.api, targetPageId: PAGE.agentWorkflows },
    { id: "10000000-0000-4000-a000-00000000003d", sourcePageId: PAGE.api, targetPageId: PAGE.troubleshoot },

    // ── Research & LLM cluster — expanded ──
    { id: "10000000-0000-4000-a000-000000000008", sourcePageId: PAGE.research, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-000000000017", sourcePageId: PAGE.research, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000018", sourcePageId: PAGE.research, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000019", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.research },
    { id: "10000000-0000-4000-a000-00000000001a", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-00000000003e", sourcePageId: PAGE.research, targetPageId: PAGE.vectorSearch },
    { id: "10000000-0000-4000-a000-00000000003f", sourcePageId: PAGE.research, targetPageId: PAGE.agentWorkflows },
    { id: "10000000-0000-4000-a000-000000000040", sourcePageId: PAGE.research, targetPageId: PAGE.promptLibrary },
    { id: "10000000-0000-4000-a000-000000000041", sourcePageId: PAGE.research, targetPageId: PAGE.knowledgePipe },
    { id: "10000000-0000-4000-a000-000000000042", sourcePageId: PAGE.vectorSearch, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-000000000043", sourcePageId: PAGE.vectorSearch, targetPageId: PAGE.performance },
    { id: "10000000-0000-4000-a000-000000000044", sourcePageId: PAGE.vectorSearch, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000045", sourcePageId: PAGE.agentWorkflows, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000046", sourcePageId: PAGE.agentWorkflows, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-000000000047", sourcePageId: PAGE.agentWorkflows, targetPageId: PAGE.promptLibrary },
    { id: "10000000-0000-4000-a000-000000000048", sourcePageId: PAGE.agentWorkflows, targetPageId: PAGE.knowledgePipe },
    { id: "10000000-0000-4000-a000-000000000049", sourcePageId: PAGE.promptLibrary, targetPageId: PAGE.llmGuide },
    { id: "10000000-0000-4000-a000-00000000004a", sourcePageId: PAGE.promptLibrary, targetPageId: PAGE.agentWorkflows },
    { id: "10000000-0000-4000-a000-00000000004b", sourcePageId: PAGE.knowledgePipe, targetPageId: PAGE.vectorSearch },
    { id: "10000000-0000-4000-a000-00000000004c", sourcePageId: PAGE.knowledgePipe, targetPageId: PAGE.agentWorkflows },
    { id: "10000000-0000-4000-a000-00000000004d", sourcePageId: PAGE.knowledgePipe, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-00000000004e", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.agentWorkflows },
    { id: "10000000-0000-4000-a000-00000000004f", sourcePageId: PAGE.llmGuide, targetPageId: PAGE.promptLibrary },

    // ── Planning cluster — roadmap, meetings, changelog ──
    { id: "10000000-0000-4000-a000-000000000009", sourcePageId: PAGE.roadmap, targetPageId: PAGE.meeting },
    { id: "10000000-0000-4000-a000-00000000000a", sourcePageId: PAGE.meeting, targetPageId: PAGE.roadmap },
    { id: "10000000-0000-4000-a000-00000000000f", sourcePageId: PAGE.changelog, targetPageId: PAGE.roadmap },
    { id: "10000000-0000-4000-a000-00000000001b", sourcePageId: PAGE.roadmap, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-00000000001c", sourcePageId: PAGE.roadmap, targetPageId: PAGE.bugTracker },
    { id: "10000000-0000-4000-a000-00000000001d", sourcePageId: PAGE.meeting, targetPageId: PAGE.bugTracker },
    { id: "10000000-0000-4000-a000-00000000001e", sourcePageId: PAGE.meeting, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-00000000001f", sourcePageId: PAGE.changelog, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000050", sourcePageId: PAGE.roadmap, targetPageId: PAGE.performance },
    { id: "10000000-0000-4000-a000-000000000051", sourcePageId: PAGE.roadmap, targetPageId: PAGE.research },
    { id: "10000000-0000-4000-a000-000000000052", sourcePageId: PAGE.meeting, targetPageId: PAGE.meetingSprint13 },
    { id: "10000000-0000-4000-a000-000000000053", sourcePageId: PAGE.meeting, targetPageId: PAGE.meetingSprint12 },
    { id: "10000000-0000-4000-a000-000000000054", sourcePageId: PAGE.meetingSprint13, targetPageId: PAGE.meetingSprint12 },
    { id: "10000000-0000-4000-a000-000000000055", sourcePageId: PAGE.meetingSprint13, targetPageId: PAGE.roadmap },
    { id: "10000000-0000-4000-a000-000000000056", sourcePageId: PAGE.meetingSprint13, targetPageId: PAGE.bugTracker },
    { id: "10000000-0000-4000-a000-000000000057", sourcePageId: PAGE.meetingSprint12, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000058", sourcePageId: PAGE.meetingSprint12, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000059", sourcePageId: PAGE.changelog, targetPageId: PAGE.bugTracker },

    // ── Design cluster — expanded ──
    { id: "10000000-0000-4000-a000-00000000000e", sourcePageId: PAGE.designDoc, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000020", sourcePageId: PAGE.designDoc, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000021", sourcePageId: PAGE.designDoc, targetPageId: PAGE.welcome },
    { id: "10000000-0000-4000-a000-00000000005a", sourcePageId: PAGE.designDoc, targetPageId: PAGE.accessibility },
    { id: "10000000-0000-4000-a000-00000000005b", sourcePageId: PAGE.designDoc, targetPageId: PAGE.mobileDesign },
    { id: "10000000-0000-4000-a000-00000000005c", sourcePageId: PAGE.designDoc, targetPageId: PAGE.frontend },
    { id: "10000000-0000-4000-a000-00000000005d", sourcePageId: PAGE.accessibility, targetPageId: PAGE.frontend },
    { id: "10000000-0000-4000-a000-00000000005e", sourcePageId: PAGE.accessibility, targetPageId: PAGE.testing },
    { id: "10000000-0000-4000-a000-00000000005f", sourcePageId: PAGE.mobileDesign, targetPageId: PAGE.frontend },
    { id: "10000000-0000-4000-a000-000000000060", sourcePageId: PAGE.mobileDesign, targetPageId: PAGE.performance },
    { id: "10000000-0000-4000-a000-000000000061", sourcePageId: PAGE.mobileDesign, targetPageId: PAGE.accessibility },

    // ── Bug Tracker cross-links ──
    { id: "10000000-0000-4000-a000-000000000022", sourcePageId: PAGE.bugTracker, targetPageId: PAGE.changelog },
    { id: "10000000-0000-4000-a000-000000000023", sourcePageId: PAGE.bugTracker, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000062", sourcePageId: PAGE.bugTracker, targetPageId: PAGE.testing },
    { id: "10000000-0000-4000-a000-000000000063", sourcePageId: PAGE.bugTracker, targetPageId: PAGE.contributing },

    // ── Data Models cross-links ──
    { id: "10000000-0000-4000-a000-000000000024", sourcePageId: PAGE.dataModels, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000025", sourcePageId: PAGE.dataModels, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000026", sourcePageId: PAGE.devSetup, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000064", sourcePageId: PAGE.dataModels, targetPageId: PAGE.dbMigration },
    { id: "10000000-0000-4000-a000-000000000065", sourcePageId: PAGE.dataModels, targetPageId: PAGE.security },

    // ── Security cluster ──
    { id: "10000000-0000-4000-a000-000000000066", sourcePageId: PAGE.security, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-000000000067", sourcePageId: PAGE.security, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000068", sourcePageId: PAGE.security, targetPageId: PAGE.deployment },
    { id: "10000000-0000-4000-a000-000000000069", sourcePageId: PAGE.security, targetPageId: PAGE.testing },

    // ── Testing & CI/CD cluster ──
    { id: "10000000-0000-4000-a000-00000000006a", sourcePageId: PAGE.testing, targetPageId: PAGE.cicd },
    { id: "10000000-0000-4000-a000-00000000006b", sourcePageId: PAGE.testing, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-00000000006c", sourcePageId: PAGE.testing, targetPageId: PAGE.contributing },
    { id: "10000000-0000-4000-a000-00000000006d", sourcePageId: PAGE.cicd, targetPageId: PAGE.testing },
    { id: "10000000-0000-4000-a000-00000000006e", sourcePageId: PAGE.cicd, targetPageId: PAGE.deployment },
    { id: "10000000-0000-4000-a000-00000000006f", sourcePageId: PAGE.cicd, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000070", sourcePageId: PAGE.cicd, targetPageId: PAGE.contributing },

    // ── Deployment cluster ──
    { id: "10000000-0000-4000-a000-000000000071", sourcePageId: PAGE.deployment, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000072", sourcePageId: PAGE.deployment, targetPageId: PAGE.cicd },
    { id: "10000000-0000-4000-a000-000000000073", sourcePageId: PAGE.deployment, targetPageId: PAGE.dbMigration },
    { id: "10000000-0000-4000-a000-000000000074", sourcePageId: PAGE.deployment, targetPageId: PAGE.troubleshoot },

    // ── Database Migration cross-links ──
    { id: "10000000-0000-4000-a000-000000000075", sourcePageId: PAGE.dbMigration, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000076", sourcePageId: PAGE.dbMigration, targetPageId: PAGE.deployment },
    { id: "10000000-0000-4000-a000-000000000077", sourcePageId: PAGE.dbMigration, targetPageId: PAGE.troubleshoot },

    // ── Frontend cross-links ──
    { id: "10000000-0000-4000-a000-000000000078", sourcePageId: PAGE.frontend, targetPageId: PAGE.designDoc },
    { id: "10000000-0000-4000-a000-000000000079", sourcePageId: PAGE.frontend, targetPageId: PAGE.performance },
    { id: "10000000-0000-4000-a000-00000000007a", sourcePageId: PAGE.frontend, targetPageId: PAGE.testing },
    { id: "10000000-0000-4000-a000-00000000007b", sourcePageId: PAGE.frontend, targetPageId: PAGE.accessibility },

    // ── Performance cross-links ──
    { id: "10000000-0000-4000-a000-00000000007c", sourcePageId: PAGE.performance, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-00000000007d", sourcePageId: PAGE.performance, targetPageId: PAGE.frontend },
    { id: "10000000-0000-4000-a000-00000000007e", sourcePageId: PAGE.performance, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-00000000007f", sourcePageId: PAGE.performance, targetPageId: PAGE.deployment },

    // ── Onboarding & Contributing cluster ──
    { id: "10000000-0000-4000-a000-000000000080", sourcePageId: PAGE.onboarding, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000081", sourcePageId: PAGE.onboarding, targetPageId: PAGE.arch },
    { id: "10000000-0000-4000-a000-000000000082", sourcePageId: PAGE.onboarding, targetPageId: PAGE.dataModels },
    { id: "10000000-0000-4000-a000-000000000083", sourcePageId: PAGE.onboarding, targetPageId: PAGE.frontend },
    { id: "10000000-0000-4000-a000-000000000084", sourcePageId: PAGE.onboarding, targetPageId: PAGE.testing },
    { id: "10000000-0000-4000-a000-000000000085", sourcePageId: PAGE.onboarding, targetPageId: PAGE.security },
    { id: "10000000-0000-4000-a000-000000000086", sourcePageId: PAGE.onboarding, targetPageId: PAGE.bugTracker },
    { id: "10000000-0000-4000-a000-000000000087", sourcePageId: PAGE.onboarding, targetPageId: PAGE.contributing },
    { id: "10000000-0000-4000-a000-000000000088", sourcePageId: PAGE.contributing, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-000000000089", sourcePageId: PAGE.contributing, targetPageId: PAGE.testing },
    { id: "10000000-0000-4000-a000-00000000008a", sourcePageId: PAGE.contributing, targetPageId: PAGE.cicd },

    // ── Troubleshooting cross-links ──
    { id: "10000000-0000-4000-a000-00000000008b", sourcePageId: PAGE.troubleshoot, targetPageId: PAGE.devSetup },
    { id: "10000000-0000-4000-a000-00000000008c", sourcePageId: PAGE.troubleshoot, targetPageId: PAGE.dbMigration },
    { id: "10000000-0000-4000-a000-00000000008d", sourcePageId: PAGE.troubleshoot, targetPageId: PAGE.deployment },
    { id: "10000000-0000-4000-a000-00000000008e", sourcePageId: PAGE.troubleshoot, targetPageId: PAGE.api },
    { id: "10000000-0000-4000-a000-00000000008f", sourcePageId: PAGE.troubleshoot, targetPageId: PAGE.cicd },
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

  // ── Database (Feature Requests — linked to Roadmap) ──

  await prisma.database.upsert({
    where: { id: DB.features },
    update: {},
    create: {
      id: DB.features,
      pageId: PAGE.roadmap,
      tenantId: TENANT_ID,
      schema: {
        columns: [
          { id: "col-feat", name: "Feature", type: "text" },
          { id: "col-category", name: "Category", type: "select", options: ["Editor", "API", "Graph", "Search", "Auth", "Performance", "Mobile"] },
          { id: "col-status", name: "Status", type: "select", options: ["Proposed", "Approved", "In Development", "Shipped"] },
          { id: "col-votes", name: "Votes", type: "number" },
          { id: "col-owner", name: "Owner", type: "text" },
          { id: "col-target", name: "Target Release", type: "text" },
        ],
      },
    },
  });

  const featureRows = [
    {
      id: "f1000000-0000-4000-a000-000000000001",
      properties: {
        "col-feat": "Real-time collaborative editing",
        "col-category": "Editor",
        "col-status": "In Development",
        "col-votes": 42,
        "col-owner": "James",
        "col-target": "v0.6.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000002",
      properties: {
        "col-feat": "Markdown import/export",
        "col-category": "Editor",
        "col-status": "Approved",
        "col-votes": 38,
        "col-owner": "Martin",
        "col-target": "v0.5.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000003",
      properties: {
        "col-feat": "Graph neighborhood view (focus mode)",
        "col-category": "Graph",
        "col-status": "Proposed",
        "col-votes": 27,
        "col-owner": "",
        "col-target": "v0.6.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000004",
      properties: {
        "col-feat": "Semantic search with vector embeddings",
        "col-category": "Search",
        "col-status": "In Development",
        "col-votes": 35,
        "col-owner": "Martin",
        "col-target": "v0.5.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000005",
      properties: {
        "col-feat": "OAuth2 / SSO integration",
        "col-category": "Auth",
        "col-status": "Proposed",
        "col-votes": 21,
        "col-owner": "",
        "col-target": "v0.7.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000006",
      properties: {
        "col-feat": "Mobile responsive layout",
        "col-category": "Mobile",
        "col-status": "Approved",
        "col-votes": 33,
        "col-owner": "Priya",
        "col-target": "v0.6.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000007",
      properties: {
        "col-feat": "Webhook notifications on page change",
        "col-category": "API",
        "col-status": "Proposed",
        "col-votes": 18,
        "col-owner": "",
        "col-target": "v0.7.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000008",
      properties: {
        "col-feat": "Page templates and quick-create",
        "col-category": "Editor",
        "col-status": "Approved",
        "col-votes": 29,
        "col-owner": "Priya",
        "col-target": "v0.5.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-000000000009",
      properties: {
        "col-feat": "Virtualized block list for large pages",
        "col-category": "Performance",
        "col-status": "In Development",
        "col-votes": 15,
        "col-owner": "Sarah",
        "col-target": "v0.5.0",
      },
    },
    {
      id: "f1000000-0000-4000-a000-00000000000a",
      properties: {
        "col-feat": "API rate limiting per tenant",
        "col-category": "API",
        "col-status": "Approved",
        "col-votes": 12,
        "col-owner": "Martin",
        "col-target": "v0.5.0",
      },
    },
  ];

  for (const row of featureRows) {
    await prisma.dbRow.upsert({
      where: { id: row.id },
      update: { properties: row.properties },
      create: {
        id: row.id,
        databaseId: DB.features,
        tenantId: TENANT_ID,
        properties: row.properties,
      },
    });
  }
  console.log(`  Created feature requests database with ${featureRows.length} rows`);

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
