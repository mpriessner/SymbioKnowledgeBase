# Handover Document: SKB Agent — Dynamic KB Query Endpoint

**Date**: 2026-03-26
**From**: SciSymbioLens Agent
**To**: SymbioKnowledgeBase Agent
**Epic**: 36 — Dynamic Knowledge Base Retrieval for Voice & Chat

---

## Executive Summary

We need a new **intelligent query endpoint** on the SKB agent API that allows the SciSymbioLens voice agent and text chat to dynamically look up knowledge mid-conversation. This is not a raw search endpoint — it's an endpoint that **understands what the user is asking**, searches the knowledge graph with appropriate depth, and returns **structured context blocks** that get injected into the LLM's system prompt.

The consuming agents (Gemini on iOS) are not smart enough to parse raw search results. They need pre-digested, structured context that they can immediately use in conversation.

---

## What We Need From SKB

### One New Endpoint

```
POST /api/agent/kb-query
Authorization: Bearer skb_live_xxx
Content-Type: application/json
```

This is the only new endpoint required. Everything else (gateway proxy, iOS tool, context injection) is handled by other agents.

---

## Why This Can't Use the Existing Search Endpoint

The existing `POST /api/agent/search` returns raw search results:
- Page titles, snippets, IDs
- No structure (is this a chemical? a procedure? a safety warning?)
- No cross-referencing (chemical → safety data → handling → institutional practices)
- No answer synthesis
- Requires the consumer to interpret results

What we need is an endpoint that:
1. **Classifies the intent** — "What is NaOH safety?" → safety query → search chemical pages → extract safety blocks
2. **Traverses the graph** — NaOH page → linked safety data → linked handling procedures → linked institutional practices
3. **Returns typed context blocks** — so the voice agent knows "this is safety data" vs "this is a procedure" vs "this is an institutional tip"
4. **Provides a synthesized answer** — a natural language answer the voice agent can speak directly

---

## Detailed API Contract

### Request

