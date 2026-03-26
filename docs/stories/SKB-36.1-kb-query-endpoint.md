# Story SKB-36.1: Intelligent KB Query Endpoint

**Epic:** 36 — Dynamic Knowledge Base Retrieval for Voice & Chat
**Story ID:** SKB-36.1
**Story Points:** 5 | **Priority:** High | **Status:** Done
**Depends On:** None (foundational)
**Requested By:** SciSymbioLens Agent (via handover doc)

---

## User Story

As a voice agent or text chat user in SciSymbioLens,
I want to dynamically query the Chemistry Knowledge Base mid-conversation,
So that I can get structured, relevant answers about chemicals, procedures, safety, and institutional practices.

---

## Implementation

### New Files

| File | Purpose |
|------|---------|
| `src/lib/agent/kbQuery.ts` | Query engine: intent classification, entity extraction, graph traversal, block building, answer synthesis |
| `src/app/api/agent/kb-query/route.ts` | POST endpoint with validation, auth, error handling |

### How It Works

1. **Intent Classification** — Regex-based classification into 7 intents: safety, properties, procedure, expertise, related, reaction, general
2. **Entity Extraction** — Three strategies: (a) linked entities from experiment context, (b) match known page titles in query text (longest match wins), (c) fallback to depth search. Includes common chemical abbreviation mapping (NaOH → Sodium Hydroxide, etc.)
3. **Graph Traversal** — Fetches entity page content, outgoing links (1-hop), and backlinks (2-hop). Intent determines which sections are extracted from markdown.
4. **Context Block Building** — 8 typed blocks (chemical_safety, chemical_properties, procedure, institutional_practice, related_experiment, researcher_expertise, reaction_type, general_knowledge). Blocks capped at max_blocks (default 5).
5. **Answer Synthesis** — Concatenates top 2-3 blocks with intent-appropriate intro. Capped at 500 chars for voice speakability.

### API Contract

```
POST /api/agent/kb-query
Authorization: Bearer skb_live_xxx
Content-Type: application/json
```

```json
{
  "query": "What are the safety precautions for sodium hydroxide?",
  "experiment_id": "EXP-2026-0050",
  "session_id": "voice-session-uuid",
  "depth": "medium",
  "max_blocks": 5
}
```

Response: `{ success, data: { answer, context_blocks, query_metadata } }`

### Auth

Uses `withAgentAuth()` — same as all existing agent endpoints. Bearer token required.

---

## Answers to Handover Questions

1. **Does the knowledge graph have enough linked data?** — Yes. The seed script creates wikilinks between experiments ↔ chemicals ↔ reaction types ↔ researchers. `PageLink` records are created by `processAgentWikilinks()` during page creation. Graph traversal is functional.

2. **Are chemical names normalized?** — Partially. Page titles use full names (e.g., "Sodium Hydroxide"). The kb-query endpoint includes a built-in synonym map for common abbreviations (NaOH, HCl, H2SO4, EtOH, DMSO, THF, DCM, etc.) so that voice queries using short forms will match.

3. **What's the state of oneLiner/summary population?** — `oneLiner` is populated for all seeded pages (fixed in SKB-52.1). Pages created via sync endpoint get `oneLiner` from `fields.summary`. Auto-created pages from reconciliation also get `oneLiner`.

4. **How to find which experiment a chemical belongs to?** — Via `PageLink` table. Experiments link to chemicals via wikilinks (`[[Chemical Name]]`). The kb-query endpoint uses both outgoing links and backlinks to traverse this graph.

---

## Verification

```bash
# Safety query
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "safety precautions for sodium hydroxide", "depth": "medium"}'

# Experiment-scoped query
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "related experiments", "experiment_id": "EXP-2025-0001", "depth": "deep"}'

# Unknown topic (graceful empty response)
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "quantum chromodynamics"}'
```
