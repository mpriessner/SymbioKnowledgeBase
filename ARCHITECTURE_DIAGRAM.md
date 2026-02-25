# SymbioKnowledgeBase Architecture Diagram

## Overall App Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                         App Layout                              │
│                   (workspace/layout.tsx)                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────────────────────┐   │
│  │                  │  │                                  │   │
│  │   Sidebar        │  │        Main Content              │   │
│  │  (workspace)     │  │        (Dynamic Pages)           │   │
│  │                  │  │                                  │   │
│  │ • Workspace      │  │  • Pages                         │   │
│  │   Dropdown       │  │  • Databases                     │   │
│  │                  │  │  • Graph View                    │   │
│  │ • Search        │  │  • Settings                      │   │
│  │ • Navigation    │  │                                  │   │
│  │                  │  │  BreadcrumbsWrapper (top)       │   │
│  │ • Page Tree     │  │  QuickSwitcher (Cmd+K)          │   │
│  │   - Recents     │  │  EnhancedSearch (Cmd+Shift+F)   │   │
│  │   - Private     │  │  AIChatButton (floating)        │   │
│  │   - Teamspaces  │  │                                  │   │
│  │   - Agent       │  │                                  │   │
│  │                  │  │                                  │   │
│  │ • Settings btn  │  │                                  │   │
│  │   (footer)      │  │                                  │   │
│  │                  │  │                                  │   │
│  └──────────────────┘  └──────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Authentication Layer

```
┌─────────────────────────────────────┐
│   Root Layout (layout.tsx)          │
│  (with AuthProvider wrapper)        │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐  │
│  │  AuthProvider                 │  │
│  │  (Simple wrapper)             │  │
│  ├───────────────────────────────┤  │
│  │  SupabaseProvider             │  │
│  │  (Primary Auth Context)       │  │
│  │                               │  │
│  │  • supabase client            │  │
│  │  • user object                │  │
│  │  • isLoading state            │  │
│  │  • auth state listener        │  │
│  │  • token refresh (45 min)     │  │
│  │                               │  │
│  │  Hooks exposed:               │  │
│  │  • useUser()                  │  │
│  │  • useSupabaseClient()        │  │
│  │  • useAuthLoading()           │  │
│  └───────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

## Sidebar Component Hierarchy

```
Sidebar (workspace/Sidebar.tsx)
│
├── Header Section
│   ├── WorkspaceDropdown
│   │   ├── Trigger: "SymbioKnowledgeBase" + chevron
│   │   └── Menu:
│   │       ├── Current workspace (with checkmark)
│   │       ├── Settings → onOpenSettings() → /settings
│   │       └── Log out → supabase.auth.signOut() → /login
│   │
│   ├── Collapse button
│   └── Create menu
│       ├── New Page
│       ├── New Database
│       └── AI Meeting Notes
│
├── Navigation Section
│   ├── Search button (Cmd+K)
│   ├── Home link
│   └── Graph link
│
├── Content Section (Scrollable)
│   ├── Recents section
│   │   └── Last 5 pages (if any)
│   │
│   ├── SidebarTeamspaceSection (Private)
│   │   ├── Collapse toggle
│   │   ├── Icon + Label
│   │   └── DndSidebarTree
│   │       └── Individual page nodes with drag-drop
│   │
│   ├── SidebarTeamspaceSection (per Teamspace)
│   │   ├── Collapse toggle
│   │   ├── Icon + Label + Member count badge
│   │   └── DndSidebarTree
│   │
│   └── SidebarTeamspaceSection (Agent)
│       ├── Collapse toggle
│       ├── Icon + Label
│       └── DndSidebarTree
│
└── Footer Section
    └── Settings button
        └── onClick: router.push("/settings")
```

## Settings System Architecture

```
Settings Access Points:
    ↓                          ↓
Sidebar Footer Button    WorkspaceDropdown Menu
    ↓                          ↓
    └─────────────── /settings ────────────┘
                         ↓
         settings/layout.tsx
              (SettingsSidebar + content wrapper)
                         ↓
        ┌────────────────────────────────┐
        │                                │
        │    SettingsSidebar (220px)     │    Main Content Area
        │    (Left Navigation)           │    (Scrollable)
        │                                │
        │ Account (section):             │
        │ • Profile ─────────────────→ AccountProfileSection
        │ • Preferences ─────────────→ PreferencesSection
        │ • Notifications ────────────→ NotificationsSection
        │                                │
        │ Workspace (section):           │
        │ • General ─────────────────→ GeneralPage (stub)
        │ • People ──────────────────→ PeoplePage
        │ • AI Configuration ────────→ AIConfigSection
        │                                │
        │ Security (section):            │
        │ • Security ─────────────────→ AccountSecuritySection
        │ • API Keys ─────────────────→ ApiKeysSection
        │                                │
        └────────────────────────────────┘
```

## Settings Pages Detail

```
/settings/profile/
    └── AccountProfileSection
        ├── Avatar display/upload
        ├── Name field (editable)
        ├── Email display
        ├── User ID (copy-to-clipboard)
        └── Save button

