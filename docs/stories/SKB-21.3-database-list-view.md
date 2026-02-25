# Story SKB-21.3: Database List View

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.3
**Story Points:** 5 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-21.1 (ViewSwitcher and DatabaseViewContainer must exist)

---

## User Story

As a SymbioKnowledgeBase user, I want a compact list view for my databases, So that I can quickly scan all items with key properties visible on a single line without the overhead of a full table.

---

## Acceptance Criteria

### List Layout
- [ ] Each row renders as a single horizontal line: `[checkbox?] Title — Property1 · Property2 · Property3`
- [ ] The TITLE column always shows first, left-aligned, and takes available space
- [ ] Additional visible properties are right-aligned as small badges/labels separated by dots
- [ ] Rows have a subtle separator (border-bottom or alternating background)
- [ ] Rows are compact: ~36px height (vs ~44px in table view)
- [ ] Hovering a row highlights it with a subtle background color

### Property Visibility
- [ ] Users can configure which properties appear in the list via a "Properties" dropdown
- [ ] Default visible properties: Status, Priority (first two non-title properties)
- [ ] Toggling a property on/off updates the list immediately
- [ ] Property badges are color-coded for SELECT columns (same colors as table/board views)

### Row Interactions
- [ ] Clicking a row opens the row detail (navigates to row page or opens inline editor)
- [ ] Checkbox on the left (if database has a CHECKBOX column) can be toggled inline
- [ ] Hovering a row shows a subtle "..." menu icon on the right (delete, duplicate, open in new tab)
- [ ] Right-click on a row opens a context menu with the same options

### Create New Row
- [ ] "+" button at the bottom of the list creates a new row
- [ ] New row appears at the bottom with focus on the title field for inline editing
- [ ] Pressing Enter confirms the title and moves focus to the next new row (quick entry)

### Sorting & Filtering
- [ ] List view shares the same filter/sort bar as Table view (reuses `useTableFilters`)
- [ ] Sort indicator shows which column is sorted and direction
- [ ] Clicking column name in the header area toggles sort (if a header bar is shown)
- [ ] Grouping: optionally group list items by a SELECT column (rendered as section headers)

### Empty State
- [ ] Empty database shows: "No items yet. Click + to add your first item."
- [ ] Filtered view with no matches shows: "No items match the current filter."

### Performance
- [ ] List renders 500+ rows without visible lag
- [ ] Uses virtualization (e.g., `react-virtual`) for lists over 100 items
- [ ] Keyboard navigation: Arrow Up/Down moves selection between rows

---

## Architecture Overview

```
List View Component Tree
─────────────────────────

DatabaseViewContainer
├── ViewSwitcher (List tab active)
├── ListToolbar
│   ├── PropertyVisibilityToggle (dropdown to show/hide properties)
│   ├── GroupByToggle (optional: group by a SELECT column)
│   ├── SortSelector
│   └── FilterBar (shared)
└── ListView
    ├── ListGroup (if grouping enabled)
    │   ├── GroupHeader ("In progress" — 5 items)
    │   ├── ListRow (row 1)
    │   ├── ListRow (row 2)
    │   └── ...
    ├── ListGroup ("Done" — 3 items)
    │   └── ...
    └── AddRowButton (+)

ListRow layout:
┌─────────────────────────────────────────────────────────────────┐
│ [☐] Build login page           In progress · High · Feb 25     │
│ [☑] Design database schema     Done · Medium · Feb 20          │
│ [☐] Write API docs             Not started · Low               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create ListView Component

**File: `src/components/database/ListView.tsx`**

```typescript
interface ListViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

// 1. Fetch rows via useDatabaseRows(databaseId)
// 2. Apply filters and sorting via useTableFilters(rows)
// 3. Optionally group by a SELECT column
// 4. Render ListRow for each row
// 5. Virtualize if > 100 rows
```

### Step 2: Create ListRow Component

**File: `src/components/database/ListRow.tsx`**

```typescript
interface ListRowProps {
  row: DbRowWithPage;
  schema: DatabaseSchema;
  visibleProperties: string[]; // Column IDs to show
  isSelected: boolean;
  onSelect: () => void;
  onClick: () => void;
  onCheckboxToggle?: (checked: boolean) => void;
}

// Renders a single compact row:
// [Checkbox?] Title ——————— Badge1 · Badge2 · Badge3 [...]
// Hover: highlight background, show "..." menu
```

### Step 3: Create PropertyVisibilityToggle

**File: `src/components/database/PropertyVisibilityToggle.tsx`**

```typescript
interface PropertyVisibilityToggleProps {
  schema: DatabaseSchema;
  visibleColumns: string[];
  onToggle: (columnId: string) => void;
}

// Dropdown with checkboxes for each non-title column
// Toggling adds/removes column from visible list
```

### Step 4: Add Keyboard Navigation

Inside `ListView`, add keyboard event handlers:

```typescript
// Arrow Up/Down: move selected row
// Enter: open selected row
// Space: toggle checkbox on selected row
// Escape: deselect
// Cmd+N: focus "add row" input
```

### Step 5: Wire into DatabaseViewContainer

**File: `src/components/database/DatabaseViewContainer.tsx`** (modify)

```typescript
case "list":
  return <ListView databaseId={databaseId} schema={schema} viewConfig={viewConfig} onViewConfigChange={updateViewConfig} />;
```

---

## Testing Requirements

### Unit Tests (15+ cases)

**File: `src/__tests__/components/database/ListView.test.tsx`**

- List renders correct number of rows
- Each row shows title from TITLE column
- Visible properties appear as badges in correct order
- SELECT properties show colored badges
- Clicking a row fires onClick handler
- Checkbox toggle fires onCheckboxToggle
- Hover shows row highlight
- Hover shows "..." menu icon
- Empty database shows empty state message
- Filtered empty shows "No items match" message
- Add row button is visible at bottom

**File: `src/__tests__/components/database/ListRow.test.tsx`**

- Row renders title and properties in single line
- Checkbox renders when CHECKBOX column exists
- Selected row has highlight styling
- "..." menu has delete, duplicate, open in new tab options

**File: `src/__tests__/components/database/PropertyVisibilityToggle.test.tsx`**

- Lists all non-title columns
- Checked columns match visibleColumns prop
- Toggling fires onToggle with correct column ID

### Integration Tests (8+ cases)

**File: `src/__tests__/integration/list-view.test.tsx`**

- List view renders with data from useDatabaseRows
- Sorting by column updates row order
- Filtering hides non-matching rows
- Toggling property visibility adds/removes badges
- Creating row via "+" adds row to bottom of list
- Checkbox toggle updates row property via API
- Keyboard Arrow Down moves selection
- Grouping by Status shows section headers

### E2E Tests (3+ cases)

**File: `src/__tests__/e2e/list-view.test.ts`**

- Switch to List view → compact rows visible with properties
- Click "+" → new row created → title editable inline
- Sort by Priority → rows reorder correctly

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/database/ListView.tsx` | Create | Main list view component |
| `src/components/database/ListRow.tsx` | Create | Single row component |
| `src/components/database/PropertyVisibilityToggle.tsx` | Create | Property show/hide dropdown |
| `src/components/database/DatabaseViewContainer.tsx` | Modify | Wire ListView into view router |
| `src/__tests__/components/database/ListView.test.tsx` | Create | Unit tests |
| `src/__tests__/components/database/ListRow.test.tsx` | Create | Row unit tests |
| `src/__tests__/components/database/PropertyVisibilityToggle.test.tsx` | Create | Toggle tests |
| `src/__tests__/integration/list-view.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/list-view.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
