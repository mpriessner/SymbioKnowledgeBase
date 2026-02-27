# Epic 36: UI Bug Fixes — Home Page Scroll & Dark Mode Visibility

**Epic ID:** EPIC-36
**Created:** 2026-02-27
**Total Story Points:** 5
**Priority:** High
**Status:** Draft

---

## Epic Overview

Two visible UI bugs are degrading the user experience:

1. **Home page "All Pages" cannot scroll** — The page lists ~10 pages but the remaining ones are clipped. The user cannot scroll down to see them. Root cause: the workspace layout uses `h-screen overflow-hidden` on the outer container, and the `main` element has no `overflow-y: auto`.

2. **Dark mode: page title and buttons invisible** — The page title (`text-gray-900`), "Add cover" / "Add icon" buttons (`text-gray-400`, `hover:bg-gray-100`), and the cover image manager all use hardcoded Tailwind color classes instead of the app's CSS variable theming system (`var(--color-text-primary)`, `var(--color-bg-primary)`). In dark mode, these elements have near-zero contrast.

### Root Causes

**Scroll bug:**
- `src/app/(workspace)/layout.tsx:15` — Outer div: `h-screen overflow-hidden` clips all content
- `src/app/(workspace)/layout.tsx:17` — `main.workspace-main` is `flex-1 flex flex-col` but has no overflow scroll
- The home page content grows taller than the viewport but has no scroll container

**Dark mode bug:**
- `src/components/workspace/PageHeader.tsx:223` — Title: `text-gray-900` (hardcoded dark on dark = invisible)
- `src/components/workspace/PageHeader.tsx:168,197` — Buttons: `text-gray-400 hover:bg-gray-100` (invisible in dark)
- `src/components/workspace/PageHeader.tsx:142` — Icon hover: `hover:bg-gray-100` (white flash in dark mode)
- `src/components/workspace/CoverImageManager.tsx` — Multiple hardcoded gray classes throughout
- All of these should use `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-bg-secondary)`, etc.

---

## Stories Breakdown

### SKB-36.1: Fix Home Page Scroll — 2 points, High

**Delivers:** The home page "All Pages" section scrolls properly, showing all pages regardless of list length.

**Depends on:** Nothing

---

### SKB-36.2: Fix Dark Mode Visibility — Page Title, Buttons & Cover Manager — 3 points, High

**Delivers:** All PageHeader and CoverImageManager elements are visible and properly themed in dark mode, using the app's CSS variable system instead of hardcoded Tailwind color classes.

**Depends on:** Nothing

---

## Files Created/Modified by This Epic

| File | Action | Description |
|------|--------|-------------|
| `src/app/(workspace)/layout.tsx` | Modify | Add overflow scroll to main content area |
| `src/components/workspace/PageHeader.tsx` | Modify | Replace hardcoded gray classes with CSS variables |
| `src/components/workspace/CoverImageManager.tsx` | Modify | Replace hardcoded gray classes with CSS variables |

---

**Last Updated:** 2026-02-27
