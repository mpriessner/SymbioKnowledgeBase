# Epic 23: Workspace Dropdown Menu Redesign

**Epic ID:** EPIC-23
**Created:** 2026-02-25
**Total Story Points:** 19
**Priority:** Medium
**Status:** Draft

---

## Epic Overview

Epic 23 redesigns the workspace dropdown menu at the top-left of the sidebar to match Notion's polished, information-rich workspace switcher. The current dropdown is minimal — just a workspace name, a Settings link, and a Logout button. The redesigned version will be a multi-section dropdown panel that shows the workspace identity (avatar, name, plan, member count), quick action buttons (Settings, Invite members), the user's email and account info, a workspace list with the ability to create new workspaces, and a clear Log out option.

Additionally, this epic **relocates Settings** from the sidebar footer into the workspace dropdown, cleaning up the sidebar footer for a cleaner look that matches Notion's layout.

Currently, SymbioKnowledgeBase has:
- `WorkspaceDropdown` component with: workspace name text, Settings menu item, Logout menu item
- Settings gear button in the sidebar footer (navigates to `/settings`)
- Supabase auth with `signOut()` for logout
- No workspace switching, no invite flow, no user avatar in dropdown
- Hardcoded workspace name "SymbioKnowledgeBase"

This epic adds:
1. **Visual redesign** of the dropdown to match Notion's aesthetic — workspace header with avatar, plan badge, member count
2. **Settings & Invite buttons** as a button row in the dropdown header
3. **User email section** showing the logged-in user's email
4. **Workspace list** with checkmark on current workspace + "New workspace" option
5. **Workspace creation** flow — basic dialog to create and switch workspaces
6. **Invite members placeholder** — opens a coming-soon dialog
7. **Sidebar footer cleanup** — remove the settings button from the footer

**Out of scope:**
- "Add another account" (multi-account support)
- "Get Mac app" / "Get iOS & Android app" links
- Full invite flow with email sending (placeholder only)

**Dependencies:**
- Supabase auth (done)
- Settings pages at `/settings/*` (done)
- Sidebar component (done)

---

## Business Value

- **Visual Polish:** The workspace dropdown is the first thing users see — a polished dropdown communicates quality and builds trust
- **Notion Parity:** Power users migrating from Notion expect this exact interaction pattern; matching it reduces friction
- **Workspace Foundation:** Adding basic workspace creation/switching sets the stage for team collaboration features
- **Cleaner Sidebar:** Moving settings into the dropdown declutters the sidebar footer

---

## Architecture Summary

```
Workspace Dropdown — Current vs Redesigned
─────────────────────────────────────────────

CURRENT:                              REDESIGNED (Notion-style):
┌──────────────────────┐              ┌──────────────────────────────┐
│ SymbioKnowledgeBase ▾│              │ M  Martin's Workspace        │
└──────────────────────┘              │    Free Plan · 1 member      │
  │                                   │                              │
  ▼ (dropdown)                        │ [⚙ Settings] [👥 Invite]    │
┌──────────────────────┐              ├──────────────────────────────┤
│ ✓ SymbioKnowledgeBase│              │ martin@gmail.com        ··· │
│ ──────────────────── │              │ M  Martin's Workspace    ✓  │
│ ⚙ Settings           │              │ + New workspace              │
│ ──────────────────── │              ├──────────────────────────────┤
│ ⏻ Log out            │              │ Log out                      │
└──────────────────────┘              └──────────────────────────────┘

SIDEBAR FOOTER:                       SIDEBAR FOOTER:
┌──────────────────────┐              ┌──────────────────────────────┐
│ ⚙ Settings           │  ← REMOVED  │ (empty or minimal)           │
└──────────────────────┘              └──────────────────────────────┘
```

---

## Stories Breakdown

### SKB-23.1: Workspace Dropdown Visual Redesign & Settings Relocation — 8 points, High

**Delivers:** A fully redesigned workspace dropdown matching Notion's layout — workspace header with avatar/initial, plan badge, and member count; Settings and Invite Members buttons; user email section; current workspace with checkmark; Log out at the bottom. Settings is removed from the sidebar footer.

**Depends on:** Nothing (first story)

---

### SKB-23.2: Workspace Creation & Switching — 8 points, Medium

**Delivers:** A "+ New workspace" option in the dropdown that opens a creation dialog. Users can name a new workspace and switch between workspaces. The dropdown shows all workspaces with a checkmark on the active one.

**Depends on:** SKB-23.1 (redesigned dropdown must exist)

---

### SKB-23.3: Invite Members Placeholder & Polish — 3 points, Low

**Delivers:** The "Invite members" button opens a placeholder dialog saying "Team invitations coming soon." Final visual polish: hover states, transitions, keyboard navigation, dark/light theme consistency.

**Depends on:** SKB-23.1 (invite button must exist in dropdown)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 23.1 | Dropdown renders all sections; avatar shows initial; settings button navigates; logout calls signOut | Dropdown opens/closes; settings removed from footer; logout redirects to /login | Click workspace name → dropdown opens → click Settings → navigates to /settings |
| 23.2 | Workspace list renders; creation dialog validates name; switch workspace updates state | Create workspace via API → appears in list; switch workspace → UI updates | Click "New workspace" → enter name → workspace created → switched |
| 23.3 | Invite button renders; placeholder dialog opens; keyboard nav works | Hover states on all items; escape closes dropdown; dark theme renders correctly | Click Invite → "Coming soon" dialog appears |

---

## Implementation Order

```
23.1 → 23.2 → 23.3

┌────────┐     ┌────────┐     ┌────────┐
│ 23.1   │────▶│ 23.2   │────▶│ 23.3   │
│Redesign│     │Workspce│     │ Polish │
└────────┘     └────────┘     └────────┘
```

---

## Shared Constraints

- **No Breaking Changes:** Existing `/settings` navigation must continue to work
- **Supabase Auth:** Logout must call `supabase.auth.signOut()` (existing pattern)
- **TypeScript Strict:** No `any` types in new code
- **Theming:** All dropdown elements support light and dark themes via CSS custom properties
- **Keyboard Navigation:** Full keyboard support (Arrow keys, Enter, Escape, Tab)
- **Outside Click:** Dropdown closes on outside click (existing pattern, preserved)
- **Responsive:** Dropdown works on screens >= 768px; on smaller screens, dropdown is full-width
- **Animation:** Dropdown appears with subtle fade + scale animation (200ms)

---

## Files Created/Modified by This Epic

### New Files
- `src/components/workspace/WorkspaceDropdownRedesigned.tsx` — New dropdown (replaces old)
- `src/components/workspace/WorkspaceAvatar.tsx` — Avatar/initial component
- `src/components/workspace/WorkspaceCreateDialog.tsx` — Workspace creation modal
- `src/components/workspace/InviteMembersDialog.tsx` — Placeholder invite dialog
- `src/hooks/useWorkspaces.ts` — Hook for workspace CRUD and switching
- `src/app/api/workspaces/route.ts` — Workspace API (list, create)
- `src/app/api/workspaces/[id]/route.ts` — Workspace detail API (switch)
- Tests for each component

### Modified Files
- `src/components/workspace/Sidebar.tsx` — Remove footer settings button, use new dropdown
- `src/components/workspace/WorkspaceDropdown.tsx` — Replace with redesigned version (or delete)

---

**Last Updated:** 2026-02-25
