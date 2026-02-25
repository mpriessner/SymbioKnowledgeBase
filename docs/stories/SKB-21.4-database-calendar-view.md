# Story SKB-21.4: Database Calendar View

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.4
**Story Points:** 10 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-21.1 (ViewSwitcher and DatabaseViewContainer must exist)

---

## User Story

As a SymbioKnowledgeBase user, I want to view my database rows on a month/week calendar based on a date column, So that I can visualize deadlines, events, and schedules at a glance and quickly reschedule items by dragging them between days.

---

## Acceptance Criteria

### Calendar Grid (Month View)
- [ ] Renders a standard month grid: 7 columns (Mon-Sun or Sun-Sat based on locale), ~5 rows
- [ ] Each cell represents a day and shows the day number
- [ ] Today's cell is highlighted with a distinct background or border
- [ ] Days outside the current month are dimmed (greyed out)
- [ ] Navigation: "<" and ">" arrows to move to previous/next month
- [ ] Current month and year displayed as header (e.g., "February 2026")
- [ ] "Today" button resets to the current month

### Calendar Grid (Week View)
- [ ] Renders 7 day columns with full-day rows
- [ ] Each column header shows day name + date (e.g., "Mon 24")
- [ ] Navigation: "<" and ">" arrows to move to previous/next week
- [ ] Toggle between Month and Week view via a small button group

### Row Placement
- [ ] Rows appear on the calendar day matching their date column value
- [ ] Default `dateColumn` is the first `DATE` type column in the schema
- [ ] Each row renders as a small card/pill on the day cell showing the title
- [ ] If a day has more than 3 items, show "+N more" link that expands the full list
- [ ] Rows without a date value are shown in a "No date" section below the calendar

### Date Column Configuration
- [ ] A "Date property" dropdown above the calendar lets the user select which DATE column to use
- [ ] Only `DATE` type columns appear in the dropdown
- [ ] Changing the date column re-renders the calendar with new placements
- [ ] Selection persisted in `viewConfig.calendar.dateColumn`

### Drag and Drop
- [ ] Cards/pills on calendar days can be dragged to a different day
- [ ] Dropping on a new day updates the row's date property to the target date
- [ ] Drag uses `@dnd-kit` with a custom calendar collision detection strategy
- [ ] Drag overlay shows a ghost card following the cursor
- [ ] Optimistic update: card moves immediately, API call in background
- [ ] API failure reverts card to original day with error toast

### Create Row on Day
- [ ] Clicking on an empty day cell (or the "+" that appears on hover) creates a new row
- [ ] The new row's date property is pre-set to the clicked day
- [ ] An inline title input appears for quick entry
- [ ] Pressing Enter confirms and the row card appears on that day

### Filtering
- [ ] Calendar view shares the same filter bar as Table view
- [ ] Filtered rows are hidden from the calendar
- [ ] Filter count badge shows how many rows are hidden

### Visual Design
- [ ] Clean grid with subtle borders between days
- [ ] Cards/pills use the same color coding as Board view (from SELECT property colors)
- [ ] Supports light and dark themes via CSS custom properties
- [ ] Weekend columns optionally dimmed (configurable)

### Performance
- [ ] Calendar renders 200+ rows placed across a month without lag
- [ ] Only renders rows visible in the current month/week (no off-screen rendering)

---

## Architecture Overview

