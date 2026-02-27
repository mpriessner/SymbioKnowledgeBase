# Epic 21: Page Creation Enhancements, Database Views & AI Features

**Epic ID:** EPIC-21
**Created:** 2026-02-25
**Total Story Points:** 68
**Priority:** High
**Status:** Done
**Completed:** 2026-02-27
**Notes:** All 8 stories implemented: page creation menu, board/list/calendar/gallery/timeline views, AI page generation, meeting notes with voice transcription.

---

## Epic Overview

Epic 21 brings SymbioKnowledgeBase to feature parity with Notion's new page creation experience. When users create a new page, they should see a rich set of "Get started with" options — not just a blank page, but the ability to immediately scaffold a Table, Board (Kanban), List, Calendar, Timeline, or Gallery view. Additionally, this epic adds AI-powered page generation ("Ask AI") and voice-to-text meeting notes via Whisper transcription.

Currently, SymbioKnowledgeBase has:
- A single Table view for databases (EPIC-08)
- An AI chat popup (existing)
- Import/export via markdown (existing)
- The sidebar "+" button exists but lacks a creation dialog

This epic adds:
1. **New Page Creation Menu** — dropdown with Table, Board, List, Timeline, Calendar, Gallery, Import, and AI quick-start options
2. **Five new database views** — Board (Kanban), List, Calendar, Gallery, Timeline
3. **Ask AI page generation** — AI creates a page from a prompt
4. **AI Meeting Notes** — voice transcription via Whisper API + AI-powered cleanup into structured notes

Templates are **out of scope** for this epic (deferred to a future epic).

**Dependencies:**
- EPIC-08 (Database Table View) — table view infrastructure must exist (done)
- EPIC-04 (Block Editor) — TipTap editor must be working (done)
- Existing AI chat backend at `/api/ai/chat` (done)

---

## Business Value

- **Faster Page Creation:** Users go from "+" click to a working database or AI-generated page in seconds, not minutes
- **Notion Parity:** The five additional database views (Board, List, Calendar, Gallery, Timeline) match Notion's core views, removing a key migration barrier
- **AI-Native Workflows:** "Ask AI" and voice transcription turn SymbioKnowledgeBase into a tool that creates content, not just stores it
- **Voice-First Knowledge Capture:** Meeting notes via transcription let users capture knowledge hands-free, which AI then structures into clean, searchable pages
- **Structured Data Flexibility:** Same database, multiple views — users can see bugs as a table for sorting, a kanban for workflow, or a calendar for deadlines

---

## Architecture Summary

