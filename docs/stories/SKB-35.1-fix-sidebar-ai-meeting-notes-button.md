# SKB-35.1: Fix Sidebar AI Meeting Notes Button

**Story ID:** SKB-35.1
**Epic:** [EPIC-35 — AI Meeting Notes Full Workflow](EPIC-35-AI-MEETING-NOTES-FULL-WORKFLOW.md)
**Points:** 2
**Priority:** Critical
**Status:** Draft

---

## Summary

The "AI Meeting Notes" button in the sidebar "+" menu creates a blank page (identical to "New Page") instead of opening the Meeting Notes Generator workflow. The button needs to create a page with the correct type and navigate to it so that `MeetingNotesGenerator.tsx` renders instead of a blank editor.

---

## Current Problem

**File:** `src/components/workspace/Sidebar.tsx` (lines 165-173)

The "AI Meeting Notes" button in the sidebar calls the same `handleNewPage` function as the regular "New Page" button. This creates a standard blank page with no special type or metadata.

Meanwhile, `src/components/page/PageCreationMenu.tsx` (lines 281-283) has a separate `handleCreateMeetingNotes` function that correctly navigates to the meeting notes flow — but the sidebar button doesn't use it.

**What should happen:**
1. Click "AI Meeting Notes" in sidebar
2. A new page is created with a meeting-notes type/flag
3. The page view detects this type and renders `MeetingNotesGenerator` instead of the blank editor
4. The user sees the recording interface with Start Recording, microphone status, etc.

**What actually happens:**
1. Click "AI Meeting Notes" in sidebar
2. A blank page is created (same as "New Page")
3. The user sees an empty editor — no recording interface

---

## Acceptance Criteria

- Clicking "AI Meeting Notes" in the sidebar "+" menu opens the Meeting Notes Generator workflow
- The user sees the VoiceRecorder component with a "Start Recording" button
- The page is created with a type or metadata flag that triggers the meeting notes UI
- The page appears in the sidebar
- The flow matches what `PageCreationMenu.tsx`'s `handleCreateMeetingNotes` does

---

## Implementation Approach

**Option A: Reuse PageCreationMenu's approach**

Look at how `PageCreationMenu.tsx` handles meeting notes creation and replicate that logic in the sidebar handler:

1. In `Sidebar.tsx`, replace the "AI Meeting Notes" click handler:
   - Instead of calling `handleNewPage`, call a new `handleNewMeetingNotes` function
   - This function should create a page with the meeting-notes content type
   - Navigate to the new page where `PageContent.tsx` will detect the type and render `MeetingNotesGenerator`

**Option B: Navigate to a meeting notes route**

If there's a dedicated route for meeting notes creation, navigate to it directly.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/workspace/Sidebar.tsx` | Change "AI Meeting Notes" button handler to create meeting-notes page type |

---

## Do NOT Break

- Regular "New Page" creation from the sidebar
- "Database" creation from the sidebar
- MeetingNotesGenerator rendering for pages created from PageCreationMenu
- Sidebar tree refresh after page creation
- Page navigation

---

## Test Coverage

**Unit Tests:**
- "AI Meeting Notes" button calls a different handler than "New Page"
- The handler creates a page with meeting-notes type

**Integration Tests:**
- Clicking the button creates a page and navigates to it
- The page renders MeetingNotesGenerator, not a blank editor

**E2E Tests:**
1. Click "+" in sidebar, select "AI Meeting Notes"
2. A new page opens with the Meeting Notes Generator visible
3. The VoiceRecorder component with "Start Recording" button is displayed
4. The page appears in the sidebar

---

## Verification Steps

1. Click "+" in the sidebar
2. Click "AI Meeting Notes"
3. Verify: A new page opens showing the Meeting Notes Generator (NOT a blank editor)
4. Verify: "Start Recording" button or microphone interface is visible
5. Verify: The page appears in the sidebar tree

---

**Last Updated:** 2026-02-27
