# Epic 51: Chemistry KB — Voice Agent Integration

**Epic ID:** EPIC-51
**Created:** 2026-03-23
**Total Story Points:** 68
**Priority:** High
**Status:** Not Started
**Dependencies:** EPIC-45 (Chemistry KB Data Model), EPIC-46 (Chemistry KB Retrieval), EPIC-47 (Incremental Sync)
**Cross-Codebase:** SymbioKnowledgeBase (SKB-51.x) + SciSymbioLens (SSL EPIC-32)

---

## Epic Overview

Epic 51 bridges the Chemistry Knowledge Base in SymbioKnowledgeBase with the SciSymbioLens voice agent (Gemini Live API). The goal: when a researcher starts a new experiment, the voice agent automatically retrieves best practices, institutional knowledge, and experimental procedures from the Chemistry KB — and after experiments, captures learnings back into the KB.

This is a **cross-codebase epic**. Stories prefixed `SKB-51.x` modify SymbioKnowledgeBase. Stories in SSL `EPIC-32` modify SciSymbioLens. Shared contracts (API schemas, tool definitions) are documented in both.

### Why This Matters

1. **Institutional knowledge at the bench**: Researchers currently lose tribal knowledge — what worked, what failed, optimal conditions. The Chemistry KB captures this; the voice agent delivers it hands-free while they work.
2. **Zero-friction capture**: Post-experiment debrief via voice is faster than typing notes. Smart triggers ensure it only activates when valuable (repeated reactions, anomalous results).
3. **Cross-organizational learning**: Best practices from one researcher benefit everyone. The three-tier model (Private → Team → Agent) ensures knowledge flows upward while keeping drafts private.
4. **Adjustable depth**: Simple experiments get lightweight context. Complex or novel reactions trigger deep KB searches with full graph traversal.

### Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  SciSymbioLens      │     │  Clawdbot Gateway    │     │  SKB Server     │
│  (iOS Voice Agent)  │────▶│  (FastAPI)           │────▶│  (Next.js)      │
│                     │     │                      │     │                 │
│  Gemini Live API    │     │  /tools/invoke       │     │  Agent API      │
│  System Prompt      │     │  search_knowledge    │     │  /api/agent/    │
│  ← KB Context       │     │  _base tool          │     │  pages, search  │
│                     │     │                      │     │  experiment-    │
│  Post-Experiment    │     │  /tools/invoke       │     │  context        │
│  Debrief Triggers   │     │  capture_learning    │     │                 │
│                     │     │  tool                │     │  Promotion API  │
└─────────────────────┘     └──────────────────────┘     │  Private→Team  │
                                                          └─────────────────┘
