# Story SKB-33.3: Enriched Page Connections Panel

**Epic:** Epic 33 - Agent Navigation Metadata & Page Summaries
**Story ID:** SKB-33.3
**Story Points:** 5 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-33.1 (summary fields must exist to display)

---

## User Story

As a SymbioKnowledgeBase user (human or agent), I want to see all pages linked from and to the current page — with their one-liner summaries — in a unified "Page Connections" section, so that I can quickly assess related content without opening each page.

---

## Acceptance Criteria

### Unified Connections Panel
- [ ] Replaces the current `BacklinksPanel` with a new `PageConnectionsPanel`
- [ ] Located below the page content area, at the position where BacklinksPanel currently sits
- [ ] Two collapsible sections:
  - **Outgoing Links** (forward links from this page via wikilinks)
  - **Backlinks** (pages that link to this page)
- [ ] Each section header shows count: "Outgoing Links (5)" / "Backlinks (3)"
- [ ] Both sections collapsed by default; click to expand/collapse
- [ ] Remember collapse state per page (localStorage)

### Link Item Display
- [ ] Each link item shows:
  - Page icon (emoji or default `📄`)
  - Page title (truncated with ellipsis at 50 chars)
  - One-liner text below the title (muted color, smaller font)
  - If one-liner is null: show "No description" in italic
- [ ] Click on a link item navigates to that page
- [ ] Hover highlights the row (subtle background change)

### Expandable Summary
- [ ] Each link item has a small expand chevron (▶ / ▼) on the right
- [ ] Clicking the chevron (or the one-liner area) expands the row to show the full summary paragraph
- [ ] Expanded state shows:
  - Full summary text (2-4 sentences)
  - "Last updated: X ago" timestamp
  - If summary is null: "No summary available"
- [ ] Click chevron again to collapse

### Empty States
- [ ] Outgoing Links empty: "This page doesn't link to any other pages"
- [ ] Backlinks empty: "No pages link to this page yet"
- [ ] Both empty: Show a single message "No connections yet. Add [[wikilinks]] to connect pages."

### Data Fetching
- [ ] Uses existing `useForwardLinks(pageId)` hook for outgoing links (modified to include `oneLiner` and `summary`)
- [ ] Uses existing `useBacklinks(pageId)` hook for backlinks (modified to include `oneLiner` and `summary`)
- [ ] Both hooks use TanStack React Query with 30s stale time
- [ ] Loading state: skeleton rows (3 placeholder items per section)
- [ ] Error state: section hidden (fail silently, matching current BacklinksPanel behavior)

### Performance
- [ ] Only fetches data when section is expanded (lazy loading)
- [ ] Total link count (for headers) fetched separately with a lightweight count query
- [ ] No unnecessary re-renders when page content changes (memoized)

### Accessibility
- [ ] All sections keyboard-navigable (Tab, Enter, Space)
- [ ] ARIA roles for collapsible regions (`role="region"`, `aria-expanded`)
- [ ] Screen reader announces: "Outgoing Links section, 5 links, collapsed"

---

## Architecture Overview

```
Component Layout:
─────────────────

PageConnectionsPanel
├── SectionHeader ("Outgoing Links (5)")  ← click to expand/collapse
│   └── ConnectionList
│       ├── ConnectionItem (page icon + title + one-liner)
│       │   └── ExpandedSummary (full summary, last updated)
│       ├── ConnectionItem
│       └── ConnectionItem
│
├── SectionHeader ("Backlinks (3)")  ← click to expand/collapse
│   └── ConnectionList
│       ├── ConnectionItem
│       └── ConnectionItem
│
└── EmptyState (if no connections at all)


Data Flow:
──────────

PageConnectionsPanel
  ├── useForwardLinks(pageId)  → GET /api/pages/{id}/links
  │   returns: [{ pageId, pageTitle, pageIcon, oneLiner, summary, summaryUpdatedAt }]
  │
  └── useBacklinks(pageId)  → GET /api/pages/{id}/backlinks
      returns: [{ pageId, pageTitle, pageIcon, oneLiner, summary, summaryUpdatedAt }]


Visual Design:
──────────────

┌────────────────────────────────────────────────────┐
│ ▼ Outgoing Links (3)                               │
│                                                    │
│  🔑 JWT Token Reference                        ▶  │
│     Standard JWT claims and signing algorithms     │
│                                                    │
│  📡 REST API Overview                           ▼  │
│     Endpoint catalog for the public REST API       │
│     ┌────────────────────────────────────────┐     │
│     │ Complete reference of all public REST  │     │
│     │ API endpoints including authentication,│     │
│     │ pagination, and error response formats.│     │
│     │ Updated: 2 hours ago                   │     │
│     └────────────────────────────────────────┘     │
│                                                    │
│  🛡️ Rate Limiting                               ▶  │
│     Request rate limits and throttling policies    │
│                                                    │
│ ▶ Backlinks (2)                                    │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Modify Backlinks and Forward Links API Responses

**File: `src/app/api/pages/[id]/backlinks/route.ts`** (modify)

- Add `summary` and `summaryUpdatedAt` to the Prisma select (in addition to `oneLiner` from SKB-33.1)

**File: `src/app/api/pages/[id]/links/route.ts`** (modify or create)

- Add `oneLiner`, `summary`, `summaryUpdatedAt` to the response
- If this endpoint doesn't exist yet, create it:
  - Query `PageLink` where `sourcePageId = pageId`
  - Join target page for title, icon, oneLiner, summary, summaryUpdatedAt

### Step 2: Update Hooks to Include Summary Data

**File: `src/hooks/useBacklinks.ts`** (modify)

```typescript
// Update useBacklinks return type to include oneLiner, summary, summaryUpdatedAt
export interface BacklinkItem {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  oneLiner: string | null;
  summary: string | null;
  summaryUpdatedAt: string | null;
}
```

- Same update for `useForwardLinks`

### Step 3: Create ConnectionItem Component

**File: `src/components/page/ConnectionItem.tsx`** (create)

```typescript
interface ConnectionItemProps {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  oneLiner: string | null;
  summary: string | null;
  summaryUpdatedAt: string | null;
  onNavigate: (pageId: string) => void;
}

