# Story SKB-23.1: Workspace Dropdown Visual Redesign & Settings Relocation

**Epic:** Epic 23 - Workspace Dropdown Menu Redesign
**Story ID:** SKB-23.1
**Story Points:** 8 | **Priority:** High | **Status:** Draft
**Depends On:** Nothing (first story in epic)

---

## User Story

As a SymbioKnowledgeBase user, I want the workspace dropdown at the top-left of my sidebar to look and feel like Notion's — showing my workspace identity, quick access to Settings, my account email, and a clear Log out option, So that the app feels polished and familiar to Notion users.

---

## Acceptance Criteria

### Dropdown Trigger (Sidebar Header)
- [ ] The trigger button at the top of the sidebar shows:
  - A workspace avatar: colored circle with the first letter of the workspace name (e.g., "M" for "Martin's Workspace")
  - The workspace name, truncated with ellipsis if too long
  - A small chevron icon indicating a dropdown
- [ ] Clicking the trigger opens the dropdown panel below it
- [ ] The trigger takes the full width of the sidebar header area
- [ ] The trigger has a subtle hover background
- [ ] When the dropdown is open, the trigger has an active/pressed state

### Dropdown Panel — Section 1: Workspace Header
- [ ] Top section shows:
  - Workspace avatar (larger, ~40px) with initial letter and colored background
  - Workspace name in bold (e.g., "Martin's Workspace")
  - Plan badge: "Free Plan" (or the actual plan name) in small, dimmed text
  - Member count: "· 1 member" (or actual count) in small, dimmed text
- [ ] Below the name/plan row: two side-by-side buttons:
  - **Settings** button: gear icon + "Settings" label — navigates to `/settings`
  - **Invite members** button: person-plus icon + "Invite members" label — placeholder (SKB-23.3)
- [ ] Buttons have subtle border, rounded corners, hover highlight
- [ ] This section has a bottom border separator

### Dropdown Panel — Section 2: Account & Workspaces
- [ ] User's email address displayed in dimmed text (e.g., "martin.priessner@gmail.com")
- [ ] A "..." button next to the email (placeholder for account options — no action needed)
- [ ] Below email: list of workspaces the user belongs to
  - Each workspace shows: avatar initial + workspace name
  - The currently active workspace has a checkmark (✓) icon on the right
  - Clicking a different workspace would switch to it (functional in SKB-23.2; for now, only show current)
- [ ] "+ New workspace" link in blue/accent color at the bottom of the workspace list
  - Clicking opens workspace creation dialog (functional in SKB-23.2; for now, show placeholder toast)
- [ ] This section has a bottom border separator