```json
{
  "query": "What are the safety precautions for sodium hydroxide?",
  "experiment_id": "EXP-2026-0050",
  "session_id": "voice-session-uuid",
  "depth": "medium",
  "max_blocks": 5
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | **Yes** | — | Natural language question from the user |
| `experiment_id` | string | No | null | ELN experiment ID (e.g., "EXP-2026-0050"). When provided, scope results to this experiment's neighborhood first, then broaden |
| `session_id` | string | No | null | Voice/chat session ID. Can be used for future session-level caching or analytics |
| `depth` | enum | No | `"medium"` | `"default"` (title/oneliner only), `"medium"` (content + 1-hop links), `"deep"` (full graph traversal + institutional knowledge) |
| `max_blocks` | number | No | 5 | Maximum number of context blocks to return. Caller will cap at ~2000 chars total for system prompt injection |

### Response

```json
{
  "success": true,
  "data": {
    "answer": "Sodium hydroxide (NaOH) is a strong base that requires careful handling. Always wear chemical-resistant gloves, safety goggles, and work in a fume hood when handling concentrated solutions. Key rule: always add NaOH to water, never water to NaOH — the exothermic dissolution can cause dangerous splattering. Store in tightly sealed polyethylene containers away from acids.",
    "context_blocks": [
      {
        "type": "chemical_safety",
        "entity": "Sodium Hydroxide",
        "entity_id": "clmxxxxxx",
        "content": "Strong base, pH 14 (1M). Causes severe chemical burns on skin and eye contact. Generates heat when dissolved in water. PPE required: chemical-resistant nitrile gloves, splash-proof safety goggles, lab coat. Use fume hood for concentrated solutions (>1M). First aid: flush affected area with water for minimum 15 minutes, seek medical attention.",
        "relevance": 0.95,
        "source_page": "Sodium Hydroxide"
      },
      {
        "type": "institutional_practice",
        "entity": null,
        "entity_id": null,
        "content": "Lab standard: always add NaOH to water, never reverse. Use ice bath when dissolving >10g. Prepare stock solutions in the dedicated base preparation area (Room 204, fume hood #3). Label all NaOH solutions with concentration AND preparation date. Discard solutions older than 6 months (CO2 absorption degrades concentration).",
        "relevance": 0.88,
        "source_page": "Base Handling Best Practices"
      },
      {
        "type": "related_experiment",
        "entity": "Titration Series - Buffer Preparation",
        "entity_id": "EXP-2026-0032",
        "content": "Previous experiment used 0.1M NaOH as titrant. Key learning: degas NaOH solution with nitrogen before use — atmospheric CO2 reacts with NaOH to form Na2CO3, reducing effective concentration by up to 5% over 48 hours.",
        "relevance": 0.72,
        "source_page": "Titration Series - Buffer Preparation"
      }
    ],
    "query_metadata": {
      "intent": "safety",
      "search_depth": "medium",
      "pages_searched": 14,
      "graph_hops": 2,
      "elapsed_ms": 340
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "No results found for query",
  "data": {
    "answer": "I couldn't find specific information about that in the knowledge base. Try asking about a specific chemical, procedure, or experiment.",
    "context_blocks": [],
    "query_metadata": {
      "intent": "general",
      "search_depth": "medium",
      "pages_searched": 8,
      "graph_hops": 0,
      "elapsed_ms": 120
    }
  }
}
```

**Important**: Even when no results are found, return `success: true` with an empty `context_blocks` array and a helpful `answer`. Only use `success: false` for actual errors (auth failure, server error, etc.). The voice agent needs an answer to speak regardless.

---

## Context Block Types

These are the types the iOS app expects. Use exactly these strings:

| Type | Description | When to use |
|------|-------------|-------------|
| `chemical_safety` | Safety data, PPE requirements, first aid, hazards | Query mentions a chemical + safety/handling context |
| `chemical_properties` | Physical/chemical properties (bp, mp, density, pH, solubility) | Query asks about properties, concentration, physical characteristics |
| `procedure` | Step-by-step protocol or method | Query asks "how to", "what's the procedure", "method for" |
| `institutional_practice` | Lab-specific best practices, tips, pitfalls, standards | Always include if you find relevant institutional knowledge. This is high-value context |
| `related_experiment` | Summary of a related experiment + key learnings from it | Query asks about related/similar/previous work, or when context would help |
| `researcher_expertise` | Who has expertise in this area, who to ask | Query asks "who", "expert", "who should I ask" |
| `reaction_type` | Reaction mechanism, conditions, catalysts, best practices | Query is about a specific reaction or reaction class |
| `general_knowledge` | Anything that doesn't fit the above categories | Fallback for miscellaneous knowledge |

---

## How to Implement This

### Step 1: Query Intent Classification

Before searching, classify what the user is asking for. This determines the search strategy.

```typescript
type QueryIntent = 'safety' | 'properties' | 'procedure' | 'expertise'
                 | 'related' | 'reaction' | 'general';

function classifyIntent(query: string): QueryIntent {
  const q = query.toLowerCase();

  // Safety-related
  if (/safety|hazard|ppe|danger|toxic|handle|precaution|burn|exposure|first.aid|protective/.test(q))
    return 'safety';

  // Properties
  if (/concentration|temperature|boiling|melting|density|ph|solubility|molecular|formula|weight/.test(q))
    return 'properties';

  // Procedures
  if (/how to|procedure|protocol|steps|method|prepare|synthesize|technique|process/.test(q))
    return 'procedure';

  // Expertise
  if (/who (should|can|has|knows)|expert|ask (someone|about)|contact|experience with/.test(q))
    return 'expertise';

  // Related work
  if (/related|similar|previous|compare|other experiment|what did we|have we done/.test(q))
    return 'related';

  // Reaction type
  if (/reaction|mechanism|catalyst|yield|conditions|equilibrium|kinetics/.test(q))
    return 'reaction';

  return 'general';
}
```

### Step 2: Search Strategy by Intent

| Intent | Primary search | Graph traversal | What to extract |
|--------|---------------|-----------------|-----------------|
| `safety` | Search for the chemical entity mentioned in the query | Chemical page → safety/handling linked pages | Safety content, handling content, PPE, first aid, plus institutional practices |
| `properties` | Search for the chemical/compound | Chemical page → properties section | Physical/chemical properties |
| `procedure` | Search experiment + protocol pages | Experiment → procedure pages → step details | Procedure content, tips |
| `expertise` | Search researcher pages by topic overlap | Researcher → expertise → matching topic | Researcher name, expertise, relevant experience |
| `related` | Find the experiment (via experiment_id or name in query) | Experiment → linked experiments via PageLinks | Related experiment summaries, key learnings |
| `reaction` | Search reaction type pages | Reaction → linked chemicals, conditions, catalysts | Reaction details, best practices, conditions |
| `general` | Full-text search with query | Top results → 1-hop links | Best matching content as general_knowledge blocks |

### Step 3: Entity Extraction

For `safety`, `properties`, and `reaction` intents, you need to figure out **which entity** the user is asking about. Simple approach:

1. If `experiment_id` is provided, look up the experiment's chemicals list
2. Search the query string against known chemical/reaction names in the database
3. Match the longest known entity name found in the query

```typescript
async function extractEntity(query: string, experimentId?: string): Promise<{
  name: string;
  pageId: string;
  type: 'chemical' | 'reaction' | 'experiment';
} | null> {
  // Strategy 1: Match known chemicals from the experiment
  if (experimentId) {
    const expPage = await findExperimentPage(experimentId);
    if (expPage) {
      const chemicals = await getLinkedChemicals(expPage.id);
      for (const chem of chemicals) {
        if (query.toLowerCase().includes(chem.title.toLowerCase())) {
          return { name: chem.title, pageId: chem.id, type: 'chemical' };
        }
      }
    }
  }

  // Strategy 2: Full-text search for entity pages
  const results = await depthSearch(query, 'default');
  if (results.length > 0) {
    return { name: results[0].title, pageId: results[0].id, type: 'chemical' };
  }

  return null;
}
```

### Step 4: Build Context Blocks

Once you have search results and graph data, transform them into context blocks:

```typescript
function buildContextBlocks(
  intent: QueryIntent,
  entity: EntityMatch | null,
  searchResults: SearchResult[],
  graphData: GraphNeighborhood | null,
  maxBlocks: number
): ContextBlock[] {
  const blocks: ContextBlock[] = [];

  // Primary block from the entity page itself
  if (entity && graphData) {
    const mainPage = graphData.centerPage;
    blocks.push({
      type: intentToBlockType(intent),
      entity: entity.name,
      entity_id: entity.pageId,
      content: extractRelevantContent(mainPage, intent),
      relevance: 1.0,
      source_page: mainPage.title
    });
  }

  // Secondary blocks from linked pages
  if (graphData?.linkedPages) {
    for (const linked of graphData.linkedPages) {
      const blockType = classifyPageAsBlockType(linked);
      if (blocks.length >= maxBlocks) break;
      blocks.push({
        type: blockType,
        entity: linked.title,
        entity_id: linked.id,
        content: linked.oneLiner || extractFirstParagraph(linked),
        relevance: linked.linkStrength || 0.7,
        source_page: linked.title
      });
    }
  }

  // Always try to include institutional practices if relevant
  if (!blocks.some(b => b.type === 'institutional_practice')) {
    const practices = searchResults
      .filter(r => r.space === 'TEAM' || r.title.includes('Best Practice'))
      .slice(0, 1);
    for (const p of practices) {
      blocks.push({
        type: 'institutional_practice',
        entity: null,
        entity_id: null,
        content: p.snippet || p.oneLiner || '',
        relevance: 0.6,
        source_page: p.title
      });
    }
  }

  return blocks.slice(0, maxBlocks);
}
```

### Step 5: Synthesize Answer

The `answer` field should be a natural language response that the voice agent can speak directly. For v1, concatenate the most relevant content:

```typescript
function synthesizeAnswer(
  query: string,
  intent: QueryIntent,
  blocks: ContextBlock[]
): string {
  if (blocks.length === 0) {
    return "I couldn't find specific information about that in the knowledge base. " +
           "Try asking about a specific chemical, procedure, or experiment.";
  }

  // For v1: join the top 2-3 blocks' content with light connecting text
  const topBlocks = blocks.slice(0, 3);
  const parts = topBlocks.map(b => b.content);

  // Add a brief intro based on intent
  const intros: Record<QueryIntent, string> = {
    safety: `Here's what I found about safety: `,
    properties: `Here are the relevant properties: `,
    procedure: `Here's the procedure information: `,
    expertise: `Based on the lab records: `,
    related: `Here's what I found about related work: `,
    reaction: `Here's the reaction information: `,
    general: `Here's what I found: `
  };

  return intros[intent] + parts.join(' Additionally, ');
}
```

For v2 (future), you could use an LLM to synthesize a more natural answer from the blocks.

---

## Building on Existing SKB Infrastructure

You already have everything needed:

| Existing | How to use it |
|----------|---------------|
| `depthSearch(query, depth)` | Primary search mechanism. Use `medium` for most queries, `deep` for related experiments |
| `/api/agent/pages/[id]/context` | Get the graph neighborhood for an entity page (linked chemicals, procedures, etc.) |
| `/api/agent/pages/[id]/links` + `backlinks` | Navigate the knowledge graph |
| `Page.oneLiner`, `Page.summary` | Quick context extraction without parsing full content |
| `Block.plainText`, `Block.searchVector` | Full-text search on page content |
| `tiptapToMarkdown()` | Convert page content to readable text for context blocks |
| Agent auth middleware (`withAgentAuth()`) | Same auth pattern — reuse it |
| Rate limiting (100 req/min) | Same limits — reuse it |
| ChemELN enrichment data | Chemical properties, safety data, researcher expertise — all already in the knowledge graph |

### Where to Put the New Code

```
src/
├── app/api/agent/
│   └── kb-query/
│       └── route.ts          ← New endpoint
├── lib/
│   └── agent/
│       └── kbQuery.ts        ← Query logic (intent classification, entity extraction, block building)
```

### Authentication

Same as existing agent endpoints. Use `withAgentAuth()` decorator:

```typescript
import { withAgentAuth } from '@/lib/agent/auth';

export const POST = withAgentAuth(async (req, context) => {
  // context.tenantId, context.userId, context.scopes available
  const body = await req.json();
  // ... handle query
});
```

---

## How This Fits in the System

```
┌─────────────────────┐
│   SciSymbioLens     │
│   (iOS Voice/Chat)  │
│                     │
│ Gemini calls        │
│ query_knowledge_base│
│         │           │
└─────────┼───────────┘
          │ POST /kb/query
          ▼
┌─────────────────────┐
│  Clawdbot Gateway   │
│                     │
│ • Proxies to SKB    │
│ • Caches blocks in  │
│   session context   │
│ • Serves accumulated│
│   context on GET    │
│         │           │
└─────────┼───────────┘
          │ POST /api/agent/kb-query
          ▼
┌─────────────────────┐
│ SymbioKnowledgeBase │ ◄── YOU ARE HERE
│                     │
│ 1. Parse intent     │
│ 2. Extract entity   │
│ 3. Search + graph   │
│ 4. Build blocks     │
│ 5. Synthesize answer│
│         │           │
└─────────┼───────────┘
          │ Structured response
          ▼
   Back to voice agent
   → speaks answer
   → context persists
```

---

## What the iOS Side Will Send You

Real examples of queries that will come from the voice agent:

```
"What are the safety precautions for sodium hydroxide?"
"What's the recommended concentration for phosphate buffer?"
"Are there related experiments to Titration 7?"
"How do we usually prepare the citrate buffer in this lab?"
"Who has experience with HPLC column conditioning?"
"What did we learn from the caffeine extraction series?"
"What reaction type is acid-base titration?"
"Show me the procedure for pH electrode calibration"
"What chemicals are used in experiment EXP-2026-0050?"
"What are common pitfalls when working with strong bases?"
```

The `experiment_id` field will be set when the user is in an experiment context. It's optional — queries can come without experiment context too.

---

## Performance Requirements

| Metric | Target | Rationale |
|--------|--------|-----------|
| Response time (p50) | < 500ms | Voice agent waits for this synchronously |
| Response time (p95) | < 2000ms | Beyond 2s feels unresponsive in voice |
| Response time (deep) | < 3000ms | Deep queries are expected to be slower |
| Answer length | 100-500 chars | Must be speakable in ~30 seconds |
| Context block content | 100-300 chars each | System prompt has a 4000 char budget shared with other context |
| Max blocks | 5 | Keeps total context manageable |

---

## Testing

### Test with curl

```bash
# Basic safety query
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "safety precautions for sodium hydroxide", "depth": "medium"}'

# Query scoped to an experiment
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "related experiments", "experiment_id": "EXP-2026-0050", "depth": "deep"}'

