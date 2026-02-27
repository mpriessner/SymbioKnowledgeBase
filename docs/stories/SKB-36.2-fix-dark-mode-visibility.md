# Story SKB-36.2: Fix Dark Mode Visibility — Page Title, Buttons & Cover Manager

**Epic:** Epic 36 - UI Bug Fixes — Home Page Scroll & Dark Mode Visibility
**Story ID:** SKB-36.2
**Story Points:** 3 | **Priority:** High | **Status:** Draft
**Depends On:** Nothing

---

## User Story

As a SymbioKnowledgeBase user in dark mode, I want page titles, action buttons, and the cover image manager to be clearly visible and properly themed, so that I can use all page features without straining to read invisible text or find hidden controls.

---

## Acceptance Criteria

### Page Title Visibility
- [ ] The page title (`<h1>`) is visible in both light and dark mode
- [ ] The placeholder text ("Untitled") is visible in both modes
- [ ] Title uses the app's CSS variable system, not hardcoded Tailwind gray classes
- [ ] Title contrast meets WCAG AA standards in both modes (4.5:1 ratio)

### Action Buttons Visibility
- [ ] "Add icon" button text and hover state are visible in dark mode
- [ ] "Add cover" button text and hover state are visible in dark mode
- [ ] Icon emoji hover background doesn't flash white in dark mode
- [ ] All hover backgrounds use theme-aware colors

### Cover Image Manager
- [ ] The URL input modal background is theme-aware (not hardcoded `bg-gray-50`)
- [ ] The modal border uses theme-aware colors (not hardcoded `border-gray-200`)
- [ ] Label text ("Change cover image" / "Add cover image") is visible in dark mode
- [ ] Input field border is theme-aware
- [ ] Cancel button text and hover state are visible in dark mode
- [ ] Error state border (`border-red-300`) is acceptable in both modes (red is inherently visible)

### Consistency
- [ ] All replaced classes follow the same CSS variable pattern used elsewhere in the app
- [ ] No regression in light mode — all elements look identical to before in light mode
- [ ] The "Change cover" and "Remove cover" overlay buttons on the cover image are NOT changed (they already use `bg-black/50` which works in both modes)

---

## Root Cause Analysis

The app uses a CSS variable theming system defined in `globals.css`:

```css
:root {
  --color-text-primary: ...;    /* dark text for light mode */
  --color-text-secondary: ...;  /* muted text for light mode */
  --color-bg-primary: ...;      /* white/light background */
  --color-bg-secondary: ...;    /* slightly off-white background */
  --color-bg-hover: ...;        /* hover background */
  --color-border-default: ...;  /* border color */
}

.dark {
  --color-text-primary: ...;    /* light text for dark mode */
  --color-text-secondary: ...;  /* muted light text */
  --color-bg-primary: ...;      /* dark background */
  --color-bg-secondary: ...;    /* slightly lighter dark background */
  --color-bg-hover: ...;        /* dark hover background */
  --color-border-default: ...;  /* dark border color */
}
```

However, `PageHeader.tsx` and `CoverImageManager.tsx` use **hardcoded Tailwind color classes** (e.g., `text-gray-900`, `bg-gray-100`, `border-gray-200`) that do NOT respond to the dark mode theme. In dark mode, these produce near-zero contrast (dark text on dark background).

---

## Detailed Change Map

### File: `src/components/workspace/PageHeader.tsx`

#### Change 1: Icon Emoji Hover (Line 142)

```tsx
// Before:
className="text-5xl hover:bg-gray-100 rounded-lg p-2 transition-colors"

// After:
className="text-5xl hover:bg-[var(--bg-hover)] rounded-lg p-2 transition-colors"
```

**Reason:** `hover:bg-gray-100` creates a white flash in dark mode. `var(--bg-hover)` adapts to theme.

#### Change 2: "Add icon" Button (Line 168)

```tsx
// Before:
className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors flex items-center gap-1"

// After:
className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded px-2 py-1 transition-colors flex items-center gap-1"
```

**Reason:** `text-gray-400` is invisible against dark backgrounds. `var(--text-secondary)` provides proper muted text in both modes.

#### Change 3: "Add cover" Button (Line 197)

```tsx
// Before:
className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors flex items-center gap-1"

// After:
className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded px-2 py-1 transition-colors flex items-center gap-1"
```

**Reason:** Same issue as "Add icon" button — identical fix.

#### Change 4: Page Title (Line 223)