### Dropdown Panel — Section 3: Actions
- [ ] "Log out" menu item at the bottom
  - Shows a log-out icon + "Log out" text
  - Clicking calls `supabase.auth.signOut()`, redirects to `/login`, refreshes router
  - Standard text color (not red/danger — matches Notion's styling)

### Settings Removal from Sidebar Footer
- [ ] The settings gear button in the sidebar footer is **removed**
- [ ] The sidebar footer area is either:
  - Completely removed (if nothing else needs to be there), OR
  - Cleaned up to show only essential footer items (help button, etc.)
- [ ] Settings is now ONLY accessible from the workspace dropdown
- [ ] Navigating to `/settings` directly via URL still works (page routing unchanged)

### Dropdown Behavior
- [ ] Dropdown opens below the trigger, aligned to the left edge of the sidebar
- [ ] Dropdown width matches the sidebar width (minus padding)
- [ ] Dropdown has a subtle shadow, border, rounded corners (8px)
- [ ] Dropdown appears with a fade-in + slight slide-down animation (150ms)
- [ ] Dropdown closes when:
  - Clicking outside the dropdown
  - Pressing Escape
  - Clicking a menu item (Settings, Log out)
- [ ] Dropdown closes smoothly (100ms fade-out)

### Visual Design (Matching Notion)
- [ ] Background: semi-transparent with backdrop blur in dark theme, solid white in light theme
- [ ] Section separators: 1px border using `var(--border-default)`
- [ ] Text hierarchy:
  - Workspace name: 14px, semi-bold, primary text color
  - Plan/member count: 12px, tertiary text color
  - Email: 13px, secondary text color
  - Menu items: 13px, secondary text color, hover → primary
- [ ] Button row (Settings, Invite): 12px text, icon 14px, subtle border, 6px padding, 4px border-radius
- [ ] Workspace avatar: generated from workspace name using deterministic color (hue from name hash)
- [ ] Checkmark on active workspace: accent color or green
- [ ] "+ New workspace": accent/blue color text

### Accessibility
- [ ] Dropdown trigger has `aria-expanded` and `aria-haspopup="menu"`
- [ ] Dropdown panel has `role="menu"`
- [ ] Menu items have `role="menuitem"`
- [ ] Keyboard: ArrowDown/Up navigates items, Enter selects, Escape closes
- [ ] Focus trapped inside dropdown while open
- [ ] Focus returns to trigger when dropdown closes

### Theming
- [ ] All colors use CSS custom properties (works in both light and dark themes)
- [ ] Dark theme: dark elevated background, light text, subtle borders
- [ ] Light theme: white background, dark text, light borders
- [ ] Avatar colors work well in both themes

---

## Architecture Overview

```
Redesigned Workspace Dropdown
──────────────────────────────

Trigger Button (sidebar header):
┌──────────────────────────────────────────────┐
│ [M] Martin's Workspace                    ▾  │
└──────────────────────────────────────────────┘
                │
                ▼ click
Dropdown Panel:
┌──────────────────────────────────────────────┐
│ [M] Martin's Workspace                       │  Section 1:
│     Free Plan · 1 member                     │  Workspace
│                                              │  Header
│ [⚙ Settings]  [👥 Invite members]           │
├──────────────────────────────────────────────┤
│ martin.priessner@gmail.com              ···  │  Section 2:
│                                              │  Account &
│ [M] Martin's Workspace                   ✓  │  Workspaces
│                                              │
│ + New workspace                              │
├──────────────────────────────────────────────┤
│ ⎋ Log out                                    │  Section 3:
└──────────────────────────────────────────────┘  Actions

Component Tree:
───────────────

Sidebar
├── SidebarHeader
│   └── WorkspaceDropdown (trigger + panel)
│       ├── DropdownTrigger
│       │   ├── WorkspaceAvatar (initial + color)
│       │   ├── WorkspaceName (truncated)
│       │   └── ChevronIcon
│       └── DropdownPanel (conditional)
│           ├── WorkspaceHeaderSection
│           │   ├── WorkspaceAvatar (larger)
│           │   ├── WorkspaceName + PlanBadge + MemberCount
│           │   └── ButtonRow
│           │       ├── SettingsButton → router.push("/settings")
│           │       └── InviteButton → placeholder
│           ├── AccountSection
│           │   ├── UserEmail + OptionsButton
│           │   ├── WorkspaceList
│           │   │   └── WorkspaceItem (current, with ✓)
│           │   └── NewWorkspaceLink
│           └── ActionsSection
│               └── LogoutButton → supabase.auth.signOut()
├── SidebarNav (Search, Home, Graph, ...)
├── PageTree
└── (no more footer settings button)

Data Flow:
──────────

useUser() → user.email, user.user_metadata.name
useWorkspace() → workspace.name, workspace.plan, workspace.memberCount
  │
  ├── WorkspaceAvatar: initial from workspace.name, color from hash
  ├── Trigger: workspace.name
  ├── Header: workspace.name, workspace.plan, memberCount
  ├── Email: user.email
  ├── Workspace list: [{ id, name, isCurrent }]
  └── Logout: supabase.auth.signOut()
```

---

## Implementation Steps

### Step 1: Create WorkspaceAvatar Component

**File: `src/components/workspace/WorkspaceAvatar.tsx`**

```typescript
interface WorkspaceAvatarProps {
  name: string;
  size?: "sm" | "md" | "lg"; // 24px, 32px, 40px
  className?: string;
}

// Renders a colored circle with the first letter of the workspace name
// Color is deterministic: hash workspace name → hue → hsl(hue, 60%, 50%)
// Letter is uppercase, white, centered
// Supports all three sizes
```

### Step 2: Redesign WorkspaceDropdown Component

**File: `src/components/workspace/WorkspaceDropdown.tsx`** (rewrite)

```typescript
interface WorkspaceDropdownProps {
  // No more onOpenSettings prop — settings navigation is internal
}

export function WorkspaceDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const user = useUser();
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  // Outside click + Escape handlers (existing pattern)

  const handleSettings = () => {
    setIsOpen(false);
    router.push("/settings");
  };

  const handleLogout = async () => {
    setIsOpen(false);
    const supabase = createClient();
    await supabase?.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen} aria-haspopup="menu">
        <WorkspaceAvatar name={workspaceName} size="sm" />
        <span>{workspaceName}</span>
        <ChevronIcon rotated={isOpen} />
      </button>

      {/* Panel */}
      {isOpen && (
        <div role="menu" className="dropdown-panel">
          {/* Section 1: Workspace Header */}
          <WorkspaceHeaderSection
            name={workspaceName}
            plan="Free Plan"
            memberCount={1}
            onSettings={handleSettings}
            onInvite={() => toast("Coming soon")}
          />

          {/* Section 2: Account & Workspaces */}
          <AccountSection
            email={user?.email}
            workspaces={[{ id: "current", name: workspaceName, isCurrent: true }]}
            onNewWorkspace={() => toast("Coming soon")}
            onSwitchWorkspace={() => {}}
          />

          {/* Section 3: Actions */}
          <ActionsSection onLogout={handleLogout} />
        </div>
      )}
    </div>
  );
}
```

### Step 3: Create Dropdown Sub-Components

**WorkspaceHeaderSection** — avatar, name, plan, buttons row
**AccountSection** — email, workspace list, new workspace link
**ActionsSection** — logout button

These can be inline in the main file or extracted as small components.

### Step 4: Remove Settings from Sidebar Footer

**File: `src/components/workspace/Sidebar.tsx`** (modify)

Remove the footer section (lines ~284-296) that contains the settings gear button:

```typescript
// BEFORE:
<div className="flex-shrink-0 border-t ...">
  <button onClick={() => router.push("/settings")}>
    <SettingsIcon /> Settings
  </button>
</div>

// AFTER:
// Footer section removed entirely, OR replaced with minimal help icon
```

### Step 5: Remove onOpenSettings Prop

**File: `src/components/workspace/Sidebar.tsx`** (modify)

The `WorkspaceDropdown` no longer needs the `onOpenSettings` prop since settings navigation is handled internally:

```typescript
// BEFORE:
<WorkspaceDropdown onOpenSettings={() => router.push("/settings")} />

// AFTER:
<WorkspaceDropdown />
```

### Step 6: Add Dropdown Styles

**File: `src/components/workspace/workspace-dropdown.css`** (create)

```css
.ws-dropdown-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 50;
  overflow: hidden;
  animation: dropdown-enter 150ms ease-out;
}

@keyframes dropdown-enter {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

.ws-dropdown-section {
  padding: 8px;
  border-bottom: 1px solid var(--border-default);
}

.ws-dropdown-section:last-child {
  border-bottom: none;
}

.ws-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary);
  transition: background-color 100ms ease;
}

.ws-dropdown-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ws-header-buttons {
  display: flex;
  gap: 6px;
  margin-top: 8px;
}

.ws-header-button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid var(--border-default);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-secondary);
  background: transparent;
  cursor: pointer;
  transition: background-color 100ms ease;
}

.ws-header-button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.ws-new-workspace {
  color: var(--accent);
  font-size: 13px;
  cursor: pointer;
}

.ws-new-workspace:hover {
  text-decoration: underline;
}
```

### Step 7: Implement Keyboard Navigation

Inside the dropdown panel, add keyboard event handler:

```typescript
function handleKeyDown(e: React.KeyboardEvent) {
  const items = getAllFocusableItems(); // Settings, Invite, workspace items, new workspace, logout
  const currentIndex = items.findIndex(item => item === document.activeElement);

  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      items[Math.min(currentIndex + 1, items.length - 1)]?.focus();
      break;
    case "ArrowUp":
      e.preventDefault();
      items[Math.max(currentIndex - 1, 0)]?.focus();
      break;
    case "Enter":
      (document.activeElement as HTMLElement)?.click();
      break;
    case "Escape":
      setIsOpen(false);
      triggerRef.current?.focus();
      break;
  }
}
```

---

## Testing Requirements

### Unit Tests (25+ cases)

**File: `src/__tests__/components/workspace/WorkspaceAvatar.test.tsx`**

- Renders first letter of workspace name (uppercase)
- "Martin's Workspace" → "M"
- "SymbioKnowledgeBase" → "S"
- Sizes: sm=24px, md=32px, lg=40px
- Background color is deterministic (same name → same color)
- Different names produce different colors

**File: `src/__tests__/components/workspace/WorkspaceDropdown.test.tsx`**

- **Trigger tests:**
  - Trigger renders workspace avatar + name + chevron
  - Trigger shows workspace name truncated if too long
  - Clicking trigger opens dropdown panel
  - Clicking trigger again closes dropdown
  - aria-expanded reflects open state

- **Section 1 (Workspace Header):**
  - Large avatar shows with initial
  - Workspace name displayed in bold
  - Plan badge shows "Free Plan"
  - Member count shows "1 member"
  - Settings button is present
  - Invite members button is present
  - Clicking Settings navigates to `/settings`

- **Section 2 (Account & Workspaces):**
  - User email displayed
  - "..." options button is present
  - Current workspace listed with checkmark
  - "+ New workspace" link is present with accent color

- **Section 3 (Actions):**
  - Log out button is present
  - Clicking Log out calls supabase.auth.signOut()
  - After logout, redirects to /login

- **Behavior:**
  - Outside click closes dropdown
  - Escape key closes dropdown
  - Dropdown has role="menu"
  - Menu items have role="menuitem"

**File: `src/__tests__/components/workspace/Sidebar.test.tsx`** (regression)

- Settings button is NOT present in sidebar footer
- WorkspaceDropdown renders without onOpenSettings prop
- Sidebar still renders all other sections (nav, page tree, etc.)

### Integration Tests (10+ cases)

**File: `src/__tests__/integration/workspace-dropdown.test.tsx`**

- Open dropdown → Settings button navigates to /settings
- Open dropdown → Log out calls signOut and redirects
- User email displays from Supabase auth context
- Workspace avatar color matches workspace name
- Keyboard: ArrowDown moves focus through items
- Keyboard: Enter on Settings navigates to /settings
- Keyboard: Escape closes and returns focus to trigger
- Dark theme: dropdown uses correct background/text colors
- Light theme: dropdown uses correct background/text colors
- Dropdown width matches sidebar width

### E2E Tests (5+ cases)

**File: `src/__tests__/e2e/workspace-dropdown.test.ts`**

- Click workspace name → dropdown opens with all sections visible
- Click "Settings" in dropdown → navigates to /settings page
- Click "Log out" → user logged out → redirected to /login
- Settings is NOT visible in sidebar footer
- Dropdown closes when clicking outside

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/workspace/WorkspaceAvatar.tsx` | Create | Colored initial avatar component |
| `src/components/workspace/WorkspaceDropdown.tsx` | Rewrite | Full redesign matching Notion layout |
| `src/components/workspace/workspace-dropdown.css` | Create | Dropdown panel styles |
| `src/components/workspace/Sidebar.tsx` | Modify | Remove footer settings button; remove onOpenSettings prop |
| `src/__tests__/components/workspace/WorkspaceAvatar.test.tsx` | Create | Avatar unit tests |
| `src/__tests__/components/workspace/WorkspaceDropdown.test.tsx` | Create | Dropdown unit tests |
| `src/__tests__/components/workspace/Sidebar.test.tsx` | Modify | Regression: no footer settings |
| `src/__tests__/integration/workspace-dropdown.test.tsx` | Create | Integration tests |
| `src/__tests__/e2e/workspace-dropdown.test.ts` | Create | E2E tests |

---

## Risk Mitigation

### Breaking Change: Settings Access
- **Risk:** Users accustomed to footer settings button can't find settings
- **Mitigation:** Settings is prominently placed in the workspace dropdown (first button visible). The `/settings` URL route is unchanged. If needed, a temporary tooltip "Settings moved here" can be shown on first visit after the change.

### Breaking Change: WorkspaceDropdown Props
- **Risk:** Removing `onOpenSettings` prop breaks Sidebar
- **Mitigation:** Both changes (Sidebar.tsx and WorkspaceDropdown.tsx) are in the same story and tested together. Sidebar is the only consumer of WorkspaceDropdown.

---

**Last Updated:** 2026-02-25