```
Page Creation & Database Views Architecture
──────────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────────┐
│  New Page Creation Flow                                               │
│                                                                        │
│  User clicks "+" in sidebar or "New page" in home                    │
│         │                                                              │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Page Creation Menu (bottom of new page)                         ││
│  │                                                                   ││
│  │  [Table] [Board] [List] [Timeline] [Calendar] [Gallery]         ││
│  │                                                                   ││
│  │  Get started with:                                                ││
│  │  [Ask AI] [AI Meeting Notes] [Database] [Import] [...]           ││
│  └─────────────────────────────────────────────────────────────────┘│
│         │                                                              │
│         ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  Action Handlers                                                  ││
│  │                                                                   ││
│  │  Table/Board/List/Calendar/Gallery/Timeline:                     ││
│  │    1. Create new Page                                             ││
│  │    2. Create Database with default schema                        ││
│  │    3. Set preferred view type                                     ││
│  │    4. Navigate to page (database inline)                         ││
│  │                                                                   ││
│  │  Ask AI:                                                          ││
│  │    1. Show prompt input                                           ││
│  │    2. Stream AI response → create page with generated content    ││
│  │                                                                   ││
│  │  AI Meeting Notes:                                                ││
│  │    1. Start microphone recording                                  ││
│  │    2. Send audio to Whisper API → get transcript                  ││
│  │    3. Send transcript to LLM → get structured notes              ││
│  │    4. Create page with structured meeting notes                  ││
│  │                                                                   ││
│  │  Import:                                                          ││
│  │    1. Open file picker (.md, .csv, .json)                        ││
│  │    2. Parse and convert to page content                          ││
│  └─────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Database Multi-View Architecture                                     │
│                                                                        │
│  Database model (existing):                                           │
│    { id, pageId, tenantId, schema: { columns: [...] } }              │
│                                                                        │
│  New: view_type field on Database or as URL param:                    │
│    "table" | "board" | "list" | "calendar" | "gallery" | "timeline"  │
│                                                                        │
│  View Components:                                                      │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐                      │
│    │ TableView │  │ BoardView │  │ ListView  │                      │
│    │ (exists)  │  │ (Kanban)  │  │ (compact) │                      │
│    └───────────┘  └───────────┘  └───────────┘                      │
│    ┌───────────┐  ┌───────────┐  ┌───────────┐                      │
│    │ Calendar  │  │ Gallery   │  │ Timeline  │                      │
│    │ View      │  │ View      │  │ View      │                      │
│    └───────────┘  └───────────┘  └───────────┘                      │
│                                                                        │
│  All views share:                                                      │
│    - Same database + rows data source                                 │
│    - Same filter/sort controls                                        │
│    - Same CRUD operations (create, edit, delete rows)                 │
│    - View switcher tabs at top of database                            │
│                                                                        │
│  View-specific config:                                                 │
│    Board: group_by_column (select type)                               │
│    Calendar: date_column (date type)                                  │
│    Gallery: cover_column (url/image type), title_column               │
│    Timeline: start_date_column, end_date_column                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-21.1: New Page Creation Menu & Quick Actions — 5 points, Critical

**Delivers:** When a user creates a new page (via sidebar "+"), the empty page shows a bottom menu bar with options: Table, Board, List, Timeline, Calendar, Gallery, plus "Get started with" quick actions (Ask AI, AI Meeting Notes, Database, Import). Selecting an option scaffolds the appropriate content.

**Depends on:** Nothing (first story, builds the shell)

---

### SKB-21.2: Database Board (Kanban) View — 10 points, High

**Delivers:** A Kanban board view for databases, grouped by a `select` column. Cards can be dragged between columns to update the grouping property. Each card shows the title and configurable property previews.

**Depends on:** SKB-21.1 (view switcher UI must exist)

---

### SKB-21.3: Database List View — 5 points, Medium

**Delivers:** A compact list view for databases. Each row shows title + selected visible properties in a single line. Clicking opens the row detail. Supports sorting and filtering (shared with table view).

**Depends on:** SKB-21.1 (view switcher UI must exist)

---

### SKB-21.4: Database Calendar View — 10 points, High

**Delivers:** A month/week calendar view for databases, placing rows on calendar days based on a date column. Users can click a day to create a new row, and drag rows between days to reschedule.

**Depends on:** SKB-21.1 (view switcher UI must exist)

---

### SKB-21.5: Database Gallery View — 8 points, Medium

**Delivers:** A card grid view for databases. Each card shows a cover image (from a URL column), title, and selected property previews. Supports configurable card size (small/medium/large).

**Depends on:** SKB-21.1 (view switcher UI must exist)

---

### SKB-21.6: Database Timeline View — 10 points, Medium

**Delivers:** A horizontal timeline (Gantt-style) view for databases, where rows span from a start date to an end date. Supports zooming (day/week/month) and dragging to resize/move date ranges.

**Depends on:** SKB-21.1 (view switcher UI must exist)

---

### SKB-21.7: Ask AI / AI Page Generation — 8 points, High

**Delivers:** An "Ask AI" option in the page creation menu. User types a prompt (e.g., "Create a project plan for launching a mobile app"), and the AI streams a complete page with headings, lists, and content. The generated content is saved as the page's blocks.

**Depends on:** SKB-21.1 (creation menu), existing AI chat backend

---

### SKB-21.8: AI Meeting Notes & Voice Transcription — 12 points, High

**Delivers:** An "AI Meeting Notes" option that records audio via the browser microphone, sends it to a speech-to-text API (OpenAI Whisper), then passes the raw transcript to an LLM which produces structured meeting notes (attendees, agenda, discussion, action items, decisions). The result is saved as a new page.

**Depends on:** SKB-21.1 (creation menu), SKB-21.7 (AI generation infrastructure)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 21.1 | Menu renders all options; click handlers fire correctly | Creating page + database via menu; navigation after creation | Click "+" → select Table → database appears with table view |
| 21.2 | Kanban column grouping; drag-drop state management | Board groups by select column; drag updates row property | Drag card from "Open" to "Resolved" → verify in table view |
| 21.3 | List row rendering; property visibility toggle | Sort/filter work in list view; click opens detail | List view renders all rows; sort by priority works |
| 21.4 | Month grid generation; date-to-cell mapping | Row appears on correct calendar day; drag reschedules | Click May 15 → create row → row appears on May 15 |
| 21.5 | Card grid layout; image fallback handling | Gallery renders cards with covers; filtering works | Gallery shows 8 cards; click opens detail |
| 21.6 | Timeline date range calculation; zoom levels | Rows span correct date range; drag extends end date | Timeline shows 3 rows spanning Feb-Mar |
| 21.7 | AI prompt validation; stream parsing | AI generates page from prompt; content saved as blocks | Type "project plan" → AI generates content → page saved |
| 21.8 | Audio recording state machine; transcript parsing | Whisper API call; LLM cleanup; page creation | Record 10s audio → transcript appears → notes generated |

---

## Implementation Order

```
21.1 → 21.2 → 21.3 → 21.4 → 21.5 → 21.6 → 21.7 → 21.8