```

### Three-Tier Knowledge Model

| Tier | SpaceType | Visibility | Purpose |
|------|-----------|------------|---------|
| **Private** | PRIVATE | Researcher only | Draft notes, in-progress experiments |
| **Team / Chemistry KB** | TEAM | All org members | Institutional knowledge, best practices, validated procedures |
| **Agent** | AGENT | System only | Operational data, sync metadata, generated summaries |

### What Already Exists

- **Chemistry KB hierarchy** (EPIC-45) — Root + 5 category pages, sample data, templates
- **Chemistry KB retrieval** (EPIC-46) — Index page, contextual search tags, find-similar workflows
- **Incremental sync** (EPIC-47) — Change detection, propagation, entity handling, aggregation refresh
- **Agent API** — Full CRUD at `/api/agent/pages/` with Bearer token auth (`skb_*` keys)
- **Search API** — Full-text search via tsvector at `/api/search`
- **Teamspace model** — `SpaceType` enum (PRIVATE, TEAM, AGENT), role-based access (OWNER, ADMIN, MEMBER, GUEST)
- **SciSymbioLens voice agent** — Gemini Live API with WebSocket, `pendingConversationContext` for system prompt injection, `ask_clawdbot` tool
- **Clawdbot Gateway** — FastAPI with `/tools/invoke`, persona loading, SSE streaming

### What This Epic Adds

**SymbioKnowledgeBase (SKB-51.x):**
1. **Team space migration** — Move Chemistry KB from PRIVATE to TEAM space with proper teamspace assignment
2. **Experiment context endpoint** — Pre-assembled KB context for voice agent consumption
3. **Search depth API** — Configurable search depth levels (Default/Medium/Deep)
4. **Promotion workflow** — Move pages from Private to Team Chemistry KB with validation
5. **Conflict detection** — Detect and resolve conflicting institutional knowledge entries
6. **Aggregation auto-refresh webhook** — Trigger aggregation refresh when new KB entries arrive

**SciSymbioLens (SSL EPIC-32):**
7. **KB context pre-fetch on session start** — Load experiment context into Gemini system prompt
8. **`search_knowledge_base` Clawdbot tool** — On-demand KB queries during conversation
9. **Multi-experiment context management** — Handle 2-3 simultaneous experiments in context window
10. **Post-experiment debrief triggers** — Smart detection of when to capture learnings
11. **`capture_learning` Clawdbot tool** — Write debrief insights back to KB
12. **Experiment switching UX** — Voice commands to switch active experiment context

---

## Stories

### SymbioKnowledgeBase Stories (SKB-51.x)

| ID | Title | Points | Priority | Status | Depends On |
|----|-------|--------|----------|--------|------------|
| SKB-51.1 | Move Chemistry KB to Team Space | 3 | High | Planned | EPIC-45 |
| SKB-51.2 | Experiment Context Endpoint | 5 | High | Planned | SKB-51.1 |
| SKB-51.3 | Search Depth Levels API | 5 | High | Planned | EPIC-46 |
| SKB-51.4 | Promotion Workflow (Private → Team) | 5 | Medium | Planned | SKB-51.1 |
| SKB-51.5 | Conflict Detection in Institutional Knowledge | 5 | Medium | Planned | SKB-51.4 |
| SKB-51.6 | Aggregation Auto-Refresh Webhook | 3 | Medium | Planned | EPIC-47 |
| SKB-51.7 | Agent API: Bulk Context Fetch | 3 | High | Planned | SKB-51.2 |
| SKB-51.8 | Cross-Codebase API Contract Tests | 3 | High | Planned | SKB-51.2, SKB-51.3 |

### SciSymbioLens Stories (SSL EPIC-32)

| ID | Title | Points | Priority | Status | Depends On |
|----|-------|--------|----------|--------|------------|
| SSL-32.1 | KB Context Pre-Fetch Service | 5 | High | Planned | SKB-51.2 |
| SSL-32.2 | Inject KB Context into Gemini System Prompt | 5 | High | Planned | SSL-32.1 |
| SSL-32.3 | `search_knowledge_base` Clawdbot Tool | 5 | High | Planned | SKB-51.3 |
| SSL-32.4 | Multi-Experiment Context Manager | 5 | Medium | Planned | SSL-32.2 |
| SSL-32.5 | Experiment Switching Voice Commands | 3 | Medium | Planned | SSL-32.4 |
| SSL-32.6 | Post-Experiment Debrief Triggers | 5 | High | Planned | SSL-32.2 |
| SSL-32.7 | `capture_learning` Clawdbot Tool | 3 | High | Planned | SSL-32.6, SKB-51.4 |
| SSL-32.8 | Debrief UX and Conversation Flow | 3 | Medium | Planned | SSL-32.6 |

---

## Shared API Contracts

### 1. Experiment Context Endpoint (SKB-51.2)

```
GET /api/agent/pages/experiment-context
Authorization: Bearer skb_xxx

Query Parameters:
  experimentId: string        — e.g., "EXP-2026-0042"
  depth: "default" | "medium" | "deep"  — search depth level
  include: string[]           — optional: "procedures", "chemicals", "bestPractices", "relatedExperiments"

