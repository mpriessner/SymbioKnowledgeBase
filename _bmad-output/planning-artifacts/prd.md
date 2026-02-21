---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - product-brief-SymbioKnowledgeBase-2026-02-21.md
  - deep-research-spec.pdf
workflowType: prd
classification:
  projectType: web_app
  domain: scientific
  complexity: medium
  projectContext: greenfield
---

# Product Requirements Document - SymbioKnowledgeBase

**Author:** Martin
**Date:** 2026-02-21

## Executive Summary

SymbioKnowledgeBase is a self-hosted, open-source web application that merges Obsidian-style knowledge graphing (wikilinks, backlinks, force-directed graph visualization) with Notion-style block editing (rich blocks, slash commands, typed databases) into a single platform purpose-built for AI-agent-first knowledge management.

The core problem: no existing open-source knowledge platform simultaneously serves human users through an intuitive web UI and AI agents through a comprehensive REST API. Notion is proprietary, cloud-locked, and subscription-gated. Obsidian is local-only with no web interface or REST API. AppFlowy, AFFiNE, Outline, and Logseq each lack critical capabilities — graph visualization, structured databases, AI-first API design, or web deployment readiness.

SymbioKnowledgeBase targets research scientists using SciSymbioAI's Lab Companion AI system. The AI agent autonomously creates, organizes, and links experiment documentation via the REST API. The human researcher browses, edits, searches, and visualizes the growing knowledge graph through a clean web interface. The result: researchers who are "too lazy to create their own documents" get an AI-maintained knowledge base that reveals connections they never would have manually created.

### What Makes This Special

1. **AI-Agent-First Architecture**: Every UI capability has a corresponding REST API endpoint. The API is not an afterthought — it is the primary interface, with the web UI as a human-friendly layer on top.
2. **Knowledge Graph + Structured Data in One Tool**: No existing open-source platform combines Obsidian's `[[wikilink]]`-driven graph visualization with Notion's typed database properties and table views.
3. **AI-Agnostic Design**: The REST API accepts standard HTTP requests with API key auth. Any AI agent — Claude, Gemini, GPT, or custom — can be swapped in without platform changes.
4. **Scientific Research Pipeline**: Purpose-built integration points for ChemELN (lab notebooks) and exPTube (experiment videos) — targeting a domain no other knowledge platform addresses.
5. **Self-Hosted & Open Source**: Full data sovereignty, no subscription fees, fully customizable for institutional deployment.

## Project Classification

- **Project Type:** Web Application (Next.js SSR/SPA with REST API backend)
- **Domain:** Scientific research knowledge management
- **Complexity:** Medium — scientific domain with data validation and reproducibility concerns, no heavy regulatory requirements
- **Project Context:** Greenfield — new platform built from scratch
- **Deployment Model:** Self-hosted via Docker Compose on single Linux server

## Success Criteria

### User Success

- **AI Documentation Completeness**: AI agent creates structured experiment notes with 5+ block types (headings, paragraphs, lists, code, callouts) via API without human intervention
- **Knowledge Discovery**: Users find relevant content within top-3 search results for 80%+ of queries
- **Graph Insight**: Users discover at least one non-obvious connection between research topics per week through the knowledge graph view
- **Edit Efficiency**: Users edit AI-created pages with the same speed and fluidity as creating content in Notion (block editor supports all standard formatting operations)
- **Zero-Friction Browsing**: Users navigate between pages, search results, and graph nodes without page reloads or loading spinners exceeding 1 second

### Business Success

