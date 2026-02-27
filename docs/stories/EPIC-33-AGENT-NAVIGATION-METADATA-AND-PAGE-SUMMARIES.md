# Epic 33: Agent Navigation Metadata & Page Summaries

**Epic ID:** EPIC-33
**Created:** 2026-02-27
**Total Story Points:** 19
**Priority:** High
**Status:** Done
**Completed:** 2026-02-27
**Notes:** All 5 stories implemented: page summary schema extension, LLM summary generation service (OpenAI/Anthropic), enriched page connections panel, frontmatter integration for filesystem mirror, agent page tree API with filtering.

---

## Epic Overview

Epic 33 adds **two-tier page summaries** and an **enriched link navigation system** designed to make SymbioKnowledgeBase optimally navigable by AI agents. Every page gets a machine-readable **one-liner** (a few words) and a **short paragraph summary** (2-4 sentences). These summaries appear in the UI, in the filesystem mirror's frontmatter, and in API responses — giving agents (and humans) the ability to quickly assess whether a linked page is worth opening.

### Why This Matters

When an agent navigates a knowledge graph, it faces a classic exploration-vs-exploitation trade-off. Without summaries, the agent must either:
1. **Open every linked page** to understand it (expensive, slow), or
2. **Guess from the title alone** (cheap, often wrong — "Notes" could be anything)

Two-tier summaries solve this by providing **progressive disclosure**:
- **Tier 1 — One-liner** (~10 words): Enough to decide "maybe relevant" vs "definitely not." Costs almost nothing to process. Shown in link lists, graph tooltips, page tree views.
- **Tier 2 — Summary paragraph** (2-4 sentences): Enough to understand scope and content focus. Shown in expanded link panels. Lets the agent make an informed decision before opening the full page.

This reduces agent navigation cost by an estimated 60-80% — most irrelevant pages can be filtered at Tier 1 without ever loading content.

### What Already Exists

- **Page model** (`prisma/schema.prisma:182-223`) — Has `title`, `icon`, `coverUrl`, but NO summary or description fields.
- **BacklinksPanel** (`src/components/page/BacklinksPanel.tsx`) — Shows incoming links with title + icon. No summaries.
- **useForwardLinks hook** (`src/hooks/useBacklinks.ts:46-66`) — Fetches outgoing links. No summaries attached.
- **Graph tooltips** (`src/components/graph/GraphView.tsx`) — Show title + link count on hover. No summary.
- **plainText field** (`Block.plainText`) — Denormalized text for search, but it's raw content, not a summary.
- **Markdown serializer** — Emits YAML frontmatter. Can be extended with summary fields.

### What This Epic Adds

1. **Schema extension** — `oneLiner`, `summary`, `summaryUpdatedAt`, `lastAgentVisitAt` fields on Page model
2. **LLM summary generation** — Service that generates both tiers from page content, triggered by change-threshold detection
3. **Enriched Page Connections panel** — Unified section showing forward links + backlinks with summaries
4. **Frontmatter integration** — Summaries appear in `.md` file frontmatter for agent filesystem browsing
5. **Agent page tree API** — Lightweight endpoint listing all pages with one-liners for rapid scanning

