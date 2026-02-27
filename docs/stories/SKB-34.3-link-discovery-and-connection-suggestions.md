# Story SKB-34.3: Link Discovery & Connection Suggestions

**Epic:** Epic 34 - Agent Sweep Mode (Housekeeping Agent)
**Story ID:** SKB-34.3
**Story Points:** 5 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-34.1 (sweep service core must exist)

---

## User Story

As the sweep agent, I want to discover mentions of other page titles in a page's content that aren't linked as wikilinks, so that I can suggest (or automatically create) new connections to strengthen the knowledge graph.

---

## Acceptance Criteria

### Title Mention Detection
- [ ] For each page being swept, scan its `plainText` for mentions of other page titles
- [ ] Matching is **case-insensitive**: "API Gateway" matches "api gateway" in text
- [ ] Matching is **whole-word**: "API" does not match "RAPID" or "CAPITAL"
- [ ] Short titles (< 3 characters) are excluded from matching to avoid false positives
- [ ] Generic titles are excluded: "Untitled", "Notes", "Draft", "TODO", "Test" (configurable list)
- [ ] Already-linked pages (existing wikilinks via PageLink) are excluded from suggestions

### Confidence Scoring
- [ ] Each suggestion gets a confidence score (0.0 - 1.0):
  - **Title length bonus**: longer titles are more specific → higher confidence
    - 3-5 chars: +0.1, 6-10 chars: +0.2, 11-20 chars: +0.3, 21+: +0.4
  - **Exact case match bonus**: if the mention matches the exact case of the title → +0.2
  - **Multiple mentions bonus**: found 2+ times in the text → +0.1 per additional occurrence (max +0.3)
  - **Word boundary quality**: matched at sentence start or after punctuation → +0.1
  - Base confidence: 0.3
  - Max confidence: 1.0
- [ ] Suggestions with confidence < 0.3 are discarded (too likely to be false positives)

### Context Extraction
- [ ] Each suggestion includes the surrounding context where the mention was found:
  - 80 characters before and after the match
  - Matched term highlighted with `**bold**` markers
  - Multiple occurrences: show the first occurrence's context
- [ ] Example: `"...configure the **API Gateway** to route requests through the..."`

### Link Suggestion Storage
- [ ] Suggestions are stored in the `SweepResult.pageLog` for each page
- [ ] Each page log entry includes:
  ```typescript
  suggestions: {
    targetPageId: string;
    targetTitle: string;
    confidence: number;
    context: string;
    occurrences: number;
  }[]
  ```
- [ ] Suggestions are also written to a `link_suggestions` table for persistent review:
  ```prisma
  model LinkSuggestion {
    id           String   @id @default(uuid())
    tenantId     String   @map("tenant_id")
    sourcePageId String   @map("source_page_id")
    targetPageId String   @map("target_page_id")
    confidence   Float
    context      String
    occurrences  Int
    status       SuggestionStatus @default(PENDING)
    sweepSessionId String? @map("sweep_session_id")
    createdAt    DateTime @default(now()) @map("created_at")
    resolvedAt   DateTime? @map("resolved_at")

    @@unique([sourcePageId, targetPageId])
    @@index([tenantId, status])
    @@map("link_suggestions")
  }

  enum SuggestionStatus {
    PENDING    // Awaiting review
    ACCEPTED   // Link was created
    DISMISSED  // User said "not relevant"
    AUTO_LINKED // Automatically linked by sweep
  }
  ```

### Auto-Linking (Optional)
- [ ] When `config.autoLink = true` AND confidence >= 0.8:
  - Automatically create a `PageLink` record (sourcePageId → targetPageId)
  - Mark suggestion status as `AUTO_LINKED`
  - Log: "Auto-linked: [Source Page] → [Target Page] (confidence: 0.85)"
