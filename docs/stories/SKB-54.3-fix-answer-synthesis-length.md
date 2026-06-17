# Story SKB-54.3: Fix Answer Synthesis to Respect max_answer_length

**Epic:** Epic 54 — Rich Content Retrieval for KB Queries
**Story ID:** SKB-54.3
**Story Points:** 1 | **Priority:** High | **Status:** Draft
**Depends On:** None (independent bug fix)

---

## User Story

As the voice agent requesting `max_answer_length: 5000`, I expect the `answer` field to
actually use up to 5000 characters when there's enough content to fill it, instead of being
silently capped at ~500-600 characters.

---

## Problem

`synthesizeAnswer()` (line ~801 in kbQuery.ts) has two issues:

1. **Only uses top 2 blocks for primary content** (line ~819):
   ```typescript
   const primaryBlocks = contentBlocks.slice(0, 2);
   const supportingBlocks = contentBlocks.slice(2, 4);
   ```
   Even with `maxLength: 5000`, it only assembles content from 4 blocks maximum.

2. **Supporting content gate is too conservative** (line ~855):
   ```typescript
   if (parts.join(" ").length < maxLength * 0.6) {
   ```
   With short block content (~300 chars each), `parts` is ~600 chars, which is under
   `5000 * 0.6 = 3000`, so supporting blocks ARE added — but there are only 2 more.

   The real problem is that **block content is only ~300 chars** (from extractRelevantContent
   truncation), so even with 4 blocks, the answer tops out at ~1200 chars.

3. **After SKB-54.1 fixes block content to be longer in deep mode**, the answer synthesis
   will naturally produce longer answers because each block's content is richer.

---

## Solution

1. Use **all content blocks** for answer synthesis (not just top 4) when maxLength allows
2. Build answer iteratively, adding blocks until the length budget is met
3. Ensure `smartTruncate` uses the actual `maxLength` parameter

---

## Acceptance Criteria

1. **Iterative answer building:**
   - [ ] Replace fixed 2+2 block split with iterative accumulation
   - [ ] Add blocks in relevance order until approaching `maxLength`
   - [ ] Each block formatted per intent (existing templates: "For X: ...", "In X: ...", etc.)

2. **Respect maxLength:**
   - [ ] Answer should use up to `maxLength` characters when content is available
   - [ ] `smartTruncate` at end is a safety net, not the primary limiter

3. **Backward compatible:**
   - [ ] Default maxLength remains 500 (existing behavior for medium queries)
   - [ ] Passing `max_answer_length: 5000` actually produces ~5000 char answers when possible

---

## Implementation

### File: `src/lib/agent/kbQuery.ts`

#### Replace `synthesizeAnswer` (~line 801):

```typescript
function synthesizeAnswer(
  query: string,
  intent: QueryIntent,
  blocks: ContextBlock[],
  maxLength: number = 500
): string {
  if (blocks.length === 0) {
    return (
      "I couldn't find specific information about that in the knowledge base. " +
      "Try asking about a specific chemical, procedure, or experiment."
    );
  }

  const sorted = [...blocks].sort((a, b) => b.relevance - a.relevance);
  const contentBlocks = sorted.filter((b) => b.content.length > 20);

  const parts: string[] = [];
  const citations: string[] = [];
  let currentLength = 0;

  for (const block of contentBlocks) {
    // Format block per intent
    let text = "";
    switch (intent) {
      case "safety":
        text = block.entity ? `For ${block.entity}: ${block.content}` : block.content;
        break;
      case "procedure":
        text = block.entity ? `In ${block.entity}: ${block.content}` : block.content;
        break;
      case "expertise":
        text = block.entity ? `${block.entity} — ${block.content}` : block.content;
        break;
      default:
        if (block.type === "institutional_practice") {
          text = `Our lab practice: ${block.content}`;
        } else {
          text = block.content;
        }
    }

    // Check if adding this block would exceed budget
    if (currentLength + text.length + 2 > maxLength && parts.length > 0) {
      break; // Already have some content, stop here
    }

    parts.push(text);
    currentLength += text.length + 2; // +2 for ". " separator

    if (block.source_page && !citations.includes(block.source_page)) {
      citations.push(block.source_page);
    }
  }

  let answer = parts.join(" ");

  // Add citations if space allows
  if (citations.length > 0) {
    const citationStr = ` (Sources: ${citations.slice(0, 5).join(", ")})`;
    if (answer.length + citationStr.length <= maxLength) {
      answer += citationStr;
    }
  }

  return smartTruncate(answer, maxLength);
}
```

---

## Verification

```bash
TOKEN="skb_live_..."

# Request long answer
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT viability assay procedure","depth":"deep","max_answer_length":5000}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
answer = d['data']['answer']
print(f'Answer length: {len(answer)} chars')
print(f'Answer preview: {answer[:300]}...')
"
# Expected: answer should be significantly longer than 600 chars

# Default answer length (should still be ~500)
curl -s -X POST "http://localhost:3000/api/agent/kb-query" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"MTT","depth":"medium"}' \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Answer length: {len(d[\"data\"][\"answer\"])} chars')
"
# Expected: ~500 chars or less (unchanged default behavior)
```