```
Calendar View Component Architecture
──────────────────────────────────────

DatabaseViewContainer
├── ViewSwitcher (Calendar tab active)
├── CalendarToolbar
│   ├── DateColumnSelector (dropdown: Date, Due Date, ...)
│   ├── ViewModeToggle (Month | Week)
│   ├── NavigationArrows (< February 2026 >)
│   ├── TodayButton
│   └── FilterBar (shared)
└── CalendarView
    ├── CalendarHeader (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    ├── DndContext (@dnd-kit)
    │   ├── CalendarGrid
    │   │   ├── CalendarWeekRow (week 1)
    │   │   │   ├── CalendarDayCell (Feb 1) — [DroppableArea]
    │   │   │   │   ├── CalendarEventPill (row 1) — [Draggable]
    │   │   │   │   └── CalendarEventPill (row 2)
    │   │   │   ├── CalendarDayCell (Feb 2)
    │   │   │   │   └── "+3 more" link
    │   │   │   └── ...
    │   │   ├── CalendarWeekRow (week 2)
    │   │   └── ...
    │   └── DragOverlay
    │       └── CalendarEventPill (ghost)
    └── NoDateSection
        └── CalendarEventPill (rows without dates)

Data Flow:
──────────

useDatabaseRows(databaseId)
  │
  ▼
mapRowsToDays(rows, dateColumnId, currentMonth)
  │  returns: Map<string, Row[]>  (key = "2026-02-15", value = rows on that day)
  │
  ▼
CalendarGrid renders cells, each cell gets its rows from the map

Month Navigation:
  currentDate state → getMonthDays(currentDate)
  → returns: Date[] (all days in the month grid, including overflow from prev/next)
```

---

## Implementation Steps

### Step 1: Create Calendar Utilities

**File: `src/lib/database/calendar-utils.ts`**

```typescript
// Get all days to display in a month grid (including overflow days)
export function getMonthGridDays(year: number, month: number): Date[];

// Get all days in a week starting from a given date
export function getWeekDays(date: Date): Date[];

// Map rows to date keys: "2026-02-15" → [row1, row3]
export function mapRowsToDays(
  rows: DbRowWithPage[],
  dateColumnId: string
): Map<string, DbRowWithPage[]>;

// Format date for display: "February 2026", "Mon 24", etc.
export function formatCalendarDate(date: Date, format: "month" | "weekday" | "day"): string;

// Check if two dates are the same day
export function isSameDay(a: Date, b: Date): boolean;

// Check if a date is in the current month
export function isCurrentMonth(date: Date, referenceMonth: number): boolean;
```

### Step 2: Create CalendarView Component

**File: `src/components/database/CalendarView.tsx`**

```typescript
interface CalendarViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

// State:
// - currentDate: Date (current month/week being viewed)
// - viewMode: "month" | "week"
// - dateColumnId: string (from viewConfig or first DATE column)
//
// Renders: CalendarToolbar + CalendarGrid + NoDateSection
```

### Step 3: Create CalendarDayCell Component

**File: `src/components/database/CalendarDayCell.tsx`**

```typescript
interface CalendarDayCellProps {
  date: Date;
  rows: DbRowWithPage[];
  isToday: boolean;
  isCurrentMonth: boolean;
  maxVisible: number; // Default 3
  onAddRow: (date: Date) => void;
  onRowClick: (rowId: string) => void;
}

// Renders:
// - Day number (top-left)
// - Up to maxVisible CalendarEventPill components
// - "+N more" if overflow
// - "+" button on hover for creating new row
// - Droppable area via @dnd-kit
```

### Step 4: Create CalendarEventPill Component

**File: `src/components/database/CalendarEventPill.tsx`**

```typescript
interface CalendarEventPillProps {
  row: DbRowWithPage;
  schema: DatabaseSchema;
  onClick: () => void;
}

// Renders a small horizontal pill/badge:
// [● Build login page]
// Left dot color from Status column (if SELECT type)
// Title text, truncated with ellipsis
// Draggable via @dnd-kit useDraggable()
```

### Step 5: Implement Drag-and-Drop for Calendar

Custom collision detection for calendar grid:

```typescript
// Custom strategy: find the closest CalendarDayCell to the drag pointer
function calendarCollisionDetection(args: CollisionDetectionArgs) {
  // Use pointerWithin to find which day cell the pointer is over
  // Return the day cell as the collision target
}
```

Drag end handler:

