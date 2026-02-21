---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - deep-research-spec.pdf
date: 2026-02-21
author: Martin
---

# Product Brief: SymbioKnowledgeBase

## Executive Summary

SymbioKnowledgeBase is a web-based knowledge management platform that combines the best features of Obsidian (graph-based linking, backlinks, markdown) and Notion (block-based editor, structured databases, clean UI) into an open-source, self-hosted solution designed for AI-agent-first knowledge management.

The platform solves a critical gap in the scientific research and AI development workflow: no existing open-source knowledge platform is both **AI-agent accessible** and **human-friendly**. Current solutions like Notion require subscriptions and cannot be customized for domain-specific use cases. Obsidian is local-only and has no web interface. SymbioKnowledgeBase bridges this gap by providing each SciSymbioAI user with their own private, web-accessible knowledge base that AI agents can programmatically read, write, and search — while humans can browse, edit, and visualize their knowledge graph through an intuitive web interface.

The platform is built by SciSymbioAI as the knowledge backbone for their Lab Companion AI system, with future integrations planned for ChemELN (Chemical Electronic Lab Notebook) and exPTube (experiment video platform).

---

## Core Vision

### Problem Statement

Researchers and scientists working with AI-assisted lab workflows have no open-source, web-based knowledge platform that serves both human users and AI agents simultaneously. Documentation gets lost, scattered across tools, or locked behind proprietary platforms. Users are — in Martin's words — "zu faul eigene Dokumente zu erstellen" (too lazy to create their own documents) — the AI should do it for them. But current tools don't allow that seamlessly.

### Problem Impact

- **Documentation loss**: Lab notes, experiment results, and research findings get lost across fragmented tools and manual processes
- **AI inaccessibility**: Existing knowledge platforms (Notion, Obsidian) either lack API-first design or are cloud-locked and non-customizable
- **Vendor lock-in**: Notion requires subscriptions and stores data on their servers; no self-hosting option
- **No knowledge visualization**: Plain document storage doesn't reveal connections between research topics, experiments, and findings
- **Fragmented workflow**: Researchers must manually bridge the gap between AI-generated content and their own knowledge organization

### Why Existing Solutions Fall Short

| Solution | Shortcoming |
|----------|-------------|
| **Notion** | Proprietary, subscription-required, cloud-only, no self-hosting, limited API customization |
| **Obsidian** | Local-only (no web app), no native REST API for AI agents, no multi-user support |
| **AppFlowy** | Rust/Flutter stack, no AI-agent-first design, no graph view, limited API |
| **AFFiNE** | Complex architecture, no science-domain focus, still maturing |
| **Outline** | Team wiki focused, no graph view, no database features, no wikilinks |
| **Logseq** | Outliner-focused, not block-editor, limited web deployment |

None of these solutions are designed from the ground up for **AI-agent-first knowledge management** with domain-specific integrations for scientific research.

### Proposed Solution

SymbioKnowledgeBase is a self-hosted, web-based knowledge platform that provides:

1. **Notion-style block editor** — Rich, intuitive editing with drag-and-drop blocks, slash commands, and database views
2. **Obsidian-style knowledge graph** — Visual network graph showing connections between notes via `[[wikilinks]]` and backlinks
3. **AI-agent REST API** — Full CRUD API enabling any AI agent (Claude, Gemini, GPT, or custom) to programmatically manage knowledge
4. **Per-user private workspaces** — Multi-tenant architecture where each SciSymbioAI user gets their own isolated knowledge bubble
5. **Self-hosted deployment** — Full data ownership on own infrastructure
6. **Extensible integration framework** — Plugin architecture for future ChemELN and exPTube integrations

### Key Differentiators

1. **AI-Agent-First Design**: Unlike Notion/Obsidian which bolt on APIs as afterthoughts, SymbioKnowledgeBase is built API-first. Every feature available in the UI is also available programmatically for AI agents.
2. **Lab Tool Integration Pipeline**: Purpose-built connector framework for ChemELN (lab notebooks) and exPTube (experiment videos) — no other knowledge platform targets scientific research workflows.
3. **AI-Agnostic**: The API is designed so any AI agent (Claude, Gemini, GPT, custom) can be swapped in — no vendor lock-in on the AI side either.
4. **Knowledge Graph + Structured Data**: Combines Obsidian's graph visualization with Notion's typed database properties — something no single open-source tool does today.
5. **Open-Source & Self-Hosted**: Full data sovereignty with no subscription fees, customizable for any organization's needs.

---

## Target Users

### Primary Users

**Persona: Dr. Lisa Chen — Research Scientist at SciSymbioAI**