**3-Month Targets:**
- Core platform functional end-to-end: block editor, page hierarchy, search, REST API
- AI agent performs full CRUD (create, read, update, delete) on pages and blocks via API
- Multi-tenant user isolation validated (User A cannot access User B's data)
- Single-server Docker deployment operational

**12-Month Targets:**
- Full Notion-like feature set: databases with table view, multiple block types (25+), templates
- Interactive knowledge graph visualization rendering 5,000+ nodes
- ChemELN integration operational for bidirectional experiment data sync
- Semantic/vector search (pgvector) for AI-powered content discovery
- 50+ concurrent users supported in production

### Technical Success

- API response times < 200ms for CRUD operations under normal load (10 concurrent users)
- Page load time (Time to Interactive) < 1 second at 3 months, < 500ms at 12 months
- PostgreSQL full-text search returns results in < 2 seconds across 10,000+ blocks
- Knowledge graph renders up to 1,000 nodes at 30+ FPS in the browser
- Docker Compose deployment completes in under 5 minutes on a fresh Linux server
- 95% uptime at 3 months, 99.5% uptime at 12 months

### Measurable Outcomes

| Outcome | Target | Measurement Method |
|---------|--------|--------------------|
| API endpoint coverage | 100% feature parity with UI | Automated API test suite |
| Block types supported | 12+ at MVP, 25+ at 12 months | Feature checklist |
| Search relevance | Top-3 accuracy > 80% | Manual user testing with 50 queries |
| Graph rendering | 1,000 nodes, 30+ FPS | Browser performance profiling |
| Multi-tenant isolation | Zero cross-tenant data leaks | Automated security test suite |
| AI operations per day | 100+ at 3 months, 1,000+ at 12 months | API request logging |
| User page load time | < 1s (3mo), < 500ms (12mo) | Lighthouse / Web Vitals monitoring |

## Product Scope

### MVP - Minimum Viable Product

The MVP delivers a functional knowledge platform where AI agents create content via API and humans browse/edit via web UI. Core capabilities:

1. Block-based page editor with 12+ block types
2. Hierarchical page system with sidebar navigation
3. `[[Wikilink]]` support with backlinks panel
4. Full-text search with quick switcher (Cmd/Ctrl+K)
5. Interactive knowledge graph view (global + local per-page)
6. REST API with full CRUD for pages, blocks, search, and graph data
7. Database feature with table view, typed properties, filtering/sorting
8. Multi-tenant authentication with per-user API keys
9. Light/dark theme
10. Docker Compose deployment

### Growth Features (Post-MVP)

- Additional database views: Board (Kanban), Calendar, Gallery, List
- Relation and Rollup database properties
- Formula properties for computed fields
- Page and database templates system
- Import/Export: Markdown, CSV, Obsidian vault import
- Page version history with rollback
- Inline and page-level comments
- File attachments: PDFs, audio, video embedding
- Webhook system for event-driven integrations

### Vision (Future)

- ChemELN Integration: bidirectional experiment data sync
- exPTube Integration: experiment video embedding and auto-page creation
- Semantic Search: pgvector-powered vector embeddings for AI content discovery
- Real-time Collaboration: WebSocket-based co-editing with presence indicators
- Mobile App: Progressive Web App or native mobile
- Canvas/Whiteboard: infinite canvas for visual note arrangement
- Database Automations: trigger-action workflows on property changes
- Plugin System: extensible architecture for community plugins
- AI Q&A: natural language questions against workspace content

## User Journeys

### Journey 1: Dr. Lisa Chen — AI-Assisted Experiment Documentation (Primary User, Happy Path)

**Opening Scene:** Dr. Lisa Chen finishes a computational chemistry experiment. She has raw data, observations, and analysis results scattered across terminal outputs and temporary files. She used to spend 45 minutes writing up notes in Notion — but she's always behind on documentation.

**Rising Action:** The Lab Companion AI agent detects the experiment completion and calls the SymbioKnowledgeBase REST API. It creates a new page titled "Experiment #247 — Catalyst Binding Affinity Analysis" with structured blocks: a heading, a summary paragraph, a data table with results, a code block with the analysis script, and a callout highlighting the key finding. The AI creates `[[wikilinks]]` to related pages: `[[Catalyst Series B]]`, `[[Binding Affinity Protocol]]`, and `[[Paper Draft — Chen 2026]]`.

**Climax:** Lisa opens SymbioKnowledgeBase in her browser. She navigates to the knowledge graph view and sees Experiment #247 connected to six other experiment pages she'd forgotten about. The graph reveals a pattern: three experiments with similar catalyst configurations all showed anomalous binding affinity. She clicks through, edits the AI-generated note to add her interpretation, and creates a new page `[[Anomalous Binding Pattern Investigation]]` linking all three.

**Resolution:** Lisa's knowledge base grows to 200+ pages in three months — all created or enriched by the AI, all interconnected through wikilinks. She spends 5 minutes per day reviewing and refining instead of 45 minutes writing from scratch. Her PI is impressed by the thoroughness of her documentation. The knowledge graph becomes her primary research navigation tool.

**Requirements Revealed:** Block editor, page creation API, wikilink support, knowledge graph visualization, full-text search, page editing

### Journey 2: AI Lab Companion Agent — Programmatic Knowledge Management (Secondary User / API Consumer)

**Opening Scene:** The Lab Companion Agent is configured with a SymbioKnowledgeBase API key for Lisa's workspace. It monitors experiment pipelines and lab instrument outputs.

**Rising Action:** When an experiment completes, the agent constructs a POST request to `/api/pages` with a structured body containing the page title, icon, and an array of block objects (heading, paragraph, table, code, callout). It then calls `/api/search?q=catalyst binding` to find related pages and adds `[[wikilinks]]` by updating block content via `PUT /api/blocks/:id`. Finally, it calls `GET /api/pages/:id/backlinks` to verify the links are bidirectional.

**Climax:** When Lisa asks the agent "What experiments used Catalyst B?" the agent calls `GET /api/search?q=Catalyst B` and returns a list of relevant pages with snippets. It can also call `GET /api/graph` to find pages connected to `[[Catalyst Series B]]` within 2 degrees of separation.

**Resolution:** The agent performs 50-100 API operations per day across Lisa's workspace: creating pages, updating blocks, searching content, and querying the graph. All operations complete in under 200ms. The API returns consistent JSON responses with proper error codes for any failures.

**Requirements Revealed:** REST API CRUD endpoints, search API, graph data API, backlink queries, API key authentication, structured JSON responses, error handling

### Journey 3: Martin — Platform Administrator & Developer (Admin User)

**Opening Scene:** Martin deploys SymbioKnowledgeBase for the first time on a Linux server. He runs `docker-compose up -d` and the application starts with PostgreSQL, the Next.js frontend, and the Fastify API backend.

**Rising Action:** Martin creates the first admin account, then provisions user accounts for three researchers. Each gets an isolated workspace and unique API key. He configures the Lab Companion Agent with each user's API key. He monitors the application through Docker logs and checks that each user's data is completely isolated — searching in Lisa's workspace returns zero results from other users' content.

**Climax:** After a month, Martin reviews system health: page load times are under 1 second, the API is handling 300+ requests per day, and the knowledge graph renders correctly with 500+ nodes across all users. He updates the deployment by pulling a new Docker image and restarting the containers with zero data loss.

**Resolution:** SymbioKnowledgeBase runs stably as a core component of the SciSymbioAI platform. Martin begins planning the ChemELN integration, knowing the REST API provides a solid foundation for bidirectional data sync.

**Requirements Revealed:** Docker deployment, user management, multi-tenant isolation, API key provisioning, system monitoring, update/migration path

### Journey 4: New Researcher — Onboarding and First Use (Primary User, Edge Case)

**Opening Scene:** Dr. Amir Patel joins the lab and receives his SciSymbioAI account. He's never used a knowledge management tool beyond Google Docs.

**Rising Action:** Amir logs into SymbioKnowledgeBase and sees an empty workspace. The Lab Companion AI has pre-created a "Welcome" page with instructions and a few starter pages linking to lab protocols. Amir tries the slash command menu (`/`) and discovers he can add headings, lists, code blocks, and callouts. He types `[[` and the autocomplete shows existing pages he can link to. He creates his first manual note about a paper he's reading.

**Climax:** After two weeks, the AI has created 30 pages from Amir's first experiments. He uses Cmd+K to quickly search for a protocol he vaguely remembers, finds it instantly, and realizes it's linked to five experiment pages he didn't know were related. He switches to dark mode for late-night lab sessions.

**Resolution:** Amir becomes a daily user within the first week. The combination of AI-generated content and manual editing means his workspace grows rapidly without overwhelming effort. He rarely needs to create pages from scratch — the AI does the heavy lifting.

**Requirements Revealed:** User onboarding flow, slash commands, wikilink autocomplete, quick switcher, dark mode, page creation by both AI and human

### Journey Requirements Summary

| Capability Area | Journeys Requiring It |
|----------------|----------------------|
| Block-based page editor | 1, 2, 4 |
| REST API (CRUD pages/blocks) | 2, 3 |
| Wikilinks and backlinks | 1, 2, 4 |
| Knowledge graph visualization | 1, 2 |
| Full-text search | 1, 2, 4 |
| Multi-tenant user management | 3, 4 |
| API key authentication | 2, 3 |
| Docker deployment | 3 |
| Quick switcher (Cmd/Ctrl+K) | 1, 4 |
| Theme switching (light/dark) | 4 |
| Database (table view) | 1 |
| Sidebar navigation | 1, 4 |

## Domain-Specific Requirements

### Scientific Research Context

SymbioKnowledgeBase operates in the scientific research domain with medium complexity. No heavy regulatory requirements (no FDA, HIPAA, or clinical data), but scientific best practices apply:

### Data Integrity

- Block content stored in PostgreSQL with JSONB preserves exact content as entered — no lossy transformations
- Page edit history tracked at minimum as last-modified timestamps per block for traceability
- API operations are atomic: a failed multi-block update does not leave pages in partial states
- Database property values stored with type enforcement (Number fields reject non-numeric input)

### Research Reproducibility Support

- Each page and block has a stable, unique identifier (UUID) that persists across edits
- API responses include creation and modification timestamps for all entities
- Wikilinks use page IDs internally (not titles) so renaming pages does not break links
- Search results are deterministic: same query returns same ordering given same content

### Multi-Tenant Data Isolation

- Each user's workspace is a logically isolated tenant in PostgreSQL
- All database queries filter by tenant ID — no API endpoint returns cross-tenant data
- API keys are scoped to a single tenant; a key for User A cannot access User B's data
- Tenant isolation is enforced at the database query layer, not just the API layer

### Integration Readiness

- REST API follows OpenAPI 3.0 specification with Swagger documentation
- All API endpoints return consistent JSON response structures with proper HTTP status codes
- Block content schema is extensible: new block types can be added without schema migration
- API supports pagination, filtering, and sorting on list endpoints for future high-volume integrations (ChemELN, exPTube)

## Innovation & Novel Patterns

### Detected Innovation Areas

1. **AI-Agent-First Knowledge Platform**: While many tools add APIs as afterthoughts, SymbioKnowledgeBase designs every feature API-first. The web UI consumes the same API that AI agents use. This is a novel architectural pattern in the knowledge management space.

2. **Graph + Structured Data Unification**: No existing open-source tool combines Obsidian's wikilink-driven knowledge graph with Notion's typed database properties. This combination enables a new workflow: AI agents create structured data (database rows with typed properties) that automatically become nodes in the knowledge graph through wikilinks.

3. **AI-Agnostic Knowledge Worker Pattern**: The platform treats AI agents as first-class citizens with their own authentication (API keys), full CRUD capabilities, and structured responses — but without coupling to any specific AI provider. This enables a "knowledge worker" pattern where any LLM can plug in.

### Validation Approach

- **API-first validation**: Build the REST API before the web UI; validate that all CRUD operations work programmatically before adding the human interface
- **Graph + database validation**: Test that database rows with wikilinks correctly appear as graph nodes; validate bidirectional linking between structured and unstructured content
- **AI agent testing**: Create an automated test agent that performs realistic workflows (create page, add blocks, link pages, search) to validate the full AI interaction path

### Risk Mitigation

- **Block editor complexity risk**: Mitigate by using proven open-source editor (TipTap/BlockNote) rather than building from scratch
- **Graph performance risk**: Mitigate by using react-force-graph with WebGL renderer for large graphs; set MVP limit at 1,000 nodes
- **API design risk**: Mitigate by following Notion's public API design patterns (well-documented, battle-tested) while extending for graph and wikilink features

## Web Application Specific Requirements

### Project-Type Overview

SymbioKnowledgeBase is a full-stack web application with:
- **Frontend**: Next.js (React) with server-side rendering for initial page loads and client-side navigation for app-like experience
- **Backend**: Node.js (Fastify) REST API server
- **Database**: PostgreSQL with JSONB for flexible block content storage
- **Deployment**: Docker Compose with separate containers for frontend, API, and database

### Technical Architecture Considerations

**Browser Support:**
- Chrome 90+, Firefox 90+, Safari 15+, Edge 90+ (modern evergreen browsers)
- No IE11 support required
- Responsive design for desktop and tablet viewports (mobile viewport is out of MVP scope but layout should not break)

**SPA/SSR Hybrid:**
- Server-side rendering for initial page load (SEO not critical, but improves Time to Interactive)
- Client-side navigation for page-to-page transitions within the app
- API calls from both server components (initial data) and client components (interactive updates)

**Real-Time Considerations (MVP):**
- No real-time collaboration in MVP
- Client-side state management handles single-user editing
- Page content fetched on navigation; no WebSocket connections in MVP

**Authentication Architecture:**
- Session-based authentication for web UI (NextAuth.js or custom JWT)
- API key authentication for AI agent access (separate from web sessions)
- Both auth methods resolve to the same tenant ID for data isolation

### Responsive Design

- Primary viewport: desktop (1280px+)
- Secondary viewport: tablet landscape (1024px)
- Layout must not break on smaller viewports but feature parity not required below 1024px
- Sidebar collapses to hamburger menu on narrow viewports

### Implementation Considerations

- TipTap or BlockNote for block editor (evaluate during architecture phase)
- react-force-graph or D3.js for knowledge graph (evaluate during architecture phase)
- Tailwind CSS for styling with CSS custom properties for theme switching
- PostgreSQL full-text search with `tsvector` for MVP; Meilisearch planned for post-MVP
- JSONB storage for block content enables flexible schema evolution

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Problem-solving MVP — deliver the minimum feature set that solves the core problem (AI-created knowledge that humans can browse and discover connections) with sufficient quality that early users adopt it as their primary documentation tool.

**Resource Requirements:** 1-2 developers, 3-month timeline. Full-stack TypeScript (Next.js + Fastify + PostgreSQL) enables a single developer to work across the entire stack.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Journey 1 (Dr. Lisa — AI-assisted documentation): Full support
- Journey 2 (AI Agent — programmatic CRUD): Full support
- Journey 3 (Martin — deployment and admin): Basic support (Docker deploy, user management)
- Journey 4 (New researcher — onboarding): Basic support (manual exploration, no guided onboarding)

**Must-Have Capabilities:**
1. Block editor with 12+ block types (paragraph, H1-H3, bullet list, numbered list, to-do, toggle, quote, divider, callout, code block, image, bookmark)
2. Slash command (`/`) for block type insertion
3. Drag-and-drop block reordering
4. Rich text formatting (bold, italic, strikethrough, inline code, link)
5. Nested page hierarchy with sidebar tree navigation
6. Page icons (emoji) and cover images
7. Breadcrumb navigation
8. `[[Wikilink]]` syntax with autocomplete suggestions
9. `[[Page Name|Display Text]]` alias support
10. Backlinks panel per page
11. Automatic link updating on page rename
12. Full-text search across all user pages
13. Search-as-you-type with result previews
14. Quick switcher (Cmd/Ctrl+K)
15. Global knowledge graph view (force-directed)
16. Local graph view per page (N-degree connections)
17. Graph interaction: zoom, pan, click-to-navigate
18. REST API: full CRUD for pages and blocks
19. REST API: search endpoint
20. REST API: graph data endpoint
21. REST API: backlink query endpoint
22. API key authentication per user
23. OpenAPI/Swagger documentation
24. Database creation with typed properties (Title, Text, Number, Select, Multi-select, Date, Checkbox, URL)
25. Table view with filtering and sorting
26. Database rows as full pages
27. User registration and login
28. Private workspace per user (tenant isolation)
29. Light and dark mode
30. Docker Compose deployment

### Post-MVP Features

**Phase 2 (Post-MVP — v1.1-v1.5):**
- Database views: Board (Kanban), Calendar, Gallery, List
- Relation and Rollup database properties
- Formula properties
- Templates system (page and database templates)
- Import/Export (Markdown, CSV, Obsidian vault)
- Page version history with rollback
- Comments (inline and page-level)
- File attachments (PDF, audio, video)
- Webhook system for event-driven integrations

**Phase 3 (Expansion — v2.0+):**
- ChemELN bidirectional integration
- exPTube video embedding and auto-page creation
- Semantic search with pgvector
- Real-time collaboration (WebSocket co-editing)
- Mobile app (PWA or native)
- Canvas/whiteboard
- Database automations
- Plugin system
- AI Q&A (natural language queries against workspace content)

### Risk Mitigation Strategy

**Technical Risks:**
- Block editor complexity → Use proven open-source library (TipTap/BlockNote), not custom-built
- Knowledge graph performance at scale → WebGL rendering via react-force-graph; MVP cap at 1,000 nodes; lazy loading for larger graphs
- PostgreSQL FTS limitations → Adequate for MVP; Meilisearch migration path planned for post-MVP

**Market Risks:**
- Users prefer existing tools (Notion, Obsidian) → Differentiate through AI-first API that no competitor offers in open-source form
- MVP feature gap too large vs. Notion → Focus on the unique AI+graph combination rather than matching Notion feature-for-feature

**Resource Risks:**
- Single developer bottleneck → TypeScript full-stack enables one developer to ship MVP; proven libraries reduce custom code
- Scope creep → Hard MVP boundary: 30 must-have capabilities listed above, nothing else until all 30 are complete

## Functional Requirements

### Page Management

- FR1: Users can create new pages with a title, optional emoji icon, and optional cover image
- FR2: Users can nest pages to unlimited depth within a hierarchical page tree
- FR3: Users can rename pages, and all wikilinks referencing the renamed page update automatically
- FR4: Users can delete pages, with dependent wikilinks displaying as broken/unresolved links
- FR5: Users can view a sidebar showing the full page tree with expandable/collapsible nodes
- FR6: Users can navigate pages via breadcrumb trail showing the full page hierarchy path
- FR7: Users can reorder pages within the sidebar via drag-and-drop

### Block Editor

- FR8: Users can add blocks of the following types to a page: paragraph, heading (H1, H2, H3), bulleted list, numbered list, to-do list (with checkbox), toggle (collapsible), blockquote, divider, callout (with icon and color), code block (with syntax highlighting and language selection), image (via URL or upload), and bookmark (URL with preview)
- FR9: Users can insert blocks via a slash command menu (`/`) that filters available block types as the user types
- FR10: Users can reorder blocks within a page via drag-and-drop
- FR11: Users can apply rich text formatting within text blocks: bold, italic, strikethrough, inline code, and hyperlink
- FR12: Users can convert a block from one type to another (e.g., paragraph to heading, bullet list to numbered list)
- FR13: Users can delete individual blocks from a page
- FR14: Users can undo and redo editing operations within a page session

### Wikilinks & Backlinks

- FR15: Users can create wikilinks by typing `[[` followed by a page name, with autocomplete suggestions from existing pages
- FR16: Users can create aliased wikilinks using `[[Page Name|Display Text]]` syntax
- FR17: Users can view a backlinks panel on each page showing all pages that link to the current page
- FR18: Users can click a wikilink to navigate directly to the linked page
- FR19: The system resolves wikilinks by internal page ID so that page renames do not break existing links

### Search & Navigation

- FR20: Users can perform full-text search across all pages in their workspace
- FR21: Users can view search results with page title, matching text snippets, and relevance ranking
- FR22: Users can search with instant results as they type (search-as-you-type)
- FR23: Users can open a quick switcher overlay (Cmd/Ctrl+K) to search and navigate to any page by name
- FR24: Users can navigate to a page directly from a search result

### Knowledge Graph

- FR25: Users can view a global knowledge graph showing all pages as nodes and wikilinks as edges in a force-directed layout
- FR26: Users can view a local graph for a specific page showing N-degree connections (pages linked within N hops)
- FR27: Users can click a node in the graph to navigate to the corresponding page
- FR28: Users can zoom, pan, and drag nodes to explore the graph
- FR29: Users can filter graph nodes by basic criteria (e.g., pages created in date range, pages with specific properties)

### REST API for AI Agents

- FR30: AI agents can create pages with title, icon, cover, and block content via `POST /api/pages`
- FR31: AI agents can read page content and metadata via `GET /api/pages/:id`
- FR32: AI agents can update page metadata and block content via `PUT /api/pages/:id`
- FR33: AI agents can delete pages via `DELETE /api/pages/:id`
- FR34: AI agents can create, read, update, and delete individual blocks via `/api/blocks` endpoints
- FR35: AI agents can search content via `GET /api/search?q=term` and receive results with page IDs, titles, and matching snippets
- FR36: AI agents can retrieve knowledge graph data (nodes and edges) via `GET /api/graph`
- FR37: AI agents can query backlinks for a page via `GET /api/pages/:id/backlinks`
- FR38: AI agents can list all pages in their workspace via `GET /api/pages` with pagination, filtering, and sorting
- FR39: The API returns consistent JSON response structures with appropriate HTTP status codes (200, 201, 400, 401, 404, 500)
- FR40: The API provides OpenAPI 3.0 specification documentation accessible via Swagger UI

### Database

- FR41: Users can create database pages with typed property columns (Title, Text, Number, Select, Multi-select, Date, Checkbox, URL)
- FR42: Users can add rows to a database, where each row is a full page with properties
- FR43: Users can view database content in a table view with sortable and filterable columns
- FR44: Users can edit property values inline within the table view
- FR45: Users can define Select and Multi-select property options with custom labels
- FR46: AI agents can create and manage databases and their rows via the REST API

### User Management & Multi-Tenancy

- FR47: Users can register an account with email and password
- FR48: Users can log in and receive an authenticated session for the web UI
- FR49: Users can generate and revoke API keys for AI agent access from their account settings
- FR50: Each user has a private workspace that is completely isolated from all other users' data
- FR51: Admin users can create, deactivate, and manage user accounts

### Theming & UI

- FR52: Users can switch between light and dark mode
- FR53: The application persists the user's theme preference across sessions
- FR54: The UI renders with a clean, Notion-inspired aesthetic with consistent spacing, typography, and color system

## Non-Functional Requirements

### Performance

- NFR1: Page load time (Time to Interactive) shall be under 1 second for pages with up to 100 blocks, as measured by Lighthouse in a standard broadband environment
- NFR2: REST API CRUD operations shall respond in under 200ms for 95th percentile requests under normal load (10 concurrent users), as measured by server-side request logging
- NFR3: Full-text search shall return results in under 2 seconds for workspaces with up to 10,000 blocks, as measured by API response time
- NFR4: Knowledge graph shall render up to 1,000 nodes at 30+ frames per second in Chrome 90+, as measured by browser performance profiling
- NFR5: Block editor input latency shall be under 50ms for typing and formatting operations, as measured by browser performance monitoring

### Security

- NFR6: All web traffic shall be served over HTTPS with TLS 1.2+
- NFR7: User passwords shall be hashed using bcrypt with a minimum cost factor of 10
- NFR8: API keys shall be generated as cryptographically random 256-bit tokens and stored as hashed values in the database
- NFR9: All database queries shall include tenant ID filtering to prevent cross-tenant data access; no endpoint shall return data belonging to another user
- NFR10: Session tokens shall expire after 24 hours of inactivity; API keys shall not expire but can be revoked by the user
- NFR11: All user input shall be sanitized to prevent XSS, SQL injection, and other injection attacks

### Scalability

- NFR12: The system shall support 10 concurrent users at 3 months and 50+ concurrent users at 12 months, as measured by load testing with realistic user scenarios
- NFR13: The PostgreSQL database shall handle 100,000+ blocks and 10,000+ pages per tenant without query performance degradation beyond 20%, as measured by query execution plans
- NFR14: The application architecture shall support horizontal scaling of the API layer via additional Docker containers behind a load balancer (not required for MVP, but architecture must not preclude it)

### Reliability

- NFR15: System uptime shall be 95% at 3 months and 99.5% at 12 months, as measured by external health check monitoring
- NFR16: Database operations shall be transactional: multi-block updates either fully succeed or fully roll back, with no partial state
- NFR17: The system shall recover from container crashes via Docker restart policies without data loss

### Accessibility

- NFR18: The web UI shall support keyboard navigation for all primary workflows (page navigation, block editing, search, graph interaction)
- NFR19: The web UI shall maintain WCAG 2.1 Level A compliance for text contrast ratios and interactive element labeling

### Integration

- NFR20: The REST API shall conform to OpenAPI 3.0 specification with machine-readable schema available at a public endpoint
- NFR21: API responses shall use consistent JSON structures with ISO 8601 timestamps, UUID identifiers, and standard HTTP status codes
- NFR22: The block content schema (JSONB) shall be extensible: adding new block types shall not require database schema migration

---

*PRD created: 2026-02-21*
*Author: Martin (Product Owner, SciSymbioAI)*
*BMAD Workflow: create-prd (steps 1-12 complete)*