# General query
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "how do we prepare citrate buffer?"}'

# Query for unknown topic (should return helpful empty response)
curl -X POST http://localhost:3000/api/agent/kb-query \
  -H "Authorization: Bearer skb_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{"query": "quantum chromodynamics in lab context"}'
```

### Expected Behaviors

1. **Known chemical query**: Returns chemical_safety + institutional_practice blocks
2. **Experiment-scoped query**: Results prioritize pages linked to that experiment
3. **"Related experiments" query**: Returns related_experiment blocks from graph traversal
4. **Unknown topic**: Returns `answer` saying "I couldn't find...", empty `context_blocks`
5. **Malformed request**: Returns 400 with validation error
6. **No auth token**: Returns 401

---

## Future Enhancements (Not for v1)

- **LLM-powered answer synthesis**: Use Claude/Gemini to generate natural language answers from retrieved blocks
- **Conversation-aware queries**: Accept previous context blocks so the agent doesn't re-retrieve the same info
- **Proactive knowledge push**: When the voice agent mentions a chemical, SKB pushes safety data without being asked
- **Confidence scoring**: Use embedding similarity (when vector search is added) for more accurate relevance scores
- **Multi-turn query refinement**: "Tell me more about that" → SKB knows what "that" refers to from session history

---

## Questions for SKB Agent

1. Does the knowledge graph currently have enough **linked** data (chemical → safety page, experiment → chemical links) for graph traversal to be useful? Or are pages mostly standalone?
2. Are chemical names normalized? (i.e., will searching "NaOH" find "Sodium Hydroxide"?)
3. What's the current state of `oneLiner` and `summary` population across pages? These are ideal for context block content.
4. Is there an existing way to find which experiment a chemical belongs to, or do we need to traverse via PageLinks?

---

## Reference Documents

- Epic 36 README: `/SciSymbioLens/docs/stories/epic-36-kb-retrieval-for-voice/README.md`
- Story 36.1 (this endpoint): `/SciSymbioLens/docs/stories/epic-36-kb-retrieval-for-voice/story-36.1-skb-agent-query-endpoint.md`
- Story 36.2 (gateway proxy): `/SciSymbioLens/docs/stories/epic-36-kb-retrieval-for-voice/story-36.2-gateway-kb-proxy-and-session-context.md`
- Existing SKB agent API: `/SymbioKnowledgeBase/src/app/api/agent/`
- Existing depth search: `/SymbioKnowledgeBase/src/lib/search/depthSearch.ts`
- Current KB context service on iOS: `/SciSymbioLens/ios/.../Services/Context/KBContextService.swift`
- Cross-platform sync architecture: `/ET_ELN/docs/cross-platform/SYNC-ARCHITECTURE-ALIGNMENT.md`
