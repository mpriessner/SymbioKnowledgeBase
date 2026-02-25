# Story SKB-21.1: New Page Creation Menu & Quick Actions

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.1
**Story Points:** 5 | **Priority:** Critical | **Status:** Draft
**Depends On:** Nothing (first story, builds the shell)

---

## User Story

As a SymbioKnowledgeBase user, I want to see a rich "Get started with" menu when I create a new page, So that I can immediately scaffold a Table, Board, List, Calendar, Timeline, Gallery, or AI-generated page instead of staring at a blank page.

---

## Acceptance Criteria

### Page Creation Menu
- [ ] When a user creates a new page (via sidebar "+" or Cmd/Ctrl+N), an empty page is created and navigated to
- [ ] The empty page shows a "Get started with" section below the title area
- [ ] The menu displays two rows of options:
  - **Top row (database views):** Table, Board, List, Timeline, Calendar, Gallery — each with an icon and label
  - **Bottom row (quick actions):** Ask AI, AI Meeting Notes, Database, Import, and a "..." overflow menu
- [ ] Each option is a clickable card/button with an icon and label
- [ ] The menu disappears once the user starts typing content or selects an option
- [ ] The menu only appears on pages that have no content (empty pages)
- [ ] If the page already has blocks/content, the menu does not show

### Database View Quick Actions (Table, Board, List, Timeline, Calendar, Gallery)
- [ ] Clicking any database view option:
  1. Creates a new Database record linked to the current page
  2. Sets the database's `defaultView` to the selected view type
  3. Creates a default schema with columns: Title (title), Status (select: "Not started", "In progress", "Done"), Priority (select: "Low", "Medium", "High"), Date (date)
  4. Inserts a database block into the page content
  5. The database renders inline on the page with the selected view active
- [ ] The view switcher tabs appear above the database (Table | Board | List | Calendar | Gallery | Timeline)
- [ ] Clicking a different tab switches the view without losing data

### View Switcher Component
- [ ] Tab bar renders horizontally with icons + labels for each view type
- [ ] Active tab is visually highlighted (underline or background color)
- [ ] Clicking a tab updates the active view and persists it to the database's `defaultView`
- [ ] The "+" button at the end of the tab bar allows adding a saved view (future — just show the button disabled for now)
- [ ] View switcher supports light and dark themes

### Import Quick Action
- [ ] Clicking "Import" opens a file picker dialog
- [ ] Accepted file types: `.md`, `.csv`, `.json`
- [ ] `.md` files: parsed into page content using existing markdown import
- [ ] `.csv` files: creates a database with columns inferred from CSV headers and rows populated from CSV data
- [ ] `.json` files: if valid TipTap JSON, imports as page content; if array of objects, creates a database
- [ ] Shows progress indicator during import
- [ ] Shows error toast if file parsing fails

### Ask AI & AI Meeting Notes (Placeholder)
- [ ] "Ask AI" button is visible but clicking it shows a placeholder message: "Coming soon — see SKB-21.7"
- [ ] "AI Meeting Notes" button is visible but clicking it shows a placeholder: "Coming soon — see SKB-21.8"
- [ ] Both buttons are styled consistently with other options
- [ ] These will be fully implemented in SKB-21.7 and SKB-21.8

### Responsive & Theming
- [ ] Menu layout adapts to screen widths >= 768px (no hard breaks)
- [ ] All buttons/cards support light and dark themes via CSS custom properties
- [ ] Icons use Lucide React (consistent with existing codebase)

---

## Architecture Overview

```
Page Creation Menu Flow
────────────────────────

User clicks "+" in sidebar
        │
        ▼
┌──────────────────────────────────────────────────────────────────┐
│  useCreatePage().mutate({ title: "Untitled" })                    │
│  → New page created in DB                                         │
│  → router.push(`/pages/${newPage.id}`)                           │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  PageEditor renders page                                          │
│                                                                    │
│  if (page has no blocks or only empty paragraph):                 │
│    Show <PageCreationMenu pageId={page.id} />                    │
│  else:                                                            │
│    Show <BlockEditor />                                           │
└──────────────────────┬───────────────────────────────────────────┘
                       │
        User clicks "Board" option
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  handleCreateDatabaseView("board")                                │
│                                                                    │
│  1. POST /api/databases                                           │
│     body: {                                                       │
│       pageId: page.id,                                            │
│       schema: { columns: DEFAULT_COLUMNS },                      │
│       defaultView: "board"                                        │
│     }                                                             │
│     → Returns: { id: "db-123", ... }                             │
│                                                                    │
│  2. Insert database block into page                               │
│     BlockEditor.insertContent({                                   │
│       type: "database",                                           │
│       attrs: { databaseId: "db-123" }                            │
│     })                                                            │
│                                                                    │
│  3. PageCreationMenu disappears (page now has content)           │
│                                                                    │
│  4. DatabaseViewContainer renders with:                           │
│     - ViewSwitcher (Board tab active)                             │
│     - BoardView component                                         │
└──────────────────────────────────────────────────────────────────┘

Component Tree:
───────────────

PageEditor
├── PageHeader (title, icon, cover)
├── PageCreationMenu (shown if empty page)
│   ├── ViewOptionGrid (Table, Board, List, Timeline, Calendar, Gallery)
│   └── QuickActionBar (Ask AI, AI Meeting Notes, Database, Import, ...)
└── BlockEditor (shown if page has content)
    └── DatabaseNode (TipTap node extension)
        └── DatabaseViewContainer
            ├── ViewSwitcher (tabs)
            └── TableView | BoardView | ListView | CalendarView | GalleryView | TimelineView
```