export function ConnectionItem({ ... }: ConnectionItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div onClick={() => onNavigate(pageId)} className="...">
      <div className="flex items-center gap-2">
        <span>{pageIcon || '📄'}</span>
        <div>
          <div className="font-medium truncate max-w-[300px]">{pageTitle}</div>
          <div className="text-sm text-muted">{oneLiner || 'No description'}</div>
        </div>
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>
      {expanded && (
        <div className="ml-8 mt-2 text-sm bg-muted/20 rounded p-2">
          <p>{summary || 'No summary available'}</p>
          {summaryUpdatedAt && <p className="text-xs mt-1">Updated: {timeAgo(summaryUpdatedAt)}</p>}
        </div>
      )}
    </div>
  );
}
```

### Step 4: Create PageConnectionsPanel Component

**File: `src/components/page/PageConnectionsPanel.tsx`** (create)

```typescript
interface PageConnectionsPanelProps {
  pageId: string;
}

export function PageConnectionsPanel({ pageId }: PageConnectionsPanelProps) {
  const forwardLinks = useForwardLinks(pageId);
  const backlinks = useBacklinks(pageId);
  const [forwardExpanded, setForwardExpanded] = useLocalStorage(`conn-fwd-${pageId}`, false);
  const [backExpanded, setBackExpanded] = useLocalStorage(`conn-back-${pageId}`, false);
  const navigate = useNavigateToPage();

  // Render section headers with counts
  // Render ConnectionItem for each link
  // Handle loading, error, empty states
}
```

### Step 5: Replace BacklinksPanel in Page Layout

**File: Page layout component** (modify)

- Remove `<BacklinksPanel pageId={pageId} />`
- Add `<PageConnectionsPanel pageId={pageId} />`
- Keep the same position in the layout

---

## Testing Requirements

### Unit Tests (8+ cases)

**File: `src/__tests__/components/page/PageConnectionsPanel.test.tsx`**

- Renders outgoing links section with correct count
- Renders backlinks section with correct count
- Each link shows icon, title, and one-liner
- Click on link item calls navigate
- Expand chevron reveals full summary
- Empty state message when no links
- Loading state shows skeletons
- Collapse state persisted in localStorage

**File: `src/__tests__/components/page/ConnectionItem.test.tsx`**

- Renders title and one-liner
- Null one-liner shows "No description"
- Click expands to show summary
- Null summary shows "No summary available"
- summaryUpdatedAt renders as relative time

### Integration Tests (3+ cases)

**File: `src/__tests__/integration/page-connections.test.ts`**

- Page with 3 forward links and 2 backlinks → both sections render correctly
- Forward links include oneLiner and summary from target pages
- Backlinks include oneLiner and summary from source pages

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/page/PageConnectionsPanel.tsx` | Create | Unified connections panel |
| `src/components/page/ConnectionItem.tsx` | Create | Individual link item with expandable summary |
| `src/app/api/pages/[id]/backlinks/route.ts` | Modify | Add summary and summaryUpdatedAt to response |
| `src/app/api/pages/[id]/links/route.ts` | Modify/Create | Add summary data to forward links response |
| `src/hooks/useBacklinks.ts` | Modify | Update types to include summary fields |
| `src/components/page/BacklinksPanel.tsx` | Deprecate | Replaced by PageConnectionsPanel |
| Page layout component | Modify | Swap BacklinksPanel for PageConnectionsPanel |
| Tests | Create | Unit + integration tests |

---

**Last Updated:** 2026-02-27