**Out of scope:**
- Automatic agent sweep/maintenance (that's EPIC-34)
- Semantic search using embeddings
- Multi-language summary generation

**Dependencies:**
- TipTap editor with block content (done)
- BacklinksPanel and useBacklinks/useForwardLinks hooks (done)
- PageLink model and wikilink indexing (done)
- EPIC-31 filesystem mirror (for frontmatter integration)
- LLM API key configuration (OpenAI/Anthropic — user must provide)

---

## Business Value

- **Agent efficiency:** 60-80% fewer page loads during knowledge graph navigation. Agents make informed decisions from summaries alone.
- **Human UX:** Users see what linked pages are about without clicking through. The Connections panel becomes a "table of contents" for related content.
- **Knowledge discovery:** Summaries surface the essence of each page, making it easier to spot connections and gaps in the knowledge base.
- **Filesystem browsing:** Agents reading `.md` files get summaries in frontmatter — no need to parse full content to understand a page.

---

## Architecture Summary

```
Summary Generation Flow:
────────────────────────

User saves page (via auto-save or manual)
        │
        ▼
1. Auto-save triggers PUT /api/pages/{id}/blocks
2. After successful DB write:
   a. Compute change ratio:
      changeRatio = levenshtein(oldPlainText, newPlainText) / max(len(old), len(new))
   b. If changeRatio > SUMMARY_THRESHOLD (default 0.10):
      → Queue summary regeneration
   c. If changeRatio <= SUMMARY_THRESHOLD:
      → Skip (typo fix, minor edit — not worth regenerating)
        │
        ▼
3. Summary generation (async, non-blocking):
   a. Read page plainText (or full content for context)
   b. Call LLM with structured prompt:
      - Generate ONE-LINER: max 12 words, describes the page's purpose
      - Generate SUMMARY: 2-4 sentences, covers scope, key topics, value
   c. Update Page record: oneLiner, summary, summaryUpdatedAt = now()
   d. If filesystem mirror active → update frontmatter in .md file
        │
        ▼
4. Cache invalidation:
   - Invalidate React Query cache for this page
   - Invalidate cache for pages that link to this page (their Connections panel shows this summary)


Two-Tier Display:
─────────────────

┌─────────────────────────────────────────────────────┐
│ Page: API Authentication Guide                       │
│                                                      │
│ [...page content...]                                 │
│                                                      │
│ ─── Page Connections ─────────────────────────────── │
│                                                      │
│ ▶ Outgoing Links (3)                                │
│   🔑 JWT Token Reference                            │
│       "Standard JWT claims and signing algorithms"   │
│   📡 REST API Overview                              │
│       "Endpoint catalog for the public REST API"     │
│   🛡️ Rate Limiting                                  │
│       "Request rate limits and throttling policies"  │
│                                                      │
│ ▶ Backlinks (2)                                     │
│   📖 Getting Started Guide                          │
│       "Onboarding guide for new API consumers"       │
│   🔧 Troubleshooting                                │
│       "Common errors and debugging procedures"       │
│                                                      │
│ ─── About This Page ────────────────────────────── │
│                                                      │
│ One-liner: How to authenticate API requests via JWT  │
│ Summary: Covers JWT setup, token refresh flow,       │
│   middleware configuration, and error handling for    │
│   the REST API. Includes examples for client-side    │
│   and server-side implementations.                   │
│   [✏️ Edit] [🔄 Regenerate]                          │
│                                                      │
│ ─── Local Graph ────────────────────────────────── │
│   [graph visualization]                              │
└─────────────────────────────────────────────────────┘


Frontmatter in .md Files:
─────────────────────────

---
id: "page-uuid"
title: "API Authentication Guide"
icon: "🔑"
oneLiner: "How to authenticate API requests via JWT"
summary: "Covers JWT setup, token refresh flow, middleware configuration, and error handling for the REST API. Includes examples for client-side and server-side implementations."
summaryUpdatedAt: "2026-02-27T14:30:00Z"
parent: "parent-uuid"
position: 2
spaceType: "PRIVATE"
created: "2026-02-20T10:00:00Z"
updated: "2026-02-27T14:25:00Z"
---

# API Authentication Guide

[...page content...]


Agent Page Tree API Response:
─────────────────────────────

GET /api/agent/pages?format=tree

{
  "pages": [
    {
      "id": "uuid-1",
      "title": "Projects",
      "icon": "📁",
      "oneLiner": "Active and archived project documentation",
      "childCount": 5,
      "linkCount": 12,
      "updatedAt": "2026-02-27T14:25:00Z",
      "children": [
        {
          "id": "uuid-2",
          "title": "Alpha",
          "icon": "🚀",
          "oneLiner": "ML pipeline for drug discovery",
          "childCount": 0,
          "linkCount": 8,
          "updatedAt": "2026-02-26T09:00:00Z"
        }
      ]
    }
  ],
  "totalPages": 42,
  "pagesWithSummaries": 38,
  "staleCount": 4
}
```

---

## Stories Breakdown

### SKB-33.1: Page Summary Schema Extension — 3 points, High

**Delivers:** Prisma schema migration adding `oneLiner`, `summary`, `summaryUpdatedAt`, and `lastAgentVisitAt` fields to the Page model. Updated TypeScript types. API endpoints for reading and updating summaries. A small "About This Page" UI section below the page content for viewing and manually editing summaries.

**Depends on:** Nothing (foundational)

---

### SKB-33.2: LLM Summary Generation Service — 5 points, High

**Delivers:** A service that takes page content and generates one-liner + summary via LLM. Change-threshold detection that only triggers regeneration when content changes substantially (>10% diff ratio). Async non-blocking execution. LLM provider abstraction (supports OpenAI and Anthropic). Batch generation command for existing pages. Rate limiting and cost tracking.

**Depends on:** SKB-33.1 (summary fields must exist in schema)

---

### SKB-33.3: Enriched Page Connections Panel — 5 points, Medium

**Delivers:** A unified "Page Connections" section replacing the current BacklinksPanel. Shows both forward links (outgoing wikilinks) and backlinks (incoming), each displaying the target page's icon, title, and one-liner. Expandable rows reveal the full summary paragraph. Collapsible sections with counts. Click to navigate.

**Depends on:** SKB-33.1 (summaries must exist to display)

---

### SKB-33.4: Frontmatter Integration for Filesystem Mirror — 3 points, Medium

**Delivers:** The Markdown serializer emits `oneLiner` and `summary` in YAML frontmatter. The deserializer reads and updates these fields when parsing `.md` files. Agents editing frontmatter summaries directly in `.md` files see their changes reflected in the database. Template frontmatter for new pages includes empty summary placeholders.

**Depends on:** SKB-33.1, EPIC-31 SKB-31.3 (serializer and mirror must exist)

---

### SKB-33.5: Agent Page Tree API — 3 points, Medium

**Delivers:** A lightweight API endpoint (`GET /api/agent/pages`) that returns all pages with their one-liners, hierarchically structured. Supports `?format=tree` (nested) and `?format=flat` (list). Includes metadata: childCount, linkCount, updatedAt, summaryStale flag. Pagination for large knowledge bases. Designed for agents to quickly scan the entire knowledge base structure.

**Depends on:** SKB-33.1 (summary fields must exist)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 33.1 | Field validation; TypeScript type correctness; API input validation | Migration runs cleanly; CRUD operations on summary fields; API returns summaries | Edit summary in UI → saved to DB |
| 33.2 | Change ratio calculation; threshold logic; LLM prompt construction; rate limiting | Save page with big change → summary regenerated; save with typo → summary NOT regenerated; batch generation | N/A (LLM calls mocked in tests) |
| 33.3 | Component renders forward + back links; expand/collapse logic; empty states | Panel loads with real data; shows one-liners; click navigates | Expand link → see summary paragraph |
| 33.4 | Frontmatter serialization with summaries; deserialization reads summaries | Serialize page with summary → .md has frontmatter; edit .md frontmatter → DB updated | N/A |
| 33.5 | Tree building; flat list generation; pagination; stale flag calculation | API returns all pages with one-liners; tree format matches hierarchy; pagination works | N/A |

---

## Implementation Order

```
┌────────┐
│ 33.1   │──┬──▶ SKB-33.2 (LLM Generation)
│Schema  │  │
│Extend  │  ├──▶ SKB-33.3 (Connections Panel)
│        │  │
│        │  ├──▶ SKB-33.4 (Frontmatter)
│        │  │
│        │  └──▶ SKB-33.5 (Agent Page Tree API)
└────────┘

33.1 is the foundation — all other stories depend on it.
33.2, 33.3, 33.4, 33.5 are independent and can be worked in parallel.
```

---

## Shared Constraints

- **LLM Provider:** Support both OpenAI (gpt-4o-mini) and Anthropic (claude-3-haiku) for cost-effective summary generation. Configurable via `SUMMARY_LLM_PROVIDER` and `SUMMARY_LLM_MODEL` env vars.
- **Change Threshold:** Default 10% (configurable via `SUMMARY_CHANGE_THRESHOLD`). Measured as Levenshtein-like character diff ratio on plainText.
- **Summary Length Limits:** One-liner max 100 characters. Summary max 500 characters. Enforced in DB and API validation.
- **Async Generation:** Summary generation is non-blocking. The page save completes immediately; summary updates arrive later via cache invalidation.
- **Graceful Degradation:** If no LLM API key is configured, summary generation is silently disabled. Manual editing still works. All UI components handle null summaries gracefully.
- **Multi-Tenant Isolation:** Summaries are per-page, pages are per-tenant. No cross-tenant data leakage.
- **TypeScript Strict:** No `any` types. Full type safety.

---

## Files Created/Modified by This Epic

### New Files
- `src/lib/summary/SummaryService.ts` — LLM-powered summary generation with change detection
- `src/lib/summary/changeDetection.ts` — Diff ratio calculation and threshold logic
- `src/lib/summary/prompts.ts` — LLM prompt templates for one-liner and summary generation
- `src/lib/summary/types.ts` — Summary-related TypeScript types
- `src/lib/summary/config.ts` — Summary configuration (thresholds, limits, LLM settings)
- `src/app/api/pages/[id]/summary/route.ts` — GET/PUT summary endpoints
- `src/app/api/pages/[id]/summary/generate/route.ts` — POST trigger summary regeneration
- `src/app/api/agent/pages/route.ts` — Agent page tree API
- `src/components/page/PageConnectionsPanel.tsx` — Enriched connections panel (replaces BacklinksPanel)
- `src/components/page/PageAboutSection.tsx` — "About This Page" section with summary display/edit
- `src/hooks/usePageSummary.ts` — React hook for summary data
- `src/hooks/usePageConnections.ts` — React hook for forward + back links with summaries
- `scripts/generate-summaries.ts` — CLI batch generation for existing pages
- Tests for all components

### Modified Files
- `prisma/schema.prisma` — Add oneLiner, summary, summaryUpdatedAt, lastAgentVisitAt to Page
- `src/types/page.ts` — Add summary fields to Page interface
- `src/app/api/pages/[id]/blocks/route.ts` — Hook into summary change detection after save
- `src/app/api/pages/[id]/backlinks/route.ts` — Include oneLiner in backlink responses
- `src/app/api/pages/[id]/links/route.ts` — Include oneLiner in forward link responses
- `src/lib/markdown/serializer.ts` — Add oneLiner and summary to frontmatter
- `src/lib/markdown/deserializer.ts` — Parse oneLiner and summary from frontmatter
- `src/components/graph/GraphView.tsx` — Show one-liner in graph tooltips
- `.env.example` — Add LLM and summary configuration variables
- `package.json` — Add `openai` and/or `@anthropic-ai/sdk` dependencies

---

**Last Updated:** 2026-02-27