---

## Implementation Steps

### Step 1: Add Database Schema Fields

**File: `prisma/schema.prisma`**

Add `defaultView` and `viewConfig` fields to the existing Database model:

```prisma
model Database {
  // ... existing fields ...
  defaultView  String  @default("table") @map("default_view")
  viewConfig   Json?   @map("view_config")
}
```

Run migration:
```bash
npx prisma migrate dev --name add-database-view-fields
```

### Step 2: Update Database Types

**File: `src/types/database.ts`**

Add view-related types:

```typescript
export type DatabaseViewType = "table" | "board" | "list" | "calendar" | "gallery" | "timeline";

export interface ViewConfig {
  board?: { groupByColumn: string };
  calendar?: { dateColumn: string };
  gallery?: { coverColumn: string; cardSize: "small" | "medium" | "large" };
  timeline?: { startColumn: string; endColumn: string };
}

export const DEFAULT_COLUMNS: Column[] = [
  { id: "col-title", name: "Title", type: "TITLE" },
  { id: "col-status", name: "Status", type: "SELECT", options: ["Not started", "In progress", "Done"] },
  { id: "col-priority", name: "Priority", type: "SELECT", options: ["Low", "Medium", "High"] },
  { id: "col-date", name: "Date", type: "DATE" },
];
```

### Step 3: Create PageCreationMenu Component

**File: `src/components/page/PageCreationMenu.tsx`**

```typescript
interface PageCreationMenuProps {
  pageId: string;
  onAction: () => void; // Called after any action to hide the menu
}

// Renders the two-row menu:
// Row 1: Database view options (Table, Board, List, Timeline, Calendar, Gallery)
// Row 2: Quick actions (Ask AI, AI Meeting Notes, Database, Import, ...)
//
// Each database view option calls handleCreateDatabaseView(viewType)
// Import calls handleImport() which opens a file picker
// Ask AI / AI Meeting Notes show placeholder toasts
```

### Step 4: Create ViewSwitcher Component

**File: `src/components/database/ViewSwitcher.tsx`**

```typescript
interface ViewSwitcherProps {
  databaseId: string;
  activeView: DatabaseViewType;
  onViewChange: (view: DatabaseViewType) => void;
}

// Renders a horizontal tab bar:
// [Table] [Board] [List] [Calendar] [Gallery] [Timeline] [+]
//
// Active tab has underline/highlight
// Clicking a tab calls onViewChange(viewType)
// "+" button is disabled (future: saved views)
```

### Step 5: Create DatabaseViewContainer Component

**File: `src/components/database/DatabaseViewContainer.tsx`**

```typescript
interface DatabaseViewContainerProps {
  databaseId: string;
  schema: DatabaseSchema;
}

// Manages active view state (from database.defaultView)
// Renders ViewSwitcher + the appropriate view component
// Routes to: TableView | BoardView | ListView | CalendarView | GalleryView | TimelineView
// Board/List/Calendar/Gallery/Timeline show "Coming soon" placeholder until their stories are done
```

### Step 6: Create useDatabaseView Hook

**File: `src/hooks/useDatabaseView.ts`**

```typescript
function useDatabaseView(databaseId: string) {
  // Returns:
  // - activeView: DatabaseViewType (from database record)
  // - setActiveView: (view: DatabaseViewType) => void (updates DB + local state)
  // - viewConfig: ViewConfig (per-view settings)
  // - updateViewConfig: (config: Partial<ViewConfig>) => void
}
```

### Step 7: Wire PageCreationMenu into PageEditor

**File: `src/components/workspace/PageEditor.tsx`** (modify)

Add logic to detect empty pages and show PageCreationMenu:

