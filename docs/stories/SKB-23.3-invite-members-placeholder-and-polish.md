# Story SKB-23.3: Invite Members Placeholder & Polish

**Epic:** Epic 23 - Workspace Dropdown Menu Redesign
**Story ID:** SKB-23.3
**Story Points:** 3 | **Priority:** Low | **Status:** Draft
**Depends On:** SKB-23.1 (invite button must exist in dropdown)

---

## User Story

As a SymbioKnowledgeBase user, I want the "Invite members" button to show a clear placeholder explaining team invitations are coming soon, and I want the entire workspace dropdown to feel polished with smooth interactions, So that the dropdown feels complete and professional even before all features are live.

---

## Acceptance Criteria

### Invite Members Dialog
- [ ] Clicking "Invite members" in the dropdown header opens a modal dialog
- [ ] Dialog contains:
  - Title: "Invite members to {workspace name}"
  - An email input field (disabled, with placeholder "name@example.com")
  - A role selector dropdown (disabled, showing "Member")
  - An "Invite" button (disabled, greyed out)
  - A message below: "Team invitations are coming soon. You'll be able to invite collaborators by email."
  - A "Close" button to dismiss
- [ ] Dialog has a subtle illustration or icon (e.g., people/team icon) above the message
- [ ] Pressing Escape closes the dialog
- [ ] Dialog is keyboard-navigable (Tab moves through elements, Escape closes)

### Visual Polish — Dropdown Transitions
- [ ] Dropdown open animation: fade-in (0→1 opacity) + slide-down (4px) over 150ms ease-out
- [ ] Dropdown close: immediate (no delay) or 100ms fade-out
- [ ] Menu item hover: subtle background highlight with 100ms transition
- [ ] Active workspace checkmark has a subtle scale-in animation on first render
- [ ] Workspace avatar colors have slight gradient (top-left light → bottom-right darker) for depth

