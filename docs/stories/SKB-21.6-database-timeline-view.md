# Story SKB-21.6: Database Timeline View

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.6
**Story Points:** 10 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-21.1 (ViewSwitcher and DatabaseViewContainer must exist)

---

## User Story

As a SymbioKnowledgeBase user, I want a horizontal timeline (Gantt-style) view for my databases, So that I can visualize project schedules with date ranges and manage task durations by dragging to resize or move items.

---

## Acceptance Criteria

### Timeline Layout
- [ ] Timeline renders as a horizontal scrollable area with a time axis at the top
- [ ] Time axis shows date headers (days, weeks, or months depending on zoom level)
- [ ] Each row occupies a horizontal lane, with a bar spanning from start date to end date
- [ ] Row labels (titles) are shown in a fixed left sidebar that does not scroll horizontally
- [ ] The timeline body scrolls horizontally while the row labels stay fixed
- [ ] Today is marked with a vertical red/blue line across all lanes

### Date Column Configuration
- [ ] Timeline requires two DATE columns: start date and end date
- [ ] "Start date" and "End date" dropdowns above the timeline let users select which columns to use
- [ ] Only `DATE` type columns appear in the dropdowns
- [ ] Default: first DATE column = start, second DATE column = end
- [ ] If only one DATE column exists, end date defaults to start date + 1 day (single-day items)
- [ ] If no DATE columns exist, show message: "Add two Date columns to use Timeline view"
- [ ] Selections persisted in `viewConfig.timeline.startColumn` and `viewConfig.timeline.endColumn`

### Zoom Levels
- [ ] Three zoom levels: Day, Week, Month
- [ ] **Day:** each column = 1 day, ~40px wide. Shows ~30 days visible at once
- [ ] **Week:** each column = 1 week, ~80px wide. Shows ~12 weeks visible at once
- [ ] **Month:** each column = 1 month, ~120px wide. Shows ~12 months visible at once
- [ ] Zoom toggle: three buttons [Day] [Week] [Month] in the toolbar
- [ ] Changing zoom re-renders the time axis and bar positions

### Bar Rendering
- [ ] Each bar spans from start date column to end date column
- [ ] Bar shows the row title inside (truncated with ellipsis if too long)
- [ ] Bar color is determined by a SELECT column (e.g., Status or Priority) — same color scheme as Board view
- [ ] Bars without an end date show as a single-day dot/marker
- [ ] Rows without a start date appear in a "No date" section below the timeline

### Drag Interactions
- [ ] **Move:** Drag a bar horizontally to change both start and end dates (duration stays the same)
- [ ] **Resize left:** Drag the left edge of a bar to change the start date
- [ ] **Resize right:** Drag the right edge of a bar to change the end date
- [ ] Drag operations snap to the nearest day boundary
- [ ] Drag uses cursor styles: `grab` for move, `ew-resize` for edges
- [ ] Optimistic update: bar moves/resizes immediately, API call in background
- [ ] API failure reverts to original position with error toast

### Create Row
- [ ] Click on empty space in a lane row to create a new item at that date
- [ ] Or use a "+" button in the row labels sidebar to create a new row (dates default to today → today+7)

### Filtering & Sorting
- [ ] Timeline shares the same filter bar as other views
- [ ] Filters hide matching bars
- [ ] Sort order determines lane order (top-to-bottom)

### Performance
- [ ] Timeline renders 100+ rows without visible lag
- [ ] Only renders bars visible in the current scroll viewport (horizontal virtualization)
- [ ] Smooth horizontal scrolling at 60fps

---

## Architecture Overview

