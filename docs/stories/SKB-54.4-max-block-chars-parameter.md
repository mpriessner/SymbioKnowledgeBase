# Story SKB-54.4: Add max_block_chars Parameter

**Epic:** Epic 54 — Rich Content Retrieval for KB Queries
**Story ID:** SKB-54.4
**Story Points:** 1 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-54.1

---

## User Story

As the voice agent or iOS client, I want to control the maximum character length per context
block so that I can balance content richness against token budget constraints.

---

## Problem

Currently, block content length is hardcoded:
- Default/medium mode: 300 chars (in `extractRelevantContent`, hardcoded truncation)
- Deep mode (after SKB-54.1): full page markdown, unbounded

There's no API parameter to control per-block content length. The caller can't say "give me
deep content but cap each block at 2000 chars" — it's either 300 or unlimited.

Without a cap, a single experiment page (2500+ chars) could consume most of the 12K context
budget, leaving no room for linked entities.

---

## Solution

Add `max_block_chars` to the kb-query API request body and plumb it through to
`extractRelevantContent()` and `buildContextBlocks()`.

---

## Acceptance Criteria

1. **API parameter:**
   - [ ] Add `max_block_chars` to `kbQuerySchema` in the route handler
   - [ ] Validation: integer, min 100, max 5000, default 2000
   - [ ] Add `maxBlockChars` to `KbQueryOptions` interface

2. **Plumbing:**
   - [ ] `executeKbQuery()` destructures `maxBlockChars` from options
   - [ ] Passes `maxBlockChars` to `buildContextBlocks()`
   - [ ] `buildContextBlocks()` passes it to `extractRelevantContent()`

3. **Behavior:**
   - [ ] In deep mode: full page content capped at `maxBlockChars`
   - [ ] In default/medium mode: keeps existing 300-char behavior (parameter is ignored or
         used as fallback — the intent-focused extraction already produces short content)
   - [ ] `char_count` in response reflects actual content length after capping

---

## Implementation

### File: `src/app/api/agent/kb-query/route.ts`

#### Add to schema (~line 8):

```typescript
const kbQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  experiment_id: z.string().optional(),
  session_id: z.string().optional(),
  depth: z.enum(["default", "medium", "deep"]).optional().default("medium"),
  max_blocks: z.number().int().min(1).max(20).optional().default(5),
  strategy: z.enum(["auto", "rag", "agentic"]).optional().default("auto"),
  max_answer_length: z.number().int().min(100).max(5000).optional().default(500),
  max_block_chars: z.number().int().min(100).max(5000).optional().default(2000),  // NEW
});
```

#### Pass to executeKbQuery (~line 84):

```typescript
const result = await executeKbQuery({
  // ... existing fields ...
  maxBlockChars: parsed.data.max_block_chars,  // NEW
});
```

### File: `src/lib/agent/kbQuery.ts`

#### Add to KbQueryOptions (~line 74):

```typescript
export interface KbQueryOptions {
  // ... existing fields ...
  maxBlockChars?: number;
}
```

#### Destructure in executeKbQuery (~line 927):

```typescript
const {
  // ... existing fields ...
  maxBlockChars = 2000,
} = options;
```

#### Pass to buildContextBlocks (~line 1020):

```typescript
const { blocks, graphHops } = await buildContextBlocks(
  intent,
  entity,
  searchResults,
  tenantId,
  maxBlocks,
  depth,          // from SKB-54.1
  maxBlockChars   // NEW
);
```

---

## Verification

```bash
TOKEN="skb_live_..."

# Deep query with custom block cap
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT","depth":"deep","max_block_chars":1000}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for b in d['data']['context_blocks']:
    print(f'{b[\"type\"]:30s} {b.get(\"entity\",\"?\"):30s} {b[\"char_count\"]:5d} chars')
    assert b['char_count'] <= 1000, f'Block exceeds 1000 chars: {b[\"char_count\"]}'
print('All blocks within 1000-char cap')
"

# Deep query with max cap (5000)
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"EXP-2025-0015","depth":"deep","max_block_chars":5000}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for b in d['data']['context_blocks']:
    print(f'{b[\"type\"]:30s} {b.get(\"entity\",\"?\"):30s} {b[\"char_count\"]:5d} chars')
"
# Expected: blocks may be up to 5000 chars (experiment pages are ~2500)

# Validation: reject invalid values
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT","max_block_chars":50}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(d.get('error', 'no error'))
"
# Expected: validation error (min 100)
```