### Visual Polish — Hover & Focus States
- [ ] All clickable items have visible hover states (background color change)
- [ ] All clickable items have visible focus-visible states (outline ring)
- [ ] Settings and Invite buttons: border darkens on hover
- [ ] "+ New workspace" text underlines on hover
- [ ] Log out item: subtle color change on hover (but NOT red — matches Notion's neutral styling)
- [ ] Workspace list items: full-width hover highlight including avatar area

### Visual Polish — Typography & Spacing
- [ ] Section padding consistent: 8px vertical, 8px horizontal within each section
- [ ] Items within sections: 4px gap between them
- [ ] Section separators: 1px border at `var(--border-default)`
- [ ] Workspace header: 12px bottom padding before separator
- [ ] Avatar sizes: trigger=24px, header=36px, workspace list items=24px
- [ ] Text sizes: workspace name=14px, plan/count=12px, email=13px, items=13px, buttons=12px
- [ ] Font weights: workspace name=600 (semi-bold), everything else=400 (normal)

### Visual Polish — Dark Theme Specifics
- [ ] Dropdown background: `var(--bg-elevated)` (slightly lighter than sidebar)
- [ ] Borders: `var(--border-default)` (subtle, not harsh)
- [ ] Avatar colors: slightly muted in dark theme (lower saturation) to avoid harsh contrast
- [ ] Shadow: darker, more spread in dark theme for depth
- [ ] Text: primary/secondary/tertiary colors match Notion's dark theme hierarchy

### Visual Polish — Light Theme Specifics
- [ ] Dropdown background: white (#ffffff)
- [ ] Borders: light grey (#e5e5e5)
- [ ] Shadow: lighter, tighter
- [ ] Text: standard dark/medium/light grey hierarchy

### Keyboard Navigation (Complete)
- [ ] Tab order within dropdown: Settings → Invite → email "..." → workspace items → New workspace → Log out
- [ ] Arrow Down moves to next focusable item
- [ ] Arrow Up moves to previous focusable item
- [ ] Enter activates the focused item
- [ ] Escape closes the dropdown and returns focus to the trigger
- [ ] Home jumps to first item, End jumps to last item
- [ ] No focus trapped in disabled items (Invite dialog inputs are visually disabled but skip in tab order)

### Screen Reader Support
- [ ] Dropdown trigger: `aria-expanded`, `aria-haspopup="menu"`, `aria-label="Workspace menu"`
- [ ] Panel: `role="menu"`, `aria-label="Workspace options"`
- [ ] Each section: `role="group"`, `aria-label` describing the section
- [ ] Items: `role="menuitem"`
- [ ] Active workspace: `aria-current="true"`
- [ ] Disabled invite inputs: `aria-disabled="true"`, `aria-describedby` pointing to "coming soon" message

---

## Architecture Overview

```
Invite Members Dialog
──────────────────────

┌──────────────────────────────────────────────┐
│                                              │
│        👥                                    │
│                                              │
│  Invite members to Martin's Workspace        │
│                                              │
│  ┌────────────────────────────┐ ┌──────────┐│
│  │ name@example.com      (×) │ │ Member ▾ ││
│  └────────────────────────────┘ └──────────┘│
│                                              │
│  [        Invite (disabled)         ]        │
│                                              │
│  Team invitations are coming soon.           │
│  You'll be able to invite collaborators      │
│  by email.                                   │
│                                              │
│                         [Close]              │
└──────────────────────────────────────────────┘

Focus Order (Dropdown):
───────────────────────

1. [⚙ Settings]
2. [👥 Invite members]
3. [··· email options]
4. [M] Martin's Workspace ✓
5. + New workspace
6. ⎋ Log out
     ↓ (wraps to 1)

Complete Workspace Dropdown (Final):
─────────────────────────────────────

┌──────────────────────────────────────────────┐
│ ┌──┐                                         │
│ │M │ Martin's Workspace                  ▾  │ ← Trigger (24px avatar)
│ └──┘                                         │
└──────────────────────────────────────────────┘
  │
  ▼
┌──────────────────────────────────────────────┐
│ ┌────┐                                       │
│ │ M  │ Martin's Workspace                   │ ← 36px avatar
│ └────┘ Free Plan · 1 member                  │
│                                              │
│ ┌──────────────┐ ┌────────────────────┐     │ ← Button row
│ │ ⚙ Settings   │ │ 👥 Invite members │     │
│ └──────────────┘ └────────────────────┘     │
├──────────────────────────────────────────────┤
│ martin.priessner@gmail.com              ··· │ ← Email + options
│                                              │
│ ┌──┐ Martin's Workspace                 ✓  │ ← Workspace (active)
│ └──┘                                         │
│ + New workspace                              │ ← Accent color
├──────────────────────────────────────────────┤
│ ⎋ Log out                                    │ ← Neutral color
└──────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create InviteMembersDialog Component

**File: `src/components/workspace/InviteMembersDialog.tsx`**

```typescript
interface InviteMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceName: string;
}

// Modal with:
// - Team icon/illustration at top
// - Title: "Invite members to {workspaceName}"
// - Disabled email input + role dropdown + invite button
// - "Coming soon" message
// - Close button
// - Escape to close
```

### Step 2: Wire Invite Dialog into Dropdown

**File: `src/components/workspace/WorkspaceDropdown.tsx`** (modify)

Replace the placeholder toast with the actual dialog:

```typescript
const [showInviteDialog, setShowInviteDialog] = useState(false);

// In button row:
<button onClick={() => { setIsOpen(false); setShowInviteDialog(true); }}>
  Invite members
</button>

// Below dropdown:
<InviteMembersDialog
  isOpen={showInviteDialog}
  onClose={() => setShowInviteDialog(false)}
  workspaceName={activeWorkspace.name}
/>
```

### Step 3: Polish Hover & Focus States

**File: `src/components/workspace/workspace-dropdown.css`** (modify)

Add refined hover/focus states for all interactive elements:

```css
/* Refined hover states */
.ws-dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transition: background-color 100ms ease;
}

/* Focus ring for keyboard nav */
.ws-dropdown-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  border-radius: 4px;
}

/* Button hover: border darkens */
.ws-header-button:hover {
  border-color: var(--border-strong);
  background: var(--bg-hover);
}

