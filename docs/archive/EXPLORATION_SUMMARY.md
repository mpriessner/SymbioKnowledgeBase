# SymbioKnowledgeBase - Exploration Summary

## What Was Explored

This comprehensive exploration mapped out the entire sidebar, authentication, and settings system architecture across the SymbioKnowledgeBase codebase.

## Documents Generated

1. **SIDEBAR_EXPLORATION_REPORT.md** - 10-section detailed reference (full file paths, props, code)
2. **SIDEBAR_QUICK_REFERENCE.md** - Condensed cheat sheet (tables, diagrams, hooks)
3. **ARCHITECTURE_DIAGRAM.md** - Visual component hierarchies and data flows
4. **EXPLORATION_SUMMARY.md** - This document

## Key Findings

### 1. Sidebar Structure
The main sidebar (`src/components/workspace/Sidebar.tsx`) has 5 distinct regions:

```
[Header]        WorkspaceDropdown, Collapse, +Create
[Navigation]    Search, Home, Graph
[Content]       Recents, Private, Teamspaces (collapsible), Agent
[Footer]        Settings button
```

### 2. Authentication
- **Current:** Supabase email/password auth with token refresh every 45 minutes
- **Provider:** SupabaseProvider context (in `src/components/providers/SupabaseProvider.tsx`)
- **Hooks:** `useUser()`, `useSupabaseClient()`, `useAuthLoading()`
- **Logout:** Via `supabase.auth.signOut()` in WorkspaceDropdown

### 3. Settings System (TWO implementations)
- **Active:** Page-based routing at `/settings/{section}`
- **Deprecated:** Modal implementation (not used)

Settings are accessed via:
1. Sidebar footer "Settings" button
2. WorkspaceDropdown menu "Settings" option
3. Direct URL navigation

### 4. User Profile Display
- Avatar: Color-coded initials or uploaded image
- Location: `/settings/profile` page
- Features: Edit name, copy user ID, upload photo

### 5. Existing Dropdowns
- **WorkspaceDropdown** - Custom (workspace + logout)
- **Create menu** - Inline in sidebar header
- **Dropdown UI component** - Reusable with keyboard nav
- **Theme selector** - Custom select in preferences

### 6. Workspace Switching
- **NOT IMPLEMENTED** - Hardcoded to "SymbioKnowledgeBase"
- **Database support exists** but no UI
- **Teamspaces** exist as sub-groups (different concept)

## Component Overview

### Main Components

| Component | Path | Purpose | Key Feature |
|-----------|------|---------|-------------|
| Sidebar | workspace/Sidebar.tsx | Main nav | Page tree + workspace menu |
| WorkspaceDropdown | workspace/WorkspaceDropdown.tsx | Workspace menu | Settings + logout |
| SidebarTeamspaceSection | workspace/SidebarTeamspaceSection.tsx | Collapsible section | Per-space page lists |
| SettingsSidebar | settings/SettingsSidebar.tsx | Settings nav | Icon-based nav with sections |
| SupabaseProvider | providers/SupabaseProvider.tsx | Auth context | User + session management |

### Settings Pages

| Page | File | Component | Features |
|------|------|-----------|----------|
| Profile | settings/profile/page.tsx | AccountProfileSection | Avatar, name, ID |
| Preferences | settings/preferences/page.tsx | PreferencesSection | Theme, language, date format |
| Security | settings/security/page.tsx | AccountSecuritySection | Password, 2FA (stub), passkeys (stub) |
| API Keys | settings/api-keys/page.tsx | ApiKeysSection | API key mgmt |
| AI Config | settings/ai-config/page.tsx | AIConfigSection | AI settings |

## Technical Highlights

### Authentication Flow
```
Login → Supabase.signInWithPassword() → SupabaseProvider → useUser()
     → Auto-refresh every 45 mins → Logout via signOut() → /login
```

