# SKB-26.3: Fix Search Dialog Click-Outside Dismiss

**Story ID:** SKB-26.3
**Epic:** [EPIC-26 — Critical Bug Fixes](EPIC-26-CRITICAL-BUG-FIXES.md)
**Points:** 2
**Priority:** Medium
**Status:** Draft

---

## Summary

Both search dialogs (Quick Switcher and Enhanced Search) should close when the user clicks the dark backdrop area outside the dialog, matching standard modal UX behavior. Currently only the Escape key closes them.

---

## Acceptance Criteria

- Open Quick Switcher (Cmd+K), click the dark area outside the dialog — it closes
- Open Enhanced Search (Cmd+Shift+F), click the dark area outside the dialog — it closes
- Clicking inside the dialog (search input, results, filters) does NOT close it
- Escape key still works to close both dialogs
- The close (X) button on Enhanced Search still works
- Keyboard navigation (arrow keys, Enter to select) still works inside the dialog
- No accidental dismissal when interacting with dropdown menus or date pickers inside the Enhanced Search filters

---

## Root Cause

Both dialogs have this structure:

```tsx
// Outer wrapper — has the click handler
<div className="fixed inset-0 z-50 ..."
  onClick={(e) => {
    if (e.target === e.currentTarget) onClose();  // BUG: never true
  }}
>
  // Backdrop — this child intercepts the click
  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

  // Dialog content
  <div className="relative z-10 ...">
    ...search input, results...
  </div>
</div>
```

When the user clicks the dark area, `e.target` is the backdrop child `div`, but `e.currentTarget` is the outer wrapper. Since `e.target !== e.currentTarget`, the check fails and `onClose()` is never called.

---

## Implementation Approach

**Option A (recommended): Add `pointer-events-none` to the backdrop**

```tsx
<div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-none" />
```

This makes the backdrop purely visual. Clicks pass through it to the outer wrapper, where the existing `e.target === e.currentTarget` check now works correctly.

**Option B: Add `onClick={onClose}` to the backdrop**

```tsx
<div
  className="absolute inset-0 bg-black/50 backdrop-blur-sm"
  onClick={onClose}
/>
```

This directly closes the dialog when the backdrop is clicked. Simpler, but requires ensuring clicks on the dialog content don't bubble up to the backdrop (the `relative z-10` on the content div should prevent this).

**Apply to both files:**
1. `src/components/search/SearchDialog.tsx` — line ~228 (backdrop div)
2. `src/components/search/EnhancedSearchDialog.tsx` — line ~284 (backdrop div)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/search/SearchDialog.tsx` | Add `pointer-events-none` to backdrop div (line ~228) |
| `src/components/search/EnhancedSearchDialog.tsx` | Add `pointer-events-none` to backdrop div (line ~284) |

---

## Do NOT Break

- Search input auto-focus on dialog open
- Keyboard navigation (arrow up/down, Enter to select, Escape to close)
- Search-as-you-type with debounced API calls
- Result click to navigate to page
- Enhanced Search filters (date range, content type)
- Enhanced Search infinite scroll
- The close (X) button on Enhanced Search
- Cmd+K and Cmd+Shift+F keyboard shortcuts to open

---

## Test Coverage

**Unit Tests:**
- Backdrop div has `pointer-events-none` class
- `onClose` is called when clicking the outer wrapper (simulated click where `e.target === e.currentTarget`)

**Integration Tests:**
- SearchDialog closes when clicking outside the content area
- EnhancedSearchDialog closes when clicking outside the content area
- Clicking inside dialog content does not trigger close

**E2E Tests:**
1. Press Cmd+K — Quick Switcher opens
2. Click the dark area outside — dialog closes
3. Press Cmd+K again — dialog opens
4. Type a search query, click a result — navigates (dialog didn't close prematurely)
5. Press Cmd+Shift+F — Enhanced Search opens
6. Click dark area — dialog closes
7. Open again, use filters, click inside — dialog stays open
8. Click outside — dialog closes

---

## Verification Steps

1. Press Cmd+K (or Ctrl+K on Windows/Linux)
2. The Quick Switcher dialog appears with a dark backdrop
3. Click anywhere on the dark backdrop area — the dialog closes
4. Press Cmd+K again, type a search query
5. Click on a search result — it navigates to the page (dialog closes normally)
6. Press Cmd+Shift+F to open Enhanced Search
7. Click the dark backdrop — the dialog closes
8. Open Enhanced Search again, interact with filters inside the dialog
9. Clicking inside the dialog does NOT close it
10. Press Escape — dialog closes (still works)

---

**Last Updated:** 2026-02-27
