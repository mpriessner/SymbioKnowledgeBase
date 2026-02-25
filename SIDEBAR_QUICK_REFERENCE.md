# SymbioKnowledgeBase - Quick Reference Guide

## Current Sidebar Layout (Top to Bottom)

```
┌─────────────────────────────────────────────┐
│ [WorkspaceDropdown] Collapse  +Create       │  ← Header
├─────────────────────────────────────────────┤
│ 🔍 Search (Cmd+K)                          │  ← Navigation
│ 🏠 Home                                     │
│ 📊 Graph                                    │
├─────────────────────────────────────────────┤
│ 📌 RECENTS                                  │
│ └─ Last 5 pages...                         │
├─────────────────────────────────────────────┤
│ 🔒 PRIVATE (collapsible)                    │  ← Page tree sections
│ └─ [User's pages...]                       │
├─────────────────────────────────────────────┤
│ 👥 TEAMSPACE NAME (collapsible) [count]    │
│ └─ [Teamspace pages...]                    │
├─────────────────────────────────────────────┤
│ ✨ AGENT (collapsible)                      │
│ └─ [Agent knowledge base...]               │
├─────────────────────────────────────────────┤
│ ⚙️ Settings                                 │  ← Footer
└─────────────────────────────────────────────┘
```

## Key Components at a Glance

| Component | Location | Purpose |
|-----------|----------|---------|
| Sidebar | workspace/Sidebar.tsx | Main nav sidebar |
| WorkspaceDropdown | workspace/WorkspaceDropdown.tsx | Workspace + logout menu |
| SidebarTeamspaceSection | workspace/SidebarTeamspaceSection.tsx | Collapsible page sections |
| SettingsSidebar | settings/SettingsSidebar.tsx | Settings page nav |

## Authentication Flow

```
User → Login Page
   ↓
Supabase.auth.signInWithPassword()
   ↓
SupabaseProvider captures session
   ↓
User object available via useUser()
   ↓
Auto-refresh every 45 mins
```

## Settings Access Points

1. **Sidebar Footer** → Settings gear icon → `/settings`
2. **WorkspaceDropdown Menu** → Settings option → `/settings`
3. **URL Navigation** → `/settings/profile`, `/settings/preferences`, etc.

## Settings Pages Structure

```
/settings/
├── layout.tsx (SettingsSidebar + content)
├── /profile (AccountProfileSection)
├── /preferences (Theme, Language, Date Format)
├── /security (Password, 2FA, Passkeys)
├── /general (Workspace name - stub)
├── /people (Team management)
├── /notifications (Coming soon)
├── /api-keys (API key management)
└── /ai-config (AI settings)
```

## Key CSS Variables Used

```css
--sidebar-bg              /* Sidebar background */
--sidebar-text            /* Sidebar primary text */
--sidebar-text-secondary  /* Sidebar secondary text */
--sidebar-hover           /* Hover state */
--sidebar-active          /* Active item */
--bg-primary              /* Main background */
--text-primary            /* Main text */
--accent-primary          /* Buttons, links */
--border-default          /* Borders */
```

## Reusable Dropdown Component

**Location:** `/src/components/ui/Dropdown.tsx`

```typescript
<Dropdown
  trigger={<button>Click me</button>}
  items={[
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" },
  ]}
  onSelect={(value) => console.log(value)}
  align="left"
/>
```

## User Profile in Settings

- **Avatar:** Color-coded initials (from name/email hash) or uploaded image
- **Name:** Editable preferred name
- **Email:** Display only (read-only)
- **User ID:** Copy-to-clipboard button
- **Photo:** Click avatar to upload new photo

## Authentication Methods

- **Current:** Supabase (email/password)
- **Legacy:** NextAuth in codebase (inactive)
- **Session:** JWT, max age 24 hours
- **Token Refresh:** Automatic every 45 minutes
- **Logout:** Via `supabase.auth.signOut()`

## What's NOT Implemented Yet

- ✗ Workspace switching (hardcoded to "SymbioKnowledgeBase")
- ✗ Multiple workspace management
- ✗ Change email
- ✗ Two-factor authentication
- ✗ Passkeys
- ✗ Workspace settings customization

## Quick Hook Reference

```typescript
// Auth
const user = useUser();                     // Current user
const client = useSupabaseClient();         // Supabase client
const isLoading = useAuthLoading();         // Auth loading state

// UI
const { theme, setTheme } = useTheme();     // Theme management
const { isCollapsed, toggle } = useSidebarCollapse();
const { width, isResizing } = useSidebarWidth();

// Data
const { data: pages } = usePageTree();      // Page hierarchy
const { data: teamspaces } = useTeamspaces();
const { recentPages } = useRecentPages();
```

## Important File Locations

| System | Main File |
|--------|-----------|
| Auth | src/components/providers/SupabaseProvider.tsx |
| Sidebar | src/components/workspace/Sidebar.tsx |
| Settings | src/app/(workspace)/settings/ |
| UI Components | src/components/ui/ |
| Settings Sidebar | src/components/settings/SettingsSidebar.tsx |

---

**For full details, see:** `SIDEBAR_EXPLORATION_REPORT.md`
