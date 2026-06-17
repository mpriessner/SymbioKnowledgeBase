# Story SKB-53.3: Enhance kb-query Response for Direct Consumers

**Epic:** Epic 53 — Direct Knowledge Base Access for SciSymbioLens
**Story ID:** SKB-53.3
**Story Points:** 2 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-53.1

---

## User Story

As the SciSymbioLens voice agent consuming KB query results directly (no gateway intermediary),
I need the kb-query response to include enough structured information so that results can be
directly injected into the Gemini system prompt as rich context — without needing a gateway
to post-process or augment them.

---

## Context

When the gateway proxied KB queries, it could enrich responses before passing them to the iOS app.
With direct access, SKB's response needs to be self-contained. The current response already
returns structured context blocks with relevance scores, which is good. This story ensures:

1. Context blocks include enough detail for system prompt injection
2. The response includes a pre-formatted text block (optional convenience field)
3. Context blocks are capped at a configurable character budget

---

## Acceptance Criteria

1. **Pre-formatted context text field**
   - [ ] Add optional `formatted_context` field to kb-query response
   - [ ] Contains a ready-to-inject text block formatted like:
     ```
     --- Retrieved Knowledge ---
     [chemical_properties: MTT]
     Tetrazolium dye reduced by metabolically active cells...

     [researcher_expertise: Dr. Sarah Kim]
     Biochemist specializing in protein analysis...
     ```
   - [ ] Sorted by relevance (highest first)
   - [ ] This saves the iOS client from having to format context blocks itself

2. **Character budget parameter**
   - [ ] Accept optional `max_context_chars` query parameter (default: 12000)
   - [ ] Truncate `formatted_context` to fit within budget
   - [ ] Individual context blocks are still returned in full (client can choose which to use)
   - [ ] Response includes `context_truncated: true/false` flag

3. **Richer context blocks**
   - [ ] Each block includes `source_page` (page title — already present)
   - [ ] Each block includes `source_path` (full page path, e.g., "/Chemistry KB/Chemicals/MTT")
   - [ ] Each block includes `char_count` (length of content field)
   - [ ] These help the iOS client make intelligent decisions about what to include

4. **Backward compatibility**
   - [ ] Existing response shape unchanged — new fields are additive
   - [ ] Gateway's existing `/kb/query` proxy still works (it passes through SKB response)
   - [ ] `formatted_context` is only included if `include_formatted=true` query param is set

---

## Implementation Notes

### Where to change

**File:** `src/lib/agent/kbQuery.ts` (or equivalent KB query logic)

Add formatting logic after context blocks are assembled:

```typescript
function formatContextBlocks(blocks: ContextBlock[], maxChars: number): string {
  const sorted = blocks.sort((a, b) => b.relevance - a.relevance);
  const sections: string[] = [];
  let totalChars = 0;

  for (const block of sorted) {
    const header = block.entity
      ? `[${block.type}: ${block.entity}]`
      : `[${block.type}]`;
    const section = `${header}\n${block.content}`;

    if (totalChars + section.length > maxChars) {
      break; // Stop adding blocks when budget exceeded
    }

    sections.push(section);
    totalChars += section.length;
  }

  return "--- Retrieved Knowledge ---\n" + sections.join("\n\n");
}
```

**File:** `src/app/api/agent/kb-query/route.ts`

Add query params: `include_formatted`, `max_context_chars`

### Response shape (enhanced)

```json
{
  "success": true,
  "data": {
    "answer": "...",
    "context_blocks": [
      {
        "type": "chemical_properties",
        "entity": "MTT",
        "entity_id": "f1950924-...",
        "content": "Tetrazolium dye...",
        "relevance": 1.0,
        "source_page": "MTT",
        "source_path": "/Chemistry KB/Chemicals/MTT",
        "char_count": 118
      }
    ],
    "formatted_context": "--- Retrieved Knowledge ---\n[chemical_properties: MTT]\n...",
    "context_truncated": false,
    "query_metadata": {
      "intent": "general",
      "search_depth": "medium",
      "search_strategy": "rag",
      "pages_searched": 10,
      "graph_hops": 2,
      "elapsed_ms": 100,
      "total_context_chars": 2450
    }
  }
}
```

---

## Verification

```bash
TOKEN="skb_live_..."

# Without formatted context (backward compatible)
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT viability assay","depth":"medium"}'
# Should return existing shape, no formatted_context field

# With formatted context
curl -s -X POST "http://localhost:3000/api/agent/kb-query?include_formatted=true&max_context_chars=8000" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT viability assay","depth":"medium"}'
# Should include formatted_context field, context_truncated flag
```

---

## Testing

- [ ] Unit test: `formatContextBlocks()` with various block counts and budgets
- [ ] Unit test: truncation at budget boundary
- [ ] Unit test: backward compatibility — no `formatted_context` without `include_formatted`
- [ ] Integration test: full kb-query with `include_formatted=true`
