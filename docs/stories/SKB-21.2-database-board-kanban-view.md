# Story SKB-21.2: Database Board (Kanban) View

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.2
**Story Points:** 10 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-21.1 (ViewSwitcher and DatabaseViewContainer must exist)

---

## User Story

As a SymbioKnowledgeBase user, I want to view my database as a Kanban board grouped by a select column, So that I can visualize workflow stages and drag items between columns to update their status.

---

## Acceptance Criteria

### Board Layout
- [ ] Board renders as horizontal columns, one per option value of the `groupByColumn`
- [ ] Default `groupByColumn` is the first `SELECT` type column in the schema (typically "Status")
- [ ] Each column shows a header with the option label, a count badge, and a "+" button to add a new row
- [ ] An "Uncategorized" column appears for rows that have no value for the group-by column
- [ ] Columns scroll horizontally if there are more than fit the viewport
- [ ] Each column scrolls vertically independently if it has many cards

### Card Rendering
- [ ] Each card shows the row's title (from the TITLE column)
- [ ] Below the title, cards show up to 3 configurable property previews (small badges/labels)
- [ ] Default visible properties: Priority, Date (configurable in the future)
- [ ] Cards have subtle borders and rounded corners, consistent with the design system
- [ ] Clicking a card navigates to the row's detail page (if it has an associated page) or opens an inline editor
- [ ] Cards support light and dark themes

### Drag and Drop
- [ ] Cards can be dragged within a column to reorder (updates row position)
- [ ] Cards can be dragged between columns to change the group-by property value
- [ ] Dragging a card from "In progress" to "Done" updates the row's Status property to "Done"
- [ ] Drag overlay shows a ghost card following the cursor
- [ ] Drop zones highlight when a card is dragged over them
- [ ] Drag operations are optimistic (UI updates immediately, API call in background)
- [ ] If the API call fails, the card snaps back to its original position with an error toast
- [ ] Uses existing `@dnd-kit` library (already a project dependency)

### Group-By Configuration
- [ ] A "Group by" dropdown above the board lets the user select which `SELECT` column to group by
- [ ] Only `SELECT` and `MULTI_SELECT` columns appear in the dropdown
- [ ] Changing the group-by column re-renders the board with new columns
- [ ] The selected group-by column is persisted in `viewConfig.board.groupByColumn`

### Empty States
- [ ] Empty column shows "No items" message and a prominent "+" button
- [ ] If the database has no rows, show a centered message: "No items yet. Click + to add one."
- [ ] If the database has no SELECT columns, show a message: "Add a Select column to use Board view"

### Filtering & Sorting
- [ ] Board view shares the same filter bar as Table view (reuses `useTableFilters`)
- [ ] Filters apply across all columns (filtered-out cards disappear)
- [ ] Sort order within each column is by row position (default) or a user-selected column

### Performance
- [ ] Board renders 100+ cards across 5-6 columns without visible lag
- [ ] Drag operations complete in <100ms (optimistic update)
- [ ] Uses virtualization for columns with 50+ cards

---

## Architecture Overview

```
Board View Component Architecture
───────────────────────────────────

DatabaseViewContainer
├── ViewSwitcher (Board tab active)
├── BoardToolbar
│   ├── GroupBySelector (dropdown: Status, Priority, ...)
│   └── FilterBar (shared with TableView)
└── BoardView
    ├── DndContext (@dnd-kit)
    │   ├── SortableContext (horizontal columns)
    │   │   ├── BoardColumn (key="Not started")
    │   │   │   ├── ColumnHeader ("Not started", count: 3, + button)
    │   │   │   └── SortableContext (vertical cards)
    │   │   │       ├── BoardCard (row 1)
    │   │   │       ├── BoardCard (row 2)
    │   │   │       └── BoardCard (row 3)
    │   │   ├── BoardColumn (key="In progress")
    │   │   │   └── ...
    │   │   └── BoardColumn (key="Done")
    │   │       └── ...
    │   └── DragOverlay
    │       └── BoardCard (ghost)
    └── BoardColumn (key="Uncategorized")

Data Flow:
──────────

useDatabaseRows(databaseId)
  │  returns: rows[], createRow, updateRow, deleteRow
  │
  ▼
groupRowsByColumn(rows, groupByColumnId)
  │  returns: Map<string, Row[]>
  │  "Not started" → [row1, row4, row7]
  │  "In progress"  → [row2, row5]
  │  "Done"          → [row3, row6]
  │  "Uncategorized" → [row8]
  │
  ▼
BoardView renders one BoardColumn per group

Drag & Drop:
─────────────

User drags card from "In progress" → "Done"
  │
  ├── Optimistic: Move card in local state immediately
  │
  ├── API: updateRow(rowId, { properties: { "col-status": { type: "SELECT", value: "Done" } } })
  │
  ├── Success: React Query cache invalidated, confirms new state
  │
  └── Failure: Revert to previous state, show error toast
```