```
Timeline View Component Architecture
──────────────────────────────────────

DatabaseViewContainer
├── ViewSwitcher (Timeline tab active)
├── TimelineToolbar
│   ├── StartColumnSelector (dropdown)
│   ├── EndColumnSelector (dropdown)
│   ├── ZoomToggle (Day | Week | Month)
│   ├── TodayButton (scroll to today)
│   └── FilterBar (shared)
└── TimelineView
    ├── TimelineContainer (horizontal scroll)
    │   ├── RowLabelsSidebar (fixed left, ~200px)
    │   │   ├── RowLabel ("Build login page")
    │   │   ├── RowLabel ("Design schema")
    │   │   ├── RowLabel ("Write API docs")
    │   │   └── AddRowButton (+)
    │   │
    │   └── TimelineBody (scrollable right)
    │       ├── TimeAxis (top header)
    │       │   ├── MonthGroupHeader ("February 2026")
    │       │   └── DayHeaders (1, 2, 3, ..., 28)
    │       │
    │       ├── TimelineGrid (lanes with bars)
    │       │   ├── TimelineLane (row 1)
    │       │   │   └── TimelineBar (Feb 10 → Feb 20, "Build login page")
    │       │   ├── TimelineLane (row 2)
    │       │   │   └── TimelineBar (Feb 5 → Feb 15, "Design schema")
    │       │   └── TimelineLane (row 3)
    │       │       └── TimelineBar (Feb 18 → Mar 1, "Write API docs")
    │       │
    │       └── TodayLine (vertical line at current date)
    │
    └── NoDateSection (rows without dates)

Date-to-Pixel Mapping:
───────────────────────

  zoomLevel = "day"   → pixelsPerDay = 40
  zoomLevel = "week"  → pixelsPerDay = 80 / 7 ≈ 11.4
  zoomLevel = "month" → pixelsPerDay = 120 / 30 ≈ 4

  barLeft  = (startDate - timelineStart) * pixelsPerDay
  barWidth = (endDate - startDate + 1) * pixelsPerDay

  Example (day zoom, Feb starts at x=0):
    "Feb 10 → Feb 20" → left: 360px, width: 440px
```

---

## Implementation Steps

### Step 1: Create Timeline Utilities

**File: `src/lib/database/timeline-utils.ts`**

```typescript
// Calculate the visible date range for the timeline
export function getTimelineRange(
  rows: DbRowWithPage[],
  startColumnId: string,
  endColumnId: string
): { start: Date; end: Date };

// Convert a date to a pixel position
export function dateToPixel(date: Date, timelineStart: Date, pixelsPerDay: number): number;

// Convert a pixel position to a date
export function pixelToDate(pixel: number, timelineStart: Date, pixelsPerDay: number): Date;

// Get pixels per day for a zoom level
export function getPixelsPerDay(zoom: "day" | "week" | "month"): number;

// Generate time axis headers for a date range
export function generateTimeAxisHeaders(
  start: Date,
  end: Date,
  zoom: "day" | "week" | "month"
): TimeAxisHeader[];

// Snap a date to the nearest day boundary
export function snapToDay(date: Date): Date;
```

### Step 2: Create TimelineView Component

**File: `src/components/database/TimelineView.tsx`**

```typescript
interface TimelineViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

// State:
// - zoom: "day" | "week" | "month"
// - scrollLeft: number (horizontal scroll position)
// - startColumnId, endColumnId from viewConfig
//
// Layout: fixed left sidebar + scrollable right body
// Uses useRef for scroll container + scroll sync
```

### Step 3: Create TimelineBar Component

**File: `src/components/database/TimelineBar.tsx`**

```typescript
interface TimelineBarProps {
  row: DbRowWithPage;
  startDate: Date;
  endDate: Date;
  left: number;     // pixels from left edge
  width: number;    // pixels wide
  color: string;    // from SELECT column
  title: string;
  onMove: (newStartDate: Date, newEndDate: Date) => void;
  onResizeStart: (newStartDate: Date) => void;
  onResizeEnd: (newEndDate: Date) => void;
  onClick: () => void;
}

// Renders an absolutely positioned bar within its lane
// Left edge: resize handle (cursor: ew-resize)
// Center: drag to move (cursor: grab)
// Right edge: resize handle (cursor: ew-resize)
// Title text inside bar, truncated with ellipsis
```

### Step 4: Create TimeAxis Component

**File: `src/components/database/TimeAxis.tsx`**

```typescript
interface TimeAxisProps {
  headers: TimeAxisHeader[];
  pixelsPerDay: number;
  todayPosition: number; // pixel offset for today line
}

// Renders two header rows:
// Row 1: Month group headers ("February 2026", "March 2026")
// Row 2: Day/week numbers or month names (depending on zoom)
// Today line: vertical red/blue line at todayPosition
```

### Step 5: Implement Drag Handlers