```typescript
// Inside PageEditor component:
const isEmptyPage = !page.blocks || page.blocks.length === 0 ||
  (page.blocks.length === 1 && page.blocks[0].type === "PARAGRAPH" && !page.blocks[0].content);

return (
  <>
    <PageHeader ... />
    {isEmptyPage ? (
      <PageCreationMenu pageId={page.id} onAction={() => refetch()} />
    ) : (
      <BlockEditor ... />
    )}
  </>
);
```

### Step 8: Update Database API for New Fields

**File: `src/app/api/databases/route.ts`** (modify POST handler)

Accept `defaultView` and `viewConfig` in the create database request body. Validate that `defaultView` is one of the allowed view types.

### Step 9: CSV Import Utility

**File: `src/lib/import/csv-import.ts`**

```typescript
export function parseCSVToDatabase(csvText: string): {
  schema: DatabaseSchema;
  rows: RowProperties[];
} {
  // 1. Parse CSV headers → column definitions
  // 2. Infer column types from first 10 rows (number, date, text)
  // 3. Generate column IDs
  // 4. Parse all rows → RowProperties[]
}
```

---

## Testing Requirements

### Unit Tests (15+ cases)

**File: `src/__tests__/components/page/PageCreationMenu.test.tsx`**

- Menu renders all 6 database view options (Table, Board, List, Timeline, Calendar, Gallery)
- Menu renders all quick action buttons (Ask AI, AI Meeting Notes, Database, Import)
- Clicking "Table" calls create database handler with viewType="table"
- Clicking "Board" calls create database handler with viewType="board"
- Clicking "Import" opens file picker
- Ask AI shows placeholder toast
- AI Meeting Notes shows placeholder toast
- Menu is not rendered when page has content
- Menu is rendered when page is empty
- Menu disappears after an action is taken

**File: `src/__tests__/components/database/ViewSwitcher.test.tsx`**

- Renders all 6 view tabs
- Active tab is highlighted
- Clicking a tab fires onViewChange with correct view type
- "+" button is present and disabled
- Supports dark theme class names

**File: `src/__tests__/lib/import/csv-import.test.ts`**

- Parses CSV with headers into schema + rows
- Infers NUMBER column type for numeric data
- Infers DATE column type for ISO date strings
- Defaults to TEXT for mixed data
- Handles empty CSV gracefully
- Handles CSV with only headers (no rows)
- Handles quoted fields with commas

### Integration Tests (10+ cases)

**File: `src/__tests__/integration/page-creation-menu.test.tsx`**

- Creating page + selecting Table → database created with defaultView="table"
- Creating page + selecting Board → database created with defaultView="board"
- Database schema has 4 default columns (Title, Status, Priority, Date)
- ViewSwitcher renders after database creation
- Active view matches selected option
- Switching view tab updates database.defaultView via API
- Import .md file → page content populated
- Import .csv file → database created with inferred columns and rows
- Import .json file (TipTap) → page content populated
- Import .json file (array) → database created with rows

### E2E Tests (5+ cases)

**File: `src/__tests__/e2e/page-creation.test.ts`**

- Click "+" in sidebar → new page created → creation menu visible
- Select "Table" → database with table view appears inline
- Select "Board" → database with board view appears inline
- Import a .csv file → database created with correct columns and 5+ rows
- Start typing in title → creation menu disappears; content saved

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modify | Add `defaultView` and `viewConfig` to Database model |
| `src/types/database.ts` | Modify | Add `DatabaseViewType`, `ViewConfig`, `DEFAULT_COLUMNS` |
| `src/components/page/PageCreationMenu.tsx` | Create | Main creation menu with view options and quick actions |
| `src/components/database/ViewSwitcher.tsx` | Create | Tab bar for switching between database views |
| `src/components/database/DatabaseViewContainer.tsx` | Create | Container that routes to the correct view component |
| `src/hooks/useDatabaseView.ts` | Create | Hook for managing active view and config |
| `src/lib/import/csv-import.ts` | Create | CSV to database schema/rows parser |
| `src/components/workspace/PageEditor.tsx` | Modify | Show PageCreationMenu on empty pages |
| `src/app/api/databases/route.ts` | Modify | Accept `defaultView` and `viewConfig` in POST |
| `src/__tests__/components/page/PageCreationMenu.test.tsx` | Create | Unit tests for creation menu |
| `src/__tests__/components/database/ViewSwitcher.test.tsx` | Create | Unit tests for view switcher |
| `src/__tests__/lib/import/csv-import.test.ts` | Create | Unit tests for CSV import |
| `src/__tests__/integration/page-creation-menu.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/page-creation.test.ts` | Create | End-to-end tests |

---

**Last Updated:** 2026-02-25