```typescript
function handleDragEnd(event: DragEndEvent) {
  const rowId = event.active.id;
  const targetDate = event.over?.data.current?.date; // ISO date string
  if (!targetDate) return;

  // Optimistic: move pill to new day
  // API: updateRow(rowId, { [dateColumnId]: { type: "DATE", value: targetDate } })
}
```

### Step 6: Wire into DatabaseViewContainer

**File: `src/components/database/DatabaseViewContainer.tsx`** (modify)

```typescript
case "calendar":
  return <CalendarView databaseId={databaseId} schema={schema} viewConfig={viewConfig} onViewConfigChange={updateViewConfig} />;
```

---

## Testing Requirements

### Unit Tests (20+ cases)

**File: `src/__tests__/lib/database/calendar-utils.test.ts`**

- `getMonthGridDays`: February 2026 returns 35 days (includes Jan 26-31 and Mar 1)
- `getMonthGridDays`: handles leap year (Feb 2028)
- `getMonthGridDays`: month starting on Sunday
- `getMonthGridDays`: month starting on Monday
- `getWeekDays`: returns 7 consecutive days
- `mapRowsToDays`: places rows on correct days
- `mapRowsToDays`: rows without date go to "no-date" key
- `mapRowsToDays`: multiple rows on same day grouped together
- `isSameDay`: same day returns true
- `isSameDay`: different day returns false
- `isCurrentMonth`: date in month returns true
- `isCurrentMonth`: date outside month returns false

**File: `src/__tests__/components/database/CalendarView.test.tsx`**

- Calendar renders 7 column headers (day names)
- Calendar renders correct number of week rows for current month
- Today cell has highlight class
- Outside-month cells have dimmed class
- Navigation arrows change displayed month
- "Today" button resets to current month
- Month/Week toggle switches view mode

**File: `src/__tests__/components/database/CalendarDayCell.test.tsx`**

- Cell shows day number
- Cell renders up to 3 event pills
- Cell shows "+N more" for overflow
- Hover shows "+" button
- Clicking "+" fires onAddRow with correct date
- Cell is a valid drop target

**File: `src/__tests__/components/database/CalendarEventPill.test.tsx`**

- Pill shows row title
- Pill truncates long titles with ellipsis
- Pill shows color dot from SELECT column
- Clicking pill fires onClick
- Pill is draggable

### Integration Tests (10+ cases)

**File: `src/__tests__/integration/calendar-view.test.tsx`**

- Calendar places rows on correct days based on date column
- Dragging pill to new day updates row's date property
- Optimistic drag: pill appears on new day before API response
- API failure reverts pill to original day
- Creating row on a day pre-sets the date property
- Changing date column re-maps all rows
- Filter hides matching rows from calendar
- Rows without date appear in "No date" section
- Week view shows correct 7-day range
- Navigation to next month shows correct grid

### E2E Tests (4+ cases)

**File: `src/__tests__/e2e/calendar-view.test.ts`**

- Switch to Calendar view → month grid visible with rows on correct days
- Click empty day → new row created with that date
- Drag row from Feb 15 to Feb 20 → verify date changed in table view
- Navigate to next month → calendar shows March, correct rows placed

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/database/CalendarView.tsx` | Create | Main calendar view with month/week grid |
| `src/components/database/CalendarDayCell.tsx` | Create | Individual day cell with event pills |
| `src/components/database/CalendarEventPill.tsx` | Create | Draggable event pill component |
| `src/lib/database/calendar-utils.ts` | Create | Date grid generation and row mapping utilities |
| `src/components/database/DatabaseViewContainer.tsx` | Modify | Wire CalendarView into view router |
| `src/__tests__/lib/database/calendar-utils.test.ts` | Create | Calendar utility unit tests |
| `src/__tests__/components/database/CalendarView.test.tsx` | Create | Calendar view unit tests |
| `src/__tests__/components/database/CalendarDayCell.test.tsx` | Create | Day cell unit tests |
| `src/__tests__/components/database/CalendarEventPill.test.tsx` | Create | Event pill unit tests |
| `src/__tests__/integration/calendar-view.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/calendar-view.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