┌────────┐     ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ 21.1   │────▶│ 21.2   │ │ 21.3   │ │ 21.4   │ │ 21.5   │ │ 21.6   │
│ Menu   │     │ Board  │ │ List   │ │ Cal    │ │ Gallery│ │ Time   │
└────────┘     └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
    │                ▲          ▲          ▲          ▲          ▲
    └────────────────┴──────────┴──────────┴──────────┴──────────┘
    │                    (all views depend on 21.1 for switcher)
    │
    ├─────▶┌────────┐     ┌────────┐
    │      │ 21.7   │────▶│ 21.8   │
    │      │ Ask AI │     │ Voice  │
    │      └────────┘     └────────┘
    │
    Note: Views 21.2-21.6 can be developed in parallel.
    21.7 and 21.8 can be developed in parallel with views.
```

---

## Shared Constraints

- **View Switcher:** All database views share a tab bar for switching between Table/Board/List/Calendar/Gallery/Timeline
- **Shared Data Layer:** All views use the same `useDatabaseRows` hook and filter/sort infrastructure
- **No New Dependencies (Views):** Use CSS Grid/Flexbox for layouts — avoid heavy calendar/timeline libraries unless justified
- **Responsive:** All views must work on screens >=768px wide (mobile out of scope but no hard breaks)
- **Performance:** Views must render 100+ rows without lag; virtualize long lists if needed
- **Drag-and-Drop:** Use existing `@dnd-kit` dependency for board and calendar drag operations
- **AI API Keys:** Voice transcription and AI generation use the user's configured API keys (from Settings > AI Configuration)
- **Privacy:** Audio is processed via API (not stored) — no audio files saved to server
- **TypeScript Strict:** No `any` types in new code
- **Theming:** All new components must support light and dark themes using CSS custom properties

---

## Database Schema Changes

```prisma
// Update existing Database model
model Database {
  // ... existing fields ...
  defaultView  String  @default("table") @map("default_view")
  // "table" | "board" | "list" | "calendar" | "gallery" | "timeline"

  viewConfig   Json?   @map("view_config")
  // Per-view configuration:
  // {
  //   board: { groupByColumn: "col-status" },
  //   calendar: { dateColumn: "col-date" },
  //   gallery: { coverColumn: "col-image", cardSize: "medium" },
  //   timeline: { startColumn: "col-start", endColumn: "col-end" }
  // }
}
```

---

## Files Created/Modified by This Epic

### New Files
- `src/components/page/PageCreationMenu.tsx` — Creation menu with quick actions
- `src/components/page/PageCreationModal.tsx` — Modal wrapper for creation options
- `src/components/database/ViewSwitcher.tsx` — Tab bar for switching database views
- `src/components/database/BoardView.tsx` — Kanban board view
- `src/components/database/ListView.tsx` — Compact list view
- `src/components/database/CalendarView.tsx` — Month/week calendar view
- `src/components/database/GalleryView.tsx` — Card grid view
- `src/components/database/TimelineView.tsx` — Gantt timeline view
- `src/components/database/DatabaseViewContainer.tsx` — Container routing to correct view
- `src/components/ai/AskAIDialog.tsx` — AI page generation prompt dialog
- `src/components/ai/VoiceRecorder.tsx` — Audio recording UI with waveform
- `src/components/ai/MeetingNotesGenerator.tsx` — Transcription + AI notes flow
- `src/hooks/useVoiceRecording.ts` — MediaRecorder hook
- `src/hooks/useDatabaseView.ts` — View state management (active view, config)
- `src/app/api/ai/transcribe/route.ts` — Whisper API proxy endpoint
- `src/app/api/ai/generate-page/route.ts` — AI page generation endpoint
- `src/lib/ai/meeting-notes-prompt.ts` — System prompt for meeting notes structuring
- `src/lib/ai/page-generation-prompt.ts` — System prompt for page generation
- Tests for each component and API route

### Modified Files
- `src/components/layout/Sidebar.tsx` — Wire "+" button to creation flow
- `src/components/database/TableView.tsx` — Extract shared filter/sort into reusable hook
- `src/components/workspace/PageEditor.tsx` — Show creation menu on empty pages
- `prisma/schema.prisma` — Add `defaultView` and `viewConfig` to Database model
- `src/types/database.ts` — Add view type definitions

---

**Last Updated:** 2026-02-25