```tsx
// Before:
className="text-4xl font-bold text-gray-900 outline-none focus:outline-none empty:before:content-['Untitled'] empty:before:text-gray-300 cursor-text"

// After:
className="text-4xl font-bold text-[var(--text-primary)] outline-none focus:outline-none empty:before:content-['Untitled'] empty:before:text-[var(--text-tertiary)] cursor-text"
```

**Reason:** `text-gray-900` is the primary offender — dark text on dark background. `var(--text-primary)` adapts. The placeholder `text-gray-300` should use `var(--text-tertiary)` or `var(--text-secondary)` for a muted placeholder effect.

**Note on `--text-tertiary`:** Check if this variable exists in `globals.css`. If not, use `var(--text-secondary)` with reduced opacity, or define `--text-tertiary` in the theme. Alternative: use `opacity-40` on `var(--text-primary)`:

```tsx
// Alternative if --text-tertiary doesn't exist:
className="... empty:before:text-[var(--text-secondary)] empty:before:opacity-50 ..."
```

### File: `src/components/workspace/CoverImageManager.tsx`

#### Change 5: Modal Background & Border (Line 101)

```tsx
// Before:
className="w-full bg-gray-50 border-b border-gray-200 content-pad py-4"

// After:
className="w-full bg-[var(--bg-secondary)] border-b border-[var(--border-default)] content-pad py-4"
```

**Reason:** `bg-gray-50` is a near-white background — invisible separation in dark mode. `var(--bg-secondary)` provides the correct slightly-offset background.

#### Change 6: Label Text (Line 103)

```tsx
// Before:
<p className="text-sm font-medium text-gray-700 mb-2">

// After:
<p className="text-sm font-medium text-[var(--text-primary)] mb-2">
```

**Reason:** `text-gray-700` is dark text that's invisible in dark mode.

#### Change 7: Input Field Border (Line 118-121)

```tsx
// Before:
className={`
  w-full px-3 py-2 text-sm border rounded-md
  focus:outline-none focus:ring-2 focus:ring-blue-300
  ${error ? "border-red-300" : "border-gray-300"}
`}

// After:
className={`
  w-full px-3 py-2 text-sm border rounded-md
  bg-[var(--bg-primary)] text-[var(--text-primary)]
  focus:outline-none focus:ring-2 focus:ring-blue-300
  ${error ? "border-red-300" : "border-[var(--border-default)]"}
`}
```

**Reason:** `border-gray-300` is barely visible in dark mode. Also add explicit `bg` and `text` for the input itself so typed text is visible. The `border-red-300` for error state is acceptable — red is visible on both light and dark backgrounds. The `focus:ring-blue-300` is also acceptable.

#### Change 8: Cancel Button (Line 138)

```tsx
// Before:
className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"

// After:
className="px-4 py-2 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-md transition-colors"
```

**Reason:** `text-gray-600` and `hover:bg-gray-100` are both invisible/jarring in dark mode.

### Elements NOT Changed

The following elements in `CoverImageManager.tsx` are **intentionally left unchanged**:

- **"Change cover" button** (line 81): `text-white bg-black/50 hover:bg-black/70` — semi-transparent black overlay on the cover image works in both modes
- **"Remove cover" button** (line 88): `text-white bg-black/50 hover:bg-red-600/70` — same reasoning
- **"Save" button** (line 132): `text-white bg-blue-600 hover:bg-blue-700` — blue with white text is visible in both modes
- **Error text** (line 127): `text-red-500` — red is visible on both light and dark backgrounds

---

## Implementation Steps

### Step 1: Verify CSS Variable Names

**File: `src/app/globals.css`** (read only)

Before making changes, verify the exact CSS variable names used in the app. The story uses these assumed names:
- `--text-primary` — primary text color
- `--text-secondary` — muted/secondary text color
- `--text-tertiary` — very muted text (may not exist)
- `--bg-primary` — main background
- `--bg-secondary` — offset background (for modals, cards)
- `--bg-hover` — hover state background
- `--border-default` — standard border color

**Check:** Other components in the codebase that already use CSS variables for reference. Look at:
- `src/app/(workspace)/home/page.tsx` — uses `var(--bg-primary)`, `var(--text-secondary)`, etc.
- `src/components/workspace/Sidebar.tsx` — likely uses theme variables
- `src/components/page/FavoriteButton.tsx` — recently created with CSS variables