- **Role**: Computational chemist running experiments with AI-assisted lab workflows
- **Context**: Works in a lab environment, generates experiment data daily, needs to document findings
- **Pain Point**: Generates lots of data and notes but "zu faul" (too lazy) to organize them properly — wants the AI to do it
- **Current Workaround**: Scattered notes in local files, some Notion pages, copy-pasting between tools
- **Goal**: Have the Lab Companion AI automatically create and organize documentation, then browse/search/visualize the knowledge herself
- **Aha Moment**: Opens the knowledge graph view and sees how her experiment notes are automatically linked to related papers, protocols, and results — connections she never would have manually created

**Persona: Martin — Product Owner / Platform Developer**

- **Role**: Builds the SciSymbioAI platform ecosystem
- **Context**: Needs a knowledge base component that integrates with ChemELN and exPTube
- **Pain Point**: No off-the-shelf solution fits the AI-first, self-hosted, science-domain requirements
- **Goal**: A reusable knowledge platform that serves as the documentation backbone for the entire SciSymbioAI ecosystem

### Secondary Users

**AI Lab Companion Agent**

- **Role**: Automated documentation agent that creates, organizes, and retrieves knowledge
- **Interaction**: Full CRUD via REST API — creates pages, adds blocks, searches content, builds connections
- **Requirements**: Structured API responses, semantic search capability, webhook notifications for events
- **Key Behavior**: Creates notes from experiment results, links related findings, suggests connections, answers user questions about their knowledge base

### User Journey

1. **Discovery**: User onboards to SciSymbioAI platform and gets their private SymbioKnowledgeBase workspace
2. **Onboarding**: Workspace is pre-configured; AI agent begins populating notes from the user's first lab session
3. **Core Usage**: AI agent writes experiment notes automatically; user browses, edits, and searches via web UI; knowledge graph grows organically
4. **Aha Moment**: User opens graph view and discovers connections between experiments they hadn't realized — "the AI organized all of this for me"
5. **Long-term**: Knowledge base becomes the canonical source of truth for all research documentation; integrated with ChemELN for experiment data and exPTube for video records

---

## Success Metrics

### User Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| AI can CRUD pages via API | 100% endpoint coverage | API test suite |
| Page load time | < 500ms | Performance monitoring |
| Search returns relevant results | Top-3 accuracy > 80% | User testing |
| Graph view renders correctly | Up to 1000 nodes | Performance testing |
| Editor supports all basic block types | 15+ block types | Feature checklist |
| User can browse AI-created content | Zero manual intervention needed | User testing |

### Business Objectives

**3-Month Milestone:**
- Basic Notion-like functionality working end-to-end
- AI agent can perform full CRUD operations via REST API
- Clean, usable web UI with block editor, page hierarchy, and search
- Multi-tenant user isolation functioning

**12-Month Milestone:**
- Full Notion-like feature set (databases, multiple views, templates)
- Interactive knowledge graph visualization (Obsidian-style)
- ChemELN integration operational
- Semantic/vector search for AI-powered content discovery
- Production-ready deployment with 50+ concurrent users

### Key Performance Indicators

| KPI | 3-Month Target | 12-Month Target |
|-----|---------------|-----------------|
| API endpoint coverage | Core CRUD (pages, blocks, search) | Full feature parity with UI |
| Block types supported | 10 basic types | 25+ types including databases |
| Average page load time | < 1s | < 500ms |
| Concurrent users supported | 10 | 50+ |
| Knowledge graph nodes | 500 | 5,000+ |
| Uptime | 95% | 99.5% |
| AI write operations/day | 100+ | 1,000+ |

---

## MVP Scope

### Core Features

1. **Block-Based Editor**
   - Text (paragraph), Heading 1/2/3, Bulleted list, Numbered list, To-do list, Toggle, Quote, Divider, Callout, Code block (with syntax highlighting), Image, Bookmark
   - Slash command (`/`) for block insertion
   - Drag-and-drop block reordering
   - Rich text formatting (bold, italic, strikethrough, code, link)

2. **Page System**
   - Nested page hierarchy (unlimited depth)
   - Page icon (emoji)
   - Page cover image
   - Breadcrumb navigation
   - Sidebar with page tree

3. **Wikilinks & Backlinks**
   - `[[Page Name]]` linking with autocomplete
   - `[[Page Name|Display Text]]` aliases
   - Backlinks panel showing all pages linking to current page
   - Automatic link updating on page rename

4. **Search**
   - Full-text search across all pages
   - Search-as-you-type with results preview
   - Quick switcher (Cmd/Ctrl+K) for instant page navigation

5. **Knowledge Graph View**
   - Interactive force-directed graph showing all pages as nodes and links as edges
   - Click-to-navigate from graph nodes to pages
   - Local graph view per page (N-degree connections)
   - Zoom, pan, basic filtering

6. **REST API for AI Agents**
   - `GET/POST/PUT/DELETE /api/pages` — Full page CRUD
   - `GET/POST/PUT/DELETE /api/blocks` — Block-level operations
   - `GET /api/search?q=term` — Full-text search
   - `GET /api/graph` — Knowledge graph data
   - `GET /api/pages/:id/backlinks` — Backlink queries
   - API key authentication per user
   - OpenAPI/Swagger documentation

