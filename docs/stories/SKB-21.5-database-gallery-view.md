# Story SKB-21.5: Database Gallery View

**Epic:** Epic 21 - Page Creation Enhancements, Database Views & AI Features
**Story ID:** SKB-21.5
**Story Points:** 8 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-21.1 (ViewSwitcher and DatabaseViewContainer must exist)

---

## User Story

As a SymbioKnowledgeBase user, I want a card grid (gallery) view for my databases, So that I can see items as visual cards with cover images, titles, and key properties — ideal for mood boards, product catalogs, and portfolio-style layouts.

---

## Acceptance Criteria

### Grid Layout
- [ ] Gallery renders as a responsive CSS Grid of cards
- [ ] Card sizes configurable: Small (3 per row), Medium (2 per row), Large (1 per row) — relative to container width
- [ ] Default card size: Medium
- [ ] Cards have consistent height within a row (images cropped to fit)
- [ ] Grid gap: 16px between cards
- [ ] Cards have rounded corners, subtle border, and shadow (consistent with design system)

### Card Content
- [ ] Each card shows:
  1. **Cover image** (top half): from a URL column, or a placeholder gradient if no image
  2. **Title** (below image): from the TITLE column, max 2 lines with ellipsis
  3. **Property previews** (below title): up to 3 visible properties as small labels
- [ ] Cover image is rendered as `object-fit: cover` within a fixed-height container
- [ ] If the URL column value is not a valid image URL, show a colored placeholder
- [ ] Cards without a cover image show a subtle gradient background based on the title hash

### Cover Image Configuration
- [ ] A "Cover" dropdown above the gallery lets users select which URL column to use for cover images
- [ ] Only `URL` type columns appear in the dropdown
- [ ] "None" option removes cover images (cards show title + properties only, more compact)
- [ ] Selection persisted in `viewConfig.gallery.coverColumn`

### Card Size Configuration
- [ ] A size toggle (S / M / L) above the gallery changes the card size
- [ ] Size persisted in `viewConfig.gallery.cardSize`
- [ ] Size change animates smoothly (CSS transition on grid-template-columns)

### Card Interactions
- [ ] Clicking a card navigates to the row detail page or opens inline editor
- [ ] Hovering shows a subtle scale-up effect (transform: scale(1.02))
- [ ] Right-click context menu: Open, Open in new tab, Delete
- [ ] Cards support keyboard navigation (Tab between cards, Enter to open)

### Property Previews
- [ ] Users can configure which properties appear on cards via a "Properties" dropdown
- [ ] Default: Status, Priority (first two non-title, non-URL properties)
- [ ] SELECT properties show colored badges
- [ ] DATE properties show formatted date
- [ ] CHECKBOX properties show check/uncheck icon

### Create New Card
- [ ] "+" card at the end of the grid (same size as other cards, dashed border)
- [ ] Clicking "+" creates a new row and opens it for editing
- [ ] New card appears at the end of the grid

### Filtering & Sorting
- [ ] Gallery shares the same filter bar as other views
- [ ] Sort order determines card position in the grid (left-to-right, top-to-bottom)
- [ ] Filtered cards are hidden

### Empty State
- [ ] Empty database: centered message "No items yet" with a prominent "+" button
- [ ] Filtered empty: "No items match the current filter"

### Performance
- [ ] Gallery renders 100+ cards without visible lag
- [ ] Cover images lazy-load (IntersectionObserver or `loading="lazy"`)
- [ ] Placeholder shown while image is loading (skeleton shimmer)

---

## Architecture Overview

```
Gallery View Component Architecture
──────────────────────────────────────

DatabaseViewContainer
├── ViewSwitcher (Gallery tab active)
├── GalleryToolbar
│   ├── CoverColumnSelector (dropdown: Image URL, Avatar URL, None)
│   ├── CardSizeToggle (S | M | L)
│   ├── PropertyVisibilityToggle (shared component from ListView)
│   └── FilterBar (shared)
└── GalleryView
    ├── GalleryGrid (CSS Grid container)
    │   ├── GalleryCard (row 1)
    │   │   ├── CardCover (image or placeholder gradient)
    │   │   ├── CardTitle ("Build login page")
    │   │   └── CardProperties
    │   │       ├── PropertyBadge ("In progress")
    │   │       └── PropertyBadge ("High")
    │   ├── GalleryCard (row 2)
    │   ├── GalleryCard (row 3)
    │   └── AddCard (+)
    └── (empty state if no cards)

Card Layout (Medium size):
┌───────────────────────────────┐
│                               │
│    Cover Image / Gradient     │  ~160px height
│    (object-fit: cover)        │
│                               │
├───────────────────────────────┤
│ Build login page              │  Title (max 2 lines)
│                               │
│ [In progress] [High]         │  Property badges
│ Feb 25, 2026                  │
└───────────────────────────────┘

CSS Grid:
  Small:  grid-template-columns: repeat(3, 1fr)
  Medium: grid-template-columns: repeat(2, 1fr)
  Large:  grid-template-columns: repeat(1, 1fr)
```

---

## Implementation Steps

### Step 1: Create GalleryView Component

**File: `src/components/database/GalleryView.tsx`**

```typescript
interface GalleryViewProps {
  databaseId: string;
  schema: DatabaseSchema;
  viewConfig: ViewConfig;
  onViewConfigChange: (config: Partial<ViewConfig>) => void;
}

// 1. Fetch rows via useDatabaseRows(databaseId)
// 2. Apply filters and sorting
// 3. Determine coverColumn from viewConfig or first URL column
// 4. Determine cardSize from viewConfig (default "medium")
// 5. Render GalleryGrid with GalleryCard for each row
```