Map the actual variable names to the ones used in this story. If names differ (e.g., `--color-text-primary` instead of `--text-primary`), adjust all changes accordingly.

### Step 2: Update PageHeader.tsx

**File: `src/components/workspace/PageHeader.tsx`** (modify)

Apply Changes 1-4 as described in the Detailed Change Map above. Four edits:
1. Line 142: Icon emoji hover → `hover:bg-[var(--bg-hover)]`
2. Line 168: "Add icon" button → theme-aware text and hover
3. Line 197: "Add cover" button → theme-aware text and hover
4. Line 223: Page title → `text-[var(--text-primary)]` and placeholder `text-[var(--text-tertiary)]`

### Step 3: Update CoverImageManager.tsx

**File: `src/components/workspace/CoverImageManager.tsx`** (modify)

Apply Changes 5-8 as described in the Detailed Change Map above. Four edits:
1. Line 101: Modal background → `bg-[var(--bg-secondary)]`, border → `border-[var(--border-default)]`
2. Line 103: Label text → `text-[var(--text-primary)]`
3. Lines 118-121: Input field → add `bg-[var(--bg-primary)] text-[var(--text-primary)]`, border → `border-[var(--border-default)]`
4. Line 138: Cancel button → theme-aware text and hover

### Step 4: Visual Verification

Test in both modes:

**Light mode checklist:**
- [ ] Page title is dark text on light background (same as before)
- [ ] "Add icon" / "Add cover" buttons appear on hover, muted text
- [ ] Cover URL input modal has slight gray background
- [ ] Cancel button is muted gray, darkens on hover

**Dark mode checklist:**
- [ ] Page title is light text on dark background (was invisible before)
- [ ] "Add icon" / "Add cover" buttons appear on hover, visible muted text
- [ ] Icon emoji hover doesn't flash white
- [ ] Cover URL input modal has dark offset background
- [ ] Input field has visible border and text
- [ ] Cancel button is visible muted text, lightens on hover

---

## Testing Requirements

### Manual Visual Verification (Primary)

This is a CSS theming fix — visual inspection is the most effective test:

1. Switch to dark mode in settings
2. Open any page with a title → title should be visible (light text on dark bg)
3. Open a page without icon → hover to see "Add icon" → button text visible
4. Open a page without cover → hover to see "Add cover" → button text visible
5. Click "Add cover" → URL input modal appears with dark-themed background
6. Type in input → text visible, border visible
7. Click "Cancel" → button visible
8. Open a page with icon → hover over emoji → no white flash on hover
9. Switch to light mode → repeat all checks → should look identical to before

### Unit Tests (3+ cases)

**File: `src/__tests__/components/workspace/PageHeader.test.tsx`**

- Page title renders with CSS variable class (not `text-gray-900`)
- "Add icon" button uses CSS variable for text color
- "Add cover" button uses CSS variable for text color

**File: `src/__tests__/components/workspace/CoverImageManager.test.tsx`**

- Editing state container uses CSS variable for background
- Input field uses CSS variable for border
- Cancel button uses CSS variable for text color

### Snapshot/Regression Tests (if available)

- Capture PageHeader in light mode → compare before/after
- Capture PageHeader in dark mode → verify text is visible
- Capture CoverImageManager in edit state in both modes

---

## CSS Variable Quick Reference

Verify these in `globals.css` before implementing. The patterns used elsewhere in the app:

```
Tailwind Hardcoded → CSS Variable Replacement
─────────────────────────────────────────────
text-gray-900     → text-[var(--text-primary)]
text-gray-700     → text-[var(--text-primary)]
text-gray-600     → text-[var(--text-secondary)]
text-gray-400     → text-[var(--text-secondary)]
text-gray-300     → text-[var(--text-tertiary)] or text-[var(--text-secondary)] opacity-50
hover:text-gray-600 → hover:text-[var(--text-primary)]
hover:text-gray-800 → hover:text-[var(--text-primary)]
bg-gray-50        → bg-[var(--bg-secondary)]
bg-gray-100       → bg-[var(--bg-hover)]
hover:bg-gray-100 → hover:bg-[var(--bg-hover)]
border-gray-200   → border-[var(--border-default)]
border-gray-300   → border-[var(--border-default)]
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/workspace/PageHeader.tsx` | Modify | Replace 4 hardcoded color class groups with CSS variables |
| `src/components/workspace/CoverImageManager.tsx` | Modify | Replace 4 hardcoded color class groups with CSS variables |

---

**Last Updated:** 2026-02-27