- [ ] Auto-linking does NOT modify page content (doesn't insert wikilink nodes into TipTap JSON)
  - It only creates the PageLink relationship for graph/backlinks visibility
  - Content modification would require re-saving the page, which is risky in batch mode
- [ ] When `config.autoLink = false` (default): suggestions are stored as PENDING for human review

### Deduplication
- [ ] If a suggestion already exists (same source → target), update the confidence and context instead of creating a duplicate
- [ ] If a suggestion was previously DISMISSED, do not re-create it

### Performance
- [ ] The discovery algorithm should process a page in < 50ms (text scanning only, no LLM)
- [ ] For a knowledge base with 500 pages, building the title index takes < 100ms
- [ ] Title index is built once per sweep and reused across all pages

---

## Architecture Overview

```
Link Discovery Flow:
────────────────────

SweepService processes page
        │
        ▼
LinkDiscovery.discover(page, titleIndex, existingLinks)
        │
        ▼
1. Get page's plainText (from Block)
2. Get existing outgoing links (PageLink where source = this page)
3. For each title in titleIndex:
   a. Skip if already linked
   b. Skip if title too short (< 3 chars) or generic
   c. Skip if title matches current page (self-reference)
   d. Search plainText for whole-word case-insensitive match
   e. If found:
      - Calculate confidence score
      - Extract context snippet
      - Count occurrences
      - Add to suggestions list
        │
        ▼
4. Filter: discard suggestions with confidence < 0.3
5. Sort by confidence DESC
6. Return suggestions


Title Index:
────────────

Built once per sweep:
  titleIndex = Map<normalizedTitle, { pageId, originalTitle, titleLength }>

Normalized: lowercase, trimmed
Exclusions: titles in GENERIC_TITLES set, titles < 3 chars


Whole-Word Matching:
────────────────────

function findWholeWordMatch(text: string, term: string): MatchResult[] {
  // Use RegExp with word boundaries: new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi')
  // Handle special characters in titles that are regex-special
  // Return all match positions
}


Confidence Calculation:
───────────────────────

function calculateConfidence(params: {
  titleLength: number;
  exactCaseMatch: boolean;
  occurrences: number;
  wordBoundaryQuality: boolean;
}): number {
  let score = 0.3;  // Base

  // Title length bonus
  if (titleLength >= 21) score += 0.4;
  else if (titleLength >= 11) score += 0.3;
  else if (titleLength >= 6) score += 0.2;
  else score += 0.1;

  // Case match bonus
  if (exactCaseMatch) score += 0.2;

  // Multiple occurrences
  score += Math.min(0.3, (occurrences - 1) * 0.1);

  // Word boundary quality
  if (wordBoundaryQuality) score += 0.1;

  return Math.min(1.0, score);
}
```

---

## Implementation Steps

### Step 1: Add LinkSuggestion Model to Prisma Schema

**File: `prisma/schema.prisma`** (modify)

Add the `LinkSuggestion` model and `SuggestionStatus` enum.

Run migration: `npx prisma migrate dev --name add-link-suggestions`

### Step 2: Create Title Index Builder

**File: `src/lib/sweep/titleIndex.ts`** (create)

```typescript
export interface TitleEntry {
  pageId: string;
  originalTitle: string;
  normalizedTitle: string;
  titleLength: number;
}

export const GENERIC_TITLES = new Set([
  'untitled', 'notes', 'draft', 'todo', 'test', 'temp', 'new page', 'readme'
]);

export function buildTitleIndex(pages: { id: string; title: string }[]): TitleEntry[] {
  return pages
    .filter(p => p.title.length >= 3)
    .filter(p => !GENERIC_TITLES.has(p.title.toLowerCase()))
    .map(p => ({
      pageId: p.id,
      originalTitle: p.title,
      normalizedTitle: p.title.toLowerCase(),
      titleLength: p.title.length,
    }));
}
```

### Step 3: Create Link Discovery Module

**File: `src/lib/sweep/linkDiscovery.ts`** (create)

```typescript
export interface LinkSuggestion {
  targetPageId: string;
  targetTitle: string;
  confidence: number;
  context: string;
  occurrences: number;
}

export function discoverUnlinkedReferences(
  pageId: string,
  plainText: string,
  titleIndex: TitleEntry[],
  existingLinkTargets: Set<string>
): LinkSuggestion[] {
  // For each title in index:
  //   - Skip if already linked or self-reference
  //   - Regex whole-word search
  //   - Calculate confidence
  //   - Extract context
  // Filter, sort by confidence desc
}

export function calculateConfidence(params: ConfidenceParams): number { ... }
export function extractContext(text: string, matchIndex: number, matchLength: number, padding: number): string { ... }
```

### Step 4: Create Suggestion Persistence

**File: `src/lib/sweep/suggestionStore.ts`** (create)

```typescript
export async function saveSuggestions(
  tenantId: string,
  sourcePageId: string,
  suggestions: LinkSuggestion[],
  sweepSessionId: string
): Promise<void> {
  // Upsert: if same source→target exists, update confidence + context
  // Skip if previously DISMISSED
}

export async function autoLinkSuggestions(
  tenantId: string,
  sourcePageId: string,
  suggestions: LinkSuggestion[],
  confidenceThreshold: number
): Promise<number> {
  // Create PageLink for high-confidence suggestions
  // Mark as AUTO_LINKED
  // Return count of links created
}
```

### Step 5: Integrate with SweepService

**File: `src/lib/sweep/SweepService.ts`** (modify)

In `processPage()`, after staleness detection:
```typescript
// Link discovery (always runs, regardless of summary action)
const suggestions = discoverUnlinkedReferences(
  page.id,
  page.plainText,
  this.titleIndex,
  page.existingLinkTargets
);

if (suggestions.length > 0) {
  await saveSuggestions(config.tenantId, page.id, suggestions, sessionId);
  if (config.autoLink) {
    const autoLinked = await autoLinkSuggestions(config.tenantId, page.id, suggestions, 0.8);
    this.metrics.linksAutoCreated += autoLinked;
  }
}
```

---

## Testing Requirements

### Unit Tests (12+ cases)

**File: `src/__tests__/lib/sweep/linkDiscovery.test.ts`**

- Title found in text → suggestion created
- Title not in text → no suggestion
- Already-linked page → not suggested
- Self-reference → not suggested
- Short title (2 chars) → excluded from index
- Generic title ("Notes") → excluded from index
- Case-insensitive match → detected
- Whole-word match: "API" doesn't match "RAPID"
- Multiple occurrences → higher confidence
- Exact case match → higher confidence
- Confidence below 0.3 → filtered out
- Context extraction → 80 chars with bold markers

**File: `src/__tests__/lib/sweep/titleIndex.test.ts`**

- Builds index from page list
- Filters short titles
- Filters generic titles
- Normalizes to lowercase

**File: `src/__tests__/lib/sweep/suggestionStore.test.ts`**

- Save new suggestion → created in DB
- Save duplicate → updated, not duplicated
- Previously dismissed → not re-created

### Integration Tests (4+ cases)

**File: `src/__tests__/integration/link-discovery.test.ts`**

- Sweep discovers unlinked mention → LinkSuggestion stored with PENDING status
- Auto-link with confidence 0.9 → PageLink created + suggestion marked AUTO_LINKED
- Auto-link with confidence 0.5 → no PageLink, suggestion stays PENDING
- Sweep with 5 pages → correct total suggestion count across all pages

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add LinkSuggestion model and SuggestionStatus enum |
| `src/lib/sweep/titleIndex.ts` | Create | Title index builder with filtering |
| `src/lib/sweep/linkDiscovery.ts` | Create | Unlinked reference detection with confidence scoring |
| `src/lib/sweep/suggestionStore.ts` | Create | Suggestion persistence and auto-linking |
| `src/lib/sweep/SweepService.ts` | Modify | Integrate link discovery into sweep pipeline |
| `src/lib/sweep/types.ts` | Modify | Add LinkSuggestion and related types |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