---

## Implementation Steps

### Step 1: Create Board View Component

**File: `src/components/database/BoardView.tsx`**

```typescript
interface BoardViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

// Main component:
// 1. Fetch rows via useDatabaseRows(databaseId)
// 2. Determine groupByColumn from viewConfig.board?.groupByColumn or first SELECT column
// 3. Group rows by the column value using groupRowsByColumn()
// 4. Render DndContext with SortableContexts for columns and cards
// 5. Handle onDragEnd to update row property
```

### Step 2: Create BoardColumn Component

**File: `src/components/database/BoardColumn.tsx`**

```typescript
interface BoardColumnProps {
  columnId: string;       // The option value (e.g., "In progress")
  label: string;          // Display label
  rows: DbRowWithPage[];  // Rows in this column
  schema: DatabaseSchema; // For rendering property previews
  onAddRow: () => void;   // Create new row in this column
}

// Renders:
// - Column header with label, count badge, "+" button
// - SortableContext with vertical strategy
// - List of BoardCard components
// - Drop zone highlight when dragging over
```

### Step 3: Create BoardCard Component

**File: `src/components/database/BoardCard.tsx`**

```typescript
interface BoardCardProps {
  row: DbRowWithPage;
  schema: DatabaseSchema;
  visibleProperties: string[]; // Column IDs to show as previews
  onClick: () => void;
}

// Renders:
// - Title from TITLE column
// - Up to 3 property preview badges
// - Subtle card styling (border, rounded corners, shadow)
// - useSortable() from @dnd-kit for drag handle
```

### Step 4: Create GroupBySelector Component

**File: `src/components/database/GroupBySelector.tsx`**

```typescript
interface GroupBySelectorProps {
  schema: DatabaseSchema;
  selectedColumnId: string;
  onSelect: (columnId: string) => void;
}

// Dropdown that lists SELECT and MULTI_SELECT columns
// Selected column shown as label
// Changing selection calls onSelect → updates viewConfig
```

### Step 5: Implement Row Grouping Utility

**File: `src/lib/database/group-rows.ts`**

```typescript
export function groupRowsByColumn(
  rows: DbRowWithPage[],
  columnId: string,
  columnOptions: string[]
): Map<string, DbRowWithPage[]> {
  // Creates a Map with one entry per option value
  // Plus "Uncategorized" for rows without a value
  // Maintains option order from column.options
  // Empty groups still appear (empty columns on board)
}
```

### Step 6: Implement Drag-and-Drop Handlers

Inside `BoardView.tsx`, implement:

```typescript
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over) return;

  const activeRowId = active.id as string;
  const overColumnId = extractColumnId(over);

  // Find the row's current group value
  const currentValue = getRowPropertyValue(activeRowId, groupByColumnId);

  if (currentValue !== overColumnId) {
    // Optimistic update: move card in local grouped state
    setOptimisticGroups(prev => moveCard(prev, activeRowId, currentValue, overColumnId));

    // API call: update the row's property
    updateRow.mutate(
      { rowId: activeRowId, properties: { [groupByColumnId]: { type: "SELECT", value: overColumnId } } },
      { onError: () => revertOptimisticUpdate() }
    );
  }
}
```