### Step 2: Create GalleryCard Component

**File: `src/components/database/GalleryCard.tsx`**

```typescript
interface GalleryCardProps {
  row: DbRowWithPage;
  schema: DatabaseSchema;
  coverColumnId: string | null;
  visibleProperties: string[];
  onClick: () => void;
}

// Card with cover image (or placeholder), title, and property badges
// Lazy loading for cover images
// Hover: subtle scale effect
// Keyboard: focusable, Enter to open
```

### Step 3: Create CardCover Component

**File: `src/components/database/CardCover.tsx`**

```typescript
interface CardCoverProps {
  imageUrl: string | null;
  title: string; // Used for placeholder gradient seed
  height: number;
}

// If imageUrl is valid: <img> with object-fit: cover, loading="lazy"
// If imageUrl is null/invalid: gradient placeholder based on title hash
// Skeleton shimmer while loading
```

### Step 4: Create CardSizeToggle Component

**File: `src/components/database/CardSizeToggle.tsx`**

```typescript
interface CardSizeToggleProps {
  size: "small" | "medium" | "large";
  onChange: (size: "small" | "medium" | "large") => void;
}

// Three buttons: [S] [M] [L]
// Active button highlighted
// Clicking changes size and triggers CSS Grid transition
```

### Step 5: Placeholder Gradient Utility

**File: `src/lib/database/gallery-utils.ts`**

```typescript
// Generate a deterministic gradient from a string (title hash)
export function titleToGradient(title: string): string {
  // Simple hash → hue calculation
  // Returns: "linear-gradient(135deg, hsl(H, 60%, 85%), hsl(H+40, 60%, 75%))"
}

// Check if a URL is likely an image
export function isImageUrl(url: string): boolean {
  // Check extension (.jpg, .png, .gif, .webp, .svg)
  // Or check if URL matches common image hosting patterns
}
```

### Step 6: Wire into DatabaseViewContainer

**File: `src/components/database/DatabaseViewContainer.tsx`** (modify)

```typescript
case "gallery":
  return <GalleryView databaseId={databaseId} schema={schema} viewConfig={viewConfig} onViewConfigChange={updateViewConfig} />;
```

---

## Testing Requirements

### Unit Tests (18+ cases)

**File: `src/__tests__/components/database/GalleryView.test.tsx`**

- Gallery renders correct number of cards
- Cards arranged in grid with correct column count (3 for small, 2 for medium, 1 for large)
- Empty database shows empty state message
- Filtered empty shows "No items match" message
- "+" card appears at end of grid
- Clicking "+" creates a new row

**File: `src/__tests__/components/database/GalleryCard.test.tsx`**

- Card shows title from TITLE column
- Card truncates long title to 2 lines
- Card shows cover image when URL column has valid URL
- Card shows gradient placeholder when no cover image
- Card shows property badges
- Clicking card fires onClick
- Hover applies scale effect class
- Card is keyboard focusable

**File: `src/__tests__/components/database/CardCover.test.tsx`**

- Renders img tag with valid URL
- Renders placeholder gradient for null URL
- Image has loading="lazy" attribute
- Shows skeleton while image loads
- Handles image load error (falls back to placeholder)

**File: `src/__tests__/lib/database/gallery-utils.test.ts`**

- `titleToGradient` returns consistent gradient for same title
- `titleToGradient` returns different gradients for different titles
- `isImageUrl` returns true for .jpg, .png, .gif, .webp
- `isImageUrl` returns false for .pdf, .zip, .html

**File: `src/__tests__/components/database/CardSizeToggle.test.tsx`**

- Renders S, M, L buttons
- Active size is highlighted
- Clicking fires onChange with correct size

### Integration Tests (8+ cases)

**File: `src/__tests__/integration/gallery-view.test.tsx`**

- Gallery renders cards with data from useDatabaseRows
- Cover images from URL column appear on cards
- Changing cover column re-renders cards with new images
- Changing card size updates grid layout
- Filtering hides non-matching cards
- Sorting changes card order
- ViewConfig persisted when cover column or size changes
- Creating row via "+" adds card to gallery

### E2E Tests (3+ cases)

**File: `src/__tests__/e2e/gallery-view.test.ts`**

- Switch to Gallery view → cards visible with cover images and titles
- Toggle card size from M to S → cards rearrange to 3 per row
- Click card → navigates to row detail page

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/database/GalleryView.tsx` | Create | Main gallery grid view |
| `src/components/database/GalleryCard.tsx` | Create | Individual card component |
| `src/components/database/CardCover.tsx` | Create | Cover image with lazy loading and fallback |
| `src/components/database/CardSizeToggle.tsx` | Create | S/M/L size toggle |
| `src/lib/database/gallery-utils.ts` | Create | Gradient generator, image URL checker |
| `src/components/database/DatabaseViewContainer.tsx` | Modify | Wire GalleryView into view router |
| `src/__tests__/components/database/GalleryView.test.tsx` | Create | View unit tests |
| `src/__tests__/components/database/GalleryCard.test.tsx` | Create | Card unit tests |
| `src/__tests__/components/database/CardCover.test.tsx` | Create | Cover component tests |
| `src/__tests__/lib/database/gallery-utils.test.ts` | Create | Utility tests |
| `src/__tests__/components/database/CardSizeToggle.test.tsx` | Create | Toggle tests |
| `src/__tests__/integration/gallery-view.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/gallery-view.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