### Sidebar State Management
- `useSidebarCollapse()` - Collapse/expand state
- `useSidebarWidth()` - Resizable width + dragging
- `usePageTree()` - Page hierarchy
- `useRecentPages()` - Last viewed
- `useTeamspaces()` - All teamspaces
- Local state: `showCreateMenu` - Create dropdown

### Theme System
Uses CSS variables (e.g., `var(--sidebar-bg)`) applied dynamically via `useTheme()` hook.

### Accessibility
- Full keyboard navigation (Arrow keys, Enter, Escape)
- ARIA labels and roles throughout
- Click-outside detection
- Proper focus management

## What's NOT Implemented

- Workspace switching / multi-workspace UI
- Change email functionality
- Two-factor authentication
- Passkeys / biometric login
- Workspace settings customization
- Notifications system (stub exists)
- Team/people management UI

## Quick Navigation

**Want to...**

...modify the sidebar?
→ Edit `src/components/workspace/Sidebar.tsx`

...change settings pages?
→ Edit `src/app/(workspace)/settings/{section}/page.tsx`

...add a new settings section?
→ Add to `src/components/settings/` and link in `SettingsSidebar.tsx`

...change auth behavior?
→ Modify `src/components/providers/SupabaseProvider.tsx`

...access current user?
→ Call `const user = useUser()` hook

...logout the user?
→ Used in `WorkspaceDropdown.tsx`: `supabase.auth.signOut()`

...customize theme?
→ Use `const { theme, setTheme } = useTheme()` hook

...reuse dropdown component?
→ Import from `src/components/ui/Dropdown.tsx`

## File Organization

```
src/
├── components/
│   ├── workspace/        # Sidebar + workspace features
│   ├── settings/         # Settings section components
│   ├── providers/        # Auth + data providers
│   └── ui/              # Reusable UI components (Button, Dropdown, etc.)
│
├── app/
│   ├── (workspace)/      # Workspace layout + routes
│   │   └── settings/     # Settings pages
│   ├── (auth)/           # Login/register pages
│   └── layout.tsx        # Root with AuthProvider
│
└── lib/
    ├── auth.ts           # NextAuth config (legacy)
    └── supabase/         # Supabase client
```

## Key Hooks Reference

```typescript
// Auth
const user = useUser();
const client = useSupabaseClient();
const loading = useAuthLoading();

// Sidebar/UI
const { isCollapsed, toggle } = useSidebarCollapse();
const { width, isResizing, startResize } = useSidebarWidth();
const { theme, setTheme } = useTheme();
const isMac = useIsMac();

// Data
const { data: pages, isLoading } = usePageTree();
const { data: teamspaces } = useTeamspaces();
const { recentPages } = useRecentPages();
const createPage = useCreatePage();
```

## CSS Variables (Theme)

```css
/* Sidebar */
--sidebar-bg
--sidebar-text
--sidebar-text-secondary
--sidebar-hover
--sidebar-active

/* Content */
--bg-primary, --bg-secondary, --bg-tertiary
--bg-hover
--text-primary, --text-secondary, --text-tertiary

/* Interactive */
--border-default
--accent-primary
--overlay
--danger
```

## Next Steps for Implementation

If planning to extend this system:

1. **Workspace Switching:** Need UI in WorkspaceDropdown + route handling
2. **User Menu:** Consider adding avatar + name to sidebar header
3. **Team Management:** Build out `/settings/people` page
4. **Notifications:** Complete `/settings/notifications` page
5. **2FA/Passkeys:** Implement in AccountSecuritySection

## Notes for Developers

- The codebase uses Next.js 13+ with App Router
- Styling via Tailwind + CSS variables
- Auth via Supabase (not NextAuth - which is legacy)
- Page tree uses drag-drop (DndSidebarTree component)
- Settings use page-based routing (not modal)
- Full TypeScript throughout

---

**Report Generated:** 2026-02-25
**Scope:** Complete sidebar, auth, and settings exploration
**Status:** Ready for reference or implementation planning
