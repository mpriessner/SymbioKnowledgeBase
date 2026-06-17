# Story SKB-54.1: Deep Content Extraction for Primary Entity Blocks

**Epic:** Epic 54 — Rich Content Retrieval for KB Queries
**Story ID:** SKB-54.1
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** None

---

## User Story

As the voice agent asking "Give me everything about MTT" or "What are the procedure steps
for experiment EXP-2025-0015?", I need the kb-query to return the **full page content** —
not just a 300-character summary — so that the AI can answer detailed follow-up questions
using the lab's actual documented knowledge.

---

## Problem

`extractRelevantContent()` in `src/lib/agent/kbQuery.ts` (line ~583) currently:
1. Picks **one section** based on intent (e.g., "Safety" section for safety queries)
2. Truncates that section to **300 characters**
3. Falls back to `oneLiner` if no section matches

This means a query about MTT returns:
```
"Tetrazolium dye reduced by metabolically active cells to form purple formazan crystals;
used for cell viability assays."  (119 chars)
```

Instead of the full 1015-char page with properties, storage, handling, and institutional knowledge.

---

## Solution

When `depth === "deep"`, return the full page markdown for the primary entity block instead
of extracting a single section. The content cap is controlled by `max_block_chars` (Story 54.4).

---

## Acceptance Criteria

1. **Modify `extractRelevantContent()` to accept depth parameter:**
   - [ ] New signature: `extractRelevantContent(page, intent, depth, maxBlockChars)`
   - [ ] When `depth === "deep"`: return full `page.markdown`, capped at `maxBlockChars`
   - [ ] When `depth !== "deep"`: keep current behavior (intent-focused section, 300 chars)

2. **Modify `buildContextBlocks()` to pass depth and maxBlockChars:**
   - [ ] Add `depth: SearchDepth` and `maxBlockChars: number` to function parameters
   - [ ] Pass through to `extractRelevantContent()`

3. **For linked/backlink blocks in deep mode:**
   - [ ] Fetch full page content using `getPageContent()` (not just oneLiner)
   - [ ] Use `extractRelevantContent(page, intent, depth, maxBlockChars)` for these too
   - [ ] This is covered more fully in Story 54.2, but the plumbing goes here

4. **Update `executeKbQuery()` to pass depth through the chain:**
   - [ ] `buildContextBlocks(intent, entity, searchResults, tenantId, maxBlocks, depth, maxBlockChars)`

---

## Implementation

### File: `src/lib/agent/kbQuery.ts`

#### Change `extractRelevantContent` (~line 583):

```typescript
function extractRelevantContent(
  page: PageContent,
  intent: QueryIntent,
  depth: SearchDepth = "medium",
  maxBlockChars: number = 300
): string {
  // Deep mode: return full page markdown
  if (depth === "deep") {
    const fullContent = page.markdown.trim();
    if (fullContent) {
      return fullContent.length <= maxBlockChars
        ? fullContent
        : smartTruncate(fullContent, maxBlockChars);
    }
    // Fall through to oneLiner if markdown is empty
  }

  // Default/medium mode: current intent-focused extraction
  const md = page.markdown;

  switch (intent) {
    case "safety": {
      const safety =
        extractSection(md, "Safety|Hazard") ||
        extractSection(md, "Handling") ||
        extractSection(md, "Institutional Knowledge");
      if (safety) return truncate(safety, maxBlockChars);
      break;
    }
    // ... rest of existing switch cases, using maxBlockChars instead of 300
  }

  if (page.oneLiner) return page.oneLiner;

  const firstPara = md
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"))
    .slice(0, 3)
    .join(" ")
    .trim();

  return truncate(firstPara, maxBlockChars);
}
```

#### Change `buildContextBlocks` signature (~line 648):

```typescript
async function buildContextBlocks(
  intent: QueryIntent,
  entity: EntityMatch | null,
  searchResults: DepthSearchResultItem[],
  tenantId: string,
  maxBlocks: number,
  depth: SearchDepth = "medium",
  maxBlockChars: number = 300
): Promise<{ blocks: ContextBlock[]; graphHops: number }> {
```

#### Change primary block creation (~line 662):

```typescript
const primaryContent = extractRelevantContent(page, intent, depth, maxBlockChars);
```

#### Change `executeKbQuery` call (~line 1020):

```typescript
const { blocks, graphHops } = await buildContextBlocks(
  intent,
  entity,
  searchResults,
  tenantId,
  maxBlocks,
  depth,       // NEW
  maxBlockChars // NEW — from options, Story 54.4
);
```

---

## Verification

```bash
TOKEN="skb_live_..."

# Deep query — should return full page content
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT","depth":"deep"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
blocks = d['data']['context_blocks']
for b in blocks:
    print(f'{b[\"type\"]:30s} {b[\"entity\"]:30s} {b[\"char_count\"]:5d} chars')
print()
primary = blocks[0] if blocks else {}
print(f'Primary content ({primary.get(\"char_count\",0)} chars):')
print(primary.get('content', '')[:500])
"
# Expected: primary block ~1000+ chars (full MTT page), not ~119 chars

# Medium query — should return focused content (unchanged)
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT","depth":"medium"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
blocks = d['data']['context_blocks']
for b in blocks:
    print(f'{b[\"type\"]:30s} {b[\"entity\"]:30s} {b[\"char_count\"]:5d} chars')
"
# Expected: primary block ~119 chars (oneLiner), same as before
```