/settings/preferences/
    └── PreferencesSection
        ├── Theme selector (Light/Dark/System)
        ├── Language selector (EN/DE/ES)
        ├── Date format selector
        └── Week start selector

/settings/security/
    └── AccountSecuritySection
        ├── Email row (read-only)
        ├── Password row
        │   └── Opens ChangePasswordModal
        ├── Two-factor verification (disabled/coming soon)
        └── Passkeys (disabled/coming soon)

/settings/general/
    └── Workspace Settings stub
        └── Coming soon

/settings/api-keys/
    └── ApiKeysSection
        └── API key management

/settings/ai-config/
    └── AIConfigSection
        └── AI settings
```

## Dropdown Component (Reusable UI)

```
<Dropdown />
    ├── trigger (React node - what to click)
    │
    ├── Container (relative positioning)
    │   ├── Trigger button
    │   │   └── onClick: toggle isOpen
    │   │
    │   └── Menu (when isOpen)
    │       ├── Uses role="listbox" for a11y
    │       ├── Menu items with:
    │       │   ├── label
    │       │   ├── value
    │       │   ├── disabled state (optional)
    │       │   └── onClick: onSelect(value)
    │       │
    │       └── Keyboard support:
    │           ├── ArrowDown/Up: navigate items
    │           ├── Enter/Space: select item
    │           └── Escape: close menu
    │
    ├── Click-outside detection: closes menu
    └── Accessibility: full ARIA support
```

## WorkspaceDropdown in Detail

```
WorkspaceDropdown
│
├── State:
│   ├── isOpen (boolean)
│   └── containerRef (useRef)
│
├── Effects:
│   ├── Click-outside listener
│   └── Escape key listener
│
├── Trigger Button:
│   └── "SymbioKnowledgeBase" + chevron (rotates when open)
│
└── Dropdown Menu (when isOpen):
    │
    ├── Current Workspace Section
    │   ├── Checkmark icon
    │   └── Label: "SymbioKnowledgeBase"
    │
    ├── Divider
    │
    ├── Settings Option
    │   ├── Gear icon
    │   ├── Label: "Settings"
    │   └── onClick: onOpenSettings() (callback to parent)
    │
    ├── Divider
    │
    └── Log Out Option
        ├── Exit icon
        ├── Label: "Log out"
        └── onClick: handleLogout()
            └── await supabase.auth.signOut()
            └── router.push("/login")
            └── router.refresh()
```

## User Object Structure (from Supabase)

```
User {
  id: string;
  email: string;
  aud: string;
  created_at: string;
  
  app_metadata: {
    provider?: string;  // "email", "oauth", etc.
    // ... other auth metadata
  };
  
  user_metadata: {
    name?: string;
    avatar_url?: string;
    // ... custom fields
  };
  
  identities?: Array<{
    id: string;
    provider: string;
    // ...
  }>;
  
  // ... other fields
}
```

## Theme CSS Variables System

```
CSS Variables Applied (via --root styles)
│
├── Sidebar Colors:
│   ├── --sidebar-bg (background)
│   ├── --sidebar-text (primary text)
│   ├── --sidebar-text-secondary
│   ├── --sidebar-hover
│   └── --sidebar-active
│
├── Content Colors:
│   ├── --bg-primary
│   ├── --bg-secondary
│   ├── --bg-tertiary
│   ├── --bg-hover
│   ├── --text-primary
│   ├── --text-secondary
│   └── --text-tertiary
│
├── Interactive:
│   ├── --border-default
│   ├── --accent-primary (buttons, links)
│   ├── --overlay (modals, overlays)
│   └── --danger (errors)
│
└── Hook: useTheme()
    ├── Returns: { theme: "light" | "dark" | "system", setTheme }
    └── Updates CSS variables in DOM
```

## Data Flow: Page Tree

```
Sidebar
    │
    ├── usePageTree() hook
    │   └── Fetches page hierarchy from API
    │
    ├── useTeamspaces() hook
    │   └── Fetches all teamspaces user has access to
    │
    ├── useRecentPages() hook
    │   └── Fetches last 5 viewed pages
    │
    └── Renders:
        ├── SidebarTeamspaceSection (private)
        │   ├── sectionId: "private"
        │   ├── tree: pages without teamspaceId
        │   └── DndSidebarTree (drag-drop enabled)
        │
        └── SidebarTeamspaceSection (per teamspace)
            ├── sectionId: teamspace.id
            ├── label: teamspace.name
            ├── icon: teamspace.icon
            ├── badge: member_count
            ├── tree: pages with matching teamspaceId
            └── DndSidebarTree (drag-drop enabled)
```

## CSS Styling Pattern

```
All components use:
│
├── Tailwind CSS utility classes
│   └── e.g., "flex items-center gap-2 px-3 py-2"
│
├── CSS Variables (for theming)
│   └── e.g., "bg-[var(--sidebar-bg)]"
│
└── State-based classes
    └── Conditional classes for active, hover, disabled states
```

---

**Key Takeaway:** The app uses a clean modular architecture with:
- Sidebar for workspace navigation and page management
- Separate Settings system with its own layout
- Supabase auth with automatic token refresh
- Reusable UI components
- CSS variable-based theming
- Full keyboard accessibility throughout
