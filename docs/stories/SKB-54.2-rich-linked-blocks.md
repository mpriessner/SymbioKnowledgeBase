# Story SKB-54.2: Rich Linked/Backlink Blocks with Key Sections

**Epic:** Epic 54 — Rich Content Retrieval for KB Queries
**Story ID:** SKB-54.2
**Story Points:** 2 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-54.1

---

## User Story

As the voice agent with deep context loaded, when I ask about an experiment and its linked
chemicals come back as context blocks, I need those linked blocks to contain useful content
(safety data, handling tips, key properties) — not just a one-liner sentence.

---

## Problem

Currently, linked and backlink blocks (lines ~680-700 in kbQuery.ts) only use:
```typescript
content: lp.oneLiner || lp.title,
```

For example, a linked chemical "DMSO" returns:
```
"Polar aprotic solvent; used to solubilize formazan crystals in MTT assays and as cryoprotectant."
```

Instead of the full DMSO page with handling instructions, safety data, and storage info.

---

## Solution

When `depth === "deep"`, fetch full page content for linked entities using `getPageContent()`
(which already exists) and use `extractRelevantContent()` with the deep depth.

For non-deep queries, keep the current lightweight behavior (oneLiner only, no extra DB calls).

---

## Acceptance Criteria

1. **Deep mode: fetch full content for linked pages:**
   - [ ] When `depth === "deep"`, call `getPageContent(lp.id, tenantId)` for each linked page
   - [ ] Use `extractRelevantContent(page, intent, depth, maxBlockChars)` for content
   - [ ] Fetch pages in parallel (`Promise.all`) to minimize latency
   - [ ] Cap at `maxBlocks` as before (don't fetch more than needed)

2. **Deep mode: fetch full content for backlink pages:**
   - [ ] Same as above for backlinks

3. **Non-deep mode: no change:**
   - [ ] Keep current `oneLiner || title` behavior for linked/backlink blocks
   - [ ] No additional DB queries in default/medium mode

4. **Search result blocks in deep mode:**
   - [ ] For search results that fill remaining slots, fetch page content via `getPageContent()`
   - [ ] Use `extractRelevantContent()` with deep depth
   - [ ] Only fetch for blocks that would actually be included (respect maxBlocks)

---

## Implementation

### File: `src/lib/agent/kbQuery.ts`

#### Linked pages block (~line 680):

```typescript
// Current:
for (const lp of linked) {
  if (blocks.length >= maxBlocks) break;
  const blockType = classifyPageAsBlockType(lp.parentTitle);
  if (intent === "safety" && blockType === "general_knowledge") continue;
  const lpContent = lp.oneLiner || lp.title;
  // ...
}

// New:
// Determine which linked pages we'll actually use
const linkedToFetch = linked
  .filter(lp => {
    const blockType = classifyPageAsBlockType(lp.parentTitle);
    return !(intent === "safety" && blockType === "general_knowledge");
  })
  .slice(0, maxBlocks - blocks.length);

// Deep mode: fetch full content in parallel
let linkedContents: Map<string, PageContent> = new Map();
if (depth === "deep" && linkedToFetch.length > 0) {
  const fetched = await Promise.all(
    linkedToFetch.map(lp => getPageContent(lp.id, tenantId))
  );
  fetched.forEach((pc, i) => {
    if (pc) linkedContents.set(linkedToFetch[i].id, pc);
  });
}

for (const lp of linkedToFetch) {
  if (blocks.length >= maxBlocks) break;
  const blockType = classifyPageAsBlockType(lp.parentTitle);

  let lpContent: string;
  if (depth === "deep") {
    const fullPage = linkedContents.get(lp.id);
    lpContent = fullPage
      ? extractRelevantContent(fullPage, intent, depth, maxBlockChars)
      : (lp.oneLiner || lp.title);
  } else {
    lpContent = lp.oneLiner || lp.title;
  }

  // ... push block with lpContent
}
```

#### Same pattern for backlinks (~line 700) and search results (~line 730).

---

## Performance Consideration

Deep mode fetches more data (N linked pages instead of just their oneLiners). Typical impact:
- 3-5 extra DB queries (one per linked page)
- Each query: ~5-20ms (Prisma, local PostgreSQL)
- Total: ~50-100ms additional latency
- Acceptable for deep queries where quality matters over speed

---

## Verification

```bash
TOKEN="skb_live_..."

# Deep query for experiment — linked chemicals should have full content
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"EXP-2025-0015 MTT Cell Viability Assay","depth":"deep"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
for b in d['data']['context_blocks']:
    print(f'{b[\"type\"]:30s} {b.get(\"entity\",\"?\"):30s} {b[\"char_count\"]:5d} chars')
    if b['char_count'] > 200:
        print(f'  Content preview: {b[\"content\"][:150]}...')
    print()
"
# Expected: linked chemical blocks should have 500+ chars (full page), not ~100 chars (oneLiner)
```