Response (200):
{
  "experiment": {
    "id": "...",
    "title": "...",
    "oneLiner": "...",
    "procedures": "markdown string of experimental steps",
    "chemicals": [{ "name": "...", "safety": "...", "handling": "..." }],
    "reactionType": { "name": "...", "bestPractices": "..." },
    "researcher": { "name": "...", "expertise": "..." }
  },
  "institutionalKnowledge": {
    "bestPractices": ["...", "..."],
    "commonPitfalls": ["...", "..."],
    "relatedExperiments": [{ "id": "...", "title": "...", "outcome": "..." }],
    "tips": ["...", "..."]
  },
  "contextSize": 3200,
  "depth": "medium",
  "truncated": false
}
```

### 2. Search Knowledge Base (SKB-51.3)

```
GET /api/agent/search
Authorization: Bearer skb_xxx

Query Parameters:
  q: string                   — search query
  depth: "default" | "medium" | "deep"
  scope: "private" | "team" | "all"
  category: "experiments" | "chemicals" | "reactionTypes" | "researchers" | "substrateClasses"
  limit: number               — max results (default: 10)

Response (200):
{
  "results": [{
    "pageId": "...",
    "title": "...",
    "oneLiner": "...",
    "snippet": "...",
    "score": 0.85,
    "category": "experiments",
    "space": "team"
  }],
  "totalCount": 42,
  "depth": "medium",
  "searchTimeMs": 120
}
```

### 3. Capture Learning (SKB-51.4 + SKB-51.6)

```
POST /api/agent/pages/capture-learning
Authorization: Bearer skb_xxx

Body:
{
  "experimentId": "EXP-2026-0042",
  "learnings": [
    {
      "type": "best_practice" | "pitfall" | "optimization" | "observation",
      "content": "Use freshly opened THF for optimal results — old bottles show 10-15% yield drop",
      "confidence": "high" | "medium" | "low",
      "promoteTo": "team" | null
    }
  ],
  "debriefSummary": "Experiment completed successfully with 87% yield. Key finding: solvent freshness critical."
}

Response (201):
{
  "captured": 3,
  "promoted": 1,
  "conflictsDetected": 0,
  "pageUpdates": [{ "pageId": "...", "action": "appended" | "created" }]
}
```

---

## Success Metrics

- Voice agent retrieves relevant KB context in <2s on session start
- Researcher can ask "What are the best practices for Suzuki coupling?" and get institutional knowledge via voice
- Post-experiment debrief captures ≥1 useful learning per complex experiment
- Knowledge promotion from Private→Team requires <3 clicks
- Multi-experiment switching works via voice command ("Switch to experiment two")
- No cross-tenant data leakage in any KB operation

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini context window overflow with multi-experiment data | Agent loses context, hallucinations | Token budgeting per experiment (~15K tokens each for 3 experiments), priority-based truncation |
| Clawdbot Gateway latency for KB searches | Poor voice UX, long pauses | Pre-fetch on session start, cache frequently accessed KB data |
| Stale institutional knowledge after promotion | Incorrect best practices propagated | Conflict detection (SKB-51.5), version tracking, review workflow |
| Smart debrief triggers too aggressive/passive | User fatigue or missed learnings | Configurable sensitivity, experiment complexity scoring, user override |
| Cross-codebase API versioning | Breaking changes between SKB and SSL | Contract tests (SKB-51.8), semantic versioning on agent API |

---

## Implementation Order

**Phase 1 — Foundation (Week 1-2):**
- SKB-51.1: Team space migration
- SKB-51.2: Experiment context endpoint
- SKB-51.3: Search depth API

**Phase 2 — Voice Integration (Week 3-4):**
- SSL-32.1: KB context pre-fetch service
- SSL-32.2: Inject into Gemini system prompt
- SSL-32.3: `search_knowledge_base` tool
- SKB-51.7: Bulk context fetch
- SKB-51.8: Contract tests

**Phase 3 — Multi-Experiment (Week 5):**
- SSL-32.4: Multi-experiment context manager
- SSL-32.5: Experiment switching voice commands

**Phase 4 — Learning Capture (Week 6-7):**
- SSL-32.6: Post-experiment debrief triggers
- SSL-32.7: `capture_learning` tool
- SSL-32.8: Debrief UX
- SKB-51.4: Promotion workflow
- SKB-51.5: Conflict detection
- SKB-51.6: Aggregation auto-refresh webhook