Inside `TimelineBar`, use mouse/pointer events for drag interactions:

```typescript
// Move: onPointerDown → track delta → onPointerMove → update left/position → onPointerUp → fire onMove
// Resize left: onPointerDown on left handle → change left + width → fire onResizeStart
// Resize right: onPointerDown on right handle → change width → fire onResizeEnd

// All drag operations:
// 1. Convert pixel delta to day delta using pixelsPerDay
// 2. Snap to nearest day
// 3. Optimistic: update local position immediately
// 4. API: updateRow with new dates
// 5. Revert on failure
```

### Step 6: Wire into DatabaseViewContainer

**File: `src/components/database/DatabaseViewContainer.tsx`** (modify)

```typescript
case "timeline":
  return <TimelineView databaseId={databaseId} schema={schema} viewConfig={viewConfig} onViewConfigChange={updateViewConfig} />;
```

---

## Testing Requirements

### Unit Tests (20+ cases)

**File: `src/__tests__/lib/database/timeline-utils.test.ts`**

- `getTimelineRange`: returns earliest start and latest end from rows
- `getTimelineRange`: adds padding (7 days before/after)
- `dateToPixel`: correct pixel for day zoom (40px/day)
- `dateToPixel`: correct pixel for week zoom
- `dateToPixel`: correct pixel for month zoom
- `pixelToDate`: inverse of dateToPixel
- `getPixelsPerDay`: returns 40 for day, ~11.4 for week, ~4 for month
- `generateTimeAxisHeaders`: correct day headers for February 2026
- `generateTimeAxisHeaders`: correct week headers for 3-month range
- `generateTimeAxisHeaders`: correct month headers for year range
- `snapToDay`: rounds to start of day (midnight)

**File: `src/__tests__/components/database/TimelineView.test.tsx`**

- Timeline renders row labels sidebar on left
- Timeline renders time axis at top
- Today line appears at correct position
- Zoom toggle changes axis granularity
- "Today" button scrolls to today
- Missing DATE columns shows error message

**File: `src/__tests__/components/database/TimelineBar.test.tsx`**

- Bar positioned at correct left offset and width
- Bar shows title text
- Bar color matches SELECT column value
- Left edge has resize cursor
- Right edge has resize cursor
- Center has grab cursor
- Clicking bar fires onClick

**File: `src/__tests__/components/database/TimeAxis.test.tsx`**

- Renders month group headers
- Renders day numbers for day zoom
- Renders week numbers for week zoom
- Today line positioned correctly

### Integration Tests (8+ cases)

**File: `src/__tests__/integration/timeline-view.test.tsx`**

- Timeline places bars at correct positions based on date columns
- Dragging bar to new position updates start and end dates
- Resizing left edge changes start date, end date unchanged
- Resizing right edge changes end date, start date unchanged
- Changing zoom level re-renders bars at new scale
- Changing start/end column dropdowns re-positions all bars
- Filtering hides bars
- ViewConfig persisted when columns or zoom changes

### E2E Tests (4+ cases)

**File: `src/__tests__/e2e/timeline-view.test.ts`**

- Switch to Timeline view → bars visible spanning correct date ranges
- Change zoom from Day to Month → bars shrink, more time visible
- Drag bar right by 5 days → verify dates updated in table view
- Resize bar end date → verify end date changed

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/database/TimelineView.tsx` | Create | Main Gantt-style timeline view |
| `src/components/database/TimelineBar.tsx` | Create | Draggable/resizable bar component |
| `src/components/database/TimeAxis.tsx` | Create | Time axis header with zoom support |
| `src/lib/database/timeline-utils.ts` | Create | Date-to-pixel mapping, header generation |
| `src/components/database/DatabaseViewContainer.tsx` | Modify | Wire TimelineView into view router |
| `src/__tests__/lib/database/timeline-utils.test.ts` | Create | Utility unit tests |
| `src/__tests__/components/database/TimelineView.test.tsx` | Create | View unit tests |
| `src/__tests__/components/database/TimelineBar.test.tsx` | Create | Bar unit tests |
| `src/__tests__/components/database/TimeAxis.test.tsx` | Create | Axis unit tests |
| `src/__tests__/integration/timeline-view.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/timeline-view.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