/* New workspace underline on hover */
.ws-new-workspace:hover {
  text-decoration: underline;
}

/* Avatar gradient for depth */
.ws-avatar {
  background: linear-gradient(
    135deg,
    hsl(var(--avatar-hue), 60%, 55%),
    hsl(var(--avatar-hue), 60%, 45%)
  );
}

/* Checkmark scale-in */
.ws-checkmark {
  animation: checkmark-in 200ms ease-out;
}

@keyframes checkmark-in {
  from { transform: scale(0); }
  to { transform: scale(1); }
}
```

### Step 4: Add ARIA Attributes

**File: `src/components/workspace/WorkspaceDropdown.tsx`** (modify)

Ensure all ARIA attributes are correctly applied:

```typescript
// Trigger
<button
  aria-expanded={isOpen}
  aria-haspopup="menu"
  aria-label="Workspace menu"
>

// Panel
<div role="menu" aria-label="Workspace options">
  <div role="group" aria-label="Workspace settings">
    <button role="menuitem">Settings</button>
    <button role="menuitem">Invite members</button>
  </div>
  <div role="group" aria-label="Workspaces">
    <button role="menuitem" aria-current={isCurrent ? "true" : undefined}>
      {workspace.name}
    </button>
  </div>
  <div role="group" aria-label="Account actions">
    <button role="menuitem">Log out</button>
  </div>
</div>
```

### Step 5: Refine Dark/Light Theme Styles

**File: `src/components/workspace/workspace-dropdown.css`** (modify)

```css
/* Dark theme refinements */
[data-theme="dark"] .ws-dropdown-panel {
  background: var(--bg-elevated);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
}

[data-theme="dark"] .ws-avatar {
  filter: saturate(0.85); /* Slightly muted in dark theme */
}

/* Light theme refinements */
[data-theme="light"] .ws-dropdown-panel {
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-color: #e5e5e5;
}
```

---

## Testing Requirements

### Unit Tests (12+ cases)

**File: `src/__tests__/components/workspace/InviteMembersDialog.test.tsx`**

- Dialog renders title with workspace name
- Email input is present and disabled
- Role dropdown is present and disabled
- Invite button is present and disabled
- "Coming soon" message is visible
- Close button fires onClose
- Escape key fires onClose
- Dialog has proper ARIA attributes

**File: `src/__tests__/components/workspace/WorkspaceDropdown.polish.test.tsx`**

- All items have hover background class on hover
- Focus-visible ring appears on keyboard focus
- Checkmark has animation class
- Avatar has gradient background
- ARIA attributes: trigger has aria-expanded, panel has role="menu"
- Active workspace has aria-current="true"

### Integration Tests (6+ cases)

**File: `src/__tests__/integration/workspace-dropdown-polish.test.tsx`**

- Invite button → dialog opens with workspace name
- Dialog close → returns to dropdown
- Tab through all items → correct focus order
- ArrowDown through items → correct navigation
- Escape → closes dropdown, focus returns to trigger
- Dark theme → correct background and border colors

### E2E Tests (3+ cases)

**File: `src/__tests__/e2e/workspace-dropdown-polish.test.ts`**

- Click "Invite members" → dialog shows "coming soon" message → close
- Keyboard: Tab through dropdown items → all reachable
- Visual: dropdown matches Notion styling in dark theme (screenshot comparison)

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/workspace/InviteMembersDialog.tsx` | Create | Placeholder invite dialog |
| `src/components/workspace/WorkspaceDropdown.tsx` | Modify | Wire invite dialog, add ARIA attrs |
| `src/components/workspace/workspace-dropdown.css` | Modify | Polish hover/focus/theme styles |
| `src/__tests__/components/workspace/InviteMembersDialog.test.tsx` | Create | Dialog unit tests |
| `src/__tests__/components/workspace/WorkspaceDropdown.polish.test.tsx` | Create | Polish & accessibility tests |
| `src/__tests__/integration/workspace-dropdown-polish.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/workspace-dropdown-polish.test.ts` | Create | E2E tests |

---

**Last Updated:** 2026-02-25