### Step 7: Wire into DatabaseViewContainer

**File: `src/components/database/DatabaseViewContainer.tsx`** (modify)

Replace the "Board" placeholder with the actual `BoardView` component:

```typescript
case "board":
  return <BoardView databaseId={databaseId} schema={schema} viewConfig={viewConfig} onViewConfigChange={updateViewConfig} />;
```

### Step 8: Update API to Handle viewConfig

**File: `src/app/api/databases/[id]/route.ts`** (modify)

Add PATCH/PUT handler that accepts `viewConfig` updates:

```typescript
export async function PATCH(req, { params }) {
  const body = await req.json();
  const updated = await prisma.database.update({
    where: { id: params.id, tenantId },
    data: {
      defaultView: body.defaultView,
      viewConfig: body.viewConfig,
    },
  });
  return NextResponse.json({ data: updated });
}
```

---

## Testing Requirements

### Unit Tests (20+ cases)

**File: `src/__tests__/components/database/BoardView.test.tsx`**

- Board renders correct number of columns based on SELECT options
- "Uncategorized" column appears when rows have empty group-by value
- Cards appear in the correct column based on their property value
- Card shows title from TITLE column
- Card shows up to 3 property preview badges
- Clicking a card fires onClick handler
- Empty column shows "No items" message
- Empty database shows "No items yet" message
- No SELECT column shows "Add a Select column" message

**File: `src/__tests__/components/database/BoardColumn.test.tsx`**

- Column header shows label and count
- "+" button fires onAddRow handler
- Cards render in correct order
- Column scrolls when many cards

**File: `src/__tests__/lib/database/group-rows.test.ts`**

- Groups rows correctly by column value
- Empty groups still appear in result
- "Uncategorized" group for rows without value
- Maintains option order from column definition
- Handles MULTI_SELECT (row appears in multiple groups)
- Empty rows array returns all groups empty
- Missing column returns all rows as Uncategorized

**File: `src/__tests__/components/database/GroupBySelector.test.tsx`**

- Only shows SELECT and MULTI_SELECT columns
- Selected column is highlighted
- Changing selection fires onSelect

### Integration Tests (10+ cases)

**File: `src/__tests__/integration/board-view.test.tsx`**

- Board view renders with data from useDatabaseRows
- Dragging card between columns updates row property via API
- Optimistic update moves card immediately before API response
- API failure reverts card to original column
- Creating row via "+" in column sets correct property value
- Changing group-by column re-renders board with new grouping
- Filter applied → only matching cards visible across columns
- ViewConfig persisted to database on group-by change
- Board renders correctly after switching from Table view

### E2E Tests (5+ cases)

**File: `src/__tests__/e2e/board-view.test.ts`**

- Create database with Board view → board renders with default Status columns
- Drag card from "Not started" to "In progress" → card appears in new column, value updated in table view
- Click "+" in "Done" column → new row created with Status = "Done"
- Change group-by to "Priority" → columns change to "Low", "Medium", "High"
- Click card → navigates to row detail / opens inline editor

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/database/BoardView.tsx` | Create | Main Kanban board view component |
| `src/components/database/BoardColumn.tsx` | Create | Individual column with cards |
| `src/components/database/BoardCard.tsx` | Create | Draggable card component |
| `src/components/database/GroupBySelector.tsx` | Create | Group-by column dropdown |
| `src/lib/database/group-rows.ts` | Create | Row grouping utility |
| `src/components/database/DatabaseViewContainer.tsx` | Modify | Wire BoardView into view router |
| `src/app/api/databases/[id]/route.ts` | Modify | Add PATCH for viewConfig updates |
| `src/__tests__/components/database/BoardView.test.tsx` | Create | Board view unit tests |
| `src/__tests__/components/database/BoardColumn.test.tsx` | Create | Column unit tests |
| `src/__tests__/lib/database/group-rows.test.ts` | Create | Grouping utility tests |
| `src/__tests__/components/database/GroupBySelector.test.tsx` | Create | Selector unit tests |
| `src/__tests__/integration/board-view.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/board-view.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