7. **Database (Table View Only)**
   - Create databases with typed properties (Title, Text, Number, Select, Multi-select, Date, Checkbox, URL)
   - Table view with filtering and sorting
   - Each database row is a full page
   - Inline property editing

8. **Multi-Tenant User System**
   - User registration and authentication
   - Private workspace per user (complete isolation)
   - Per-user API keys for AI agent access

9. **Theming**
   - Light and dark mode
   - Clean, Notion-inspired UI aesthetic

### Out of Scope for MVP

- Real-time collaboration / multi-user co-editing
- Database automations (trigger-action workflows)
- Database views beyond Table (Board, Calendar, Gallery, Timeline, Chart)
- Mobile app (browser-only for MVP)
- Canvas / whiteboard functionality
- Templates system
- Page version history
- Comments and inline discussions
- Notion Sites / web publishing
- File/media attachments beyond images
- Obsidian Publish equivalent
- Formula properties in databases
- Relation/Rollup properties in databases
- ChemELN / exPTube integrations
- Semantic/vector search (basic full-text only for MVP)
- Import/export (Markdown, CSV)
- Webhook system

### MVP Success Criteria

| Criteria | Validation Method |
|----------|-------------------|
| AI agent can create a page with 5+ block types via API | Automated integration test |
| User can browse and edit AI-created pages in the web UI | Manual user testing |
| Knowledge graph correctly shows all page links | Visual validation with 100+ pages |
| Search finds content across all user pages in < 2s | Performance test |
| Multi-tenant isolation: User A cannot see User B's data | Security test |
| Application deploys on a single Linux server via Docker | Deployment test |
| Basic database with table view is functional | Feature test |

---

## Future Vision

### Post-MVP Enhancements (v1.1 - v1.5)

- **Additional database views**: Board (Kanban), Calendar, Gallery, List
- **Relation & Rollup properties**: Cross-database linking
- **Formula properties**: Computed fields in databases
- **Templates system**: Page and database templates
- **Import/Export**: Markdown, CSV, Obsidian vault import
- **Page version history**: Snapshot-based with rollback
- **Comments**: Inline and page-level comments
- **File attachments**: Upload and embed PDFs, audio, video
- **Webhook system**: Event-driven notifications for integrations

### Future Epics (v2.0+)

- **ChemELN Integration**: Bidirectional sync with Chemical Electronic Lab Notebook
- **exPTube Integration**: Embed experiment videos, auto-create pages from uploads
- **Semantic Search**: Vector embeddings (pgvector) for AI-powered content discovery
- **Real-time Collaboration**: WebSocket-based co-editing with presence indicators
- **Mobile App**: Progressive Web App or native mobile application
- **Canvas/Whiteboard**: Infinite canvas for visual note arrangement
- **Database Automations**: Trigger-action workflows on property changes
- **Notion Sites Equivalent**: Publish pages as public websites
- **Plugin System**: Extensible architecture for community plugins
- **AI Q&A**: Natural language questions about workspace content

### 2-3 Year Vision

SymbioKnowledgeBase becomes the **central knowledge nervous system** for the SciSymbioAI platform ecosystem:

- Every experiment documented automatically by AI in the knowledge base
- Experiment videos from exPTube linked and searchable
- Lab protocols and results from ChemELN synced bidirectionally
- Knowledge graph reveals patterns across hundreds of experiments
- Any AI agent (Claude, Gemini, custom) can plug in as a knowledge worker
- Self-hosted by research institutions, biotech companies, and individual scientists worldwide

---

## Technical Direction

### Recommended Stack (from deep-research-spec.pdf)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js + TipTap/BlockNote | SSR for performance, proven block editor ecosystem |
| **Backend** | Node.js (Fastify) | High performance, TypeScript consistency with frontend |
| **Database** | PostgreSQL + JSONB | Structured data + flexible block content, pgvector-ready |
| **Search** | PostgreSQL FTS (MVP), Meilisearch (future) | Start simple, scale later |
| **Graph** | D3.js / react-force-graph | Proven force-directed graph rendering |
| **Auth** | NextAuth.js or custom JWT | Multi-tenant user management |
| **Deployment** | Docker + Docker Compose | Self-hosted, single-server deployment |
| **Styling** | Tailwind CSS | Rapid UI development, dark/light mode |

### Key Open Source References

- **BlockNote** (blocknotejs.org) — Notion-like block editor for React
- **AFFiNE** (github.com/toeverything/AFFiNE) — Architecture inspiration
- **Outline** (github.com/outline/outline) — Team wiki reference
- **react-force-graph** — Graph visualization component

---

*Product Brief created: 2026-02-21*
*Author: Martin (Product Owner, SciSymbioAI)*
*BMAD Workflow: create-product-brief (steps 1-6 complete)*
