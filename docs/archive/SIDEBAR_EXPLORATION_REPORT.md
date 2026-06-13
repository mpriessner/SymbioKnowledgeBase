# SymbioKnowledgeBase Sidebar, Authentication & Settings - Comprehensive Exploration Report

**Date Generated:** 2026-02-25  
**Codebase:** SymbioKnowledgeBase  
**Focus Areas:** Sidebar Architecture, Authentication, Settings System, Workspace Management, UI Components

---

## 1. SIDEBAR COMPONENTS

### 1.1 Main Sidebar Component
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/workspace/Sidebar.tsx`

**Export:** Named export `Sidebar`

**Purpose:** Main workspace sidebar navigation component

**Key Structure:**
- **Header Section (Top):**
  - WorkspaceDropdown component (displays "SymbioKnowledgeBase" workspace name with dropdown menu)
  - Collapse/expand toggle button
  - New page/database create menu button (with inline dropdown)
  
- **Navigation Section:**
  - Search button (Cmd/Ctrl+K)
  - Home navigation button
  - Graph navigation button
  
- **Sidebar Content (Main):**
  - Recents section (displays up to 5 recently viewed pages)
  - Private pages section (SidebarTeamspaceSection)
  - Dynamic teamspace sections (one per teamspace with member counts)
  - Agent space section
  - Uses drag-and-drop tree rendering (DndSidebarTree)
  
- **Footer Section (Bottom):**
  - Settings button with gear icon (opens /settings)

**Key Props/Interfaces:** None (standalone functional component)

**Key Features:**
- Resizable sidebar (uses useSidebarWidth hook)
- Collapse/expand mode with narrow (w-10) toggle view
- Manages create menu with useRef for click-outside handling
- Uses usePageTree for page hierarchy
- Uses useTeamspaces for dynamic teamspace rendering
- Keyboard shortcut handling (Cmd+K for search)
- Theme CSS variables for styling

**State Management:**
- `showCreateMenu` - local state for create dropdown visibility
- Integration with hooks: useSidebarCollapse, useSidebarWidth, usePageTree, useRecentPages, useTeamspaces

**Important Notes:**
- This is the ACTIVE sidebar in the current codebase
- Does NOT use the older `/src/components/layout/Sidebar.tsx`
- Contains actual page tree rendering with drag-and-drop
- Workspace name and settings access are integrated

---

### 1.2 Legacy Sidebar Component (Not Active)
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/layout/Sidebar.tsx`

**Status:** This appears to be DEPRECATED or legacy. Has placeholder text "Page tree will be implemented in Epic 3."

**Key Differences from Active Sidebar:**
- Mobile-focused (fixed positioning, mobile overlay)
- No actual page tree implementation
- Simple navigation links (Graph, Settings)
- Not integrated with workspace system

---

### 1.3 Sidebar Teamspace Section Component
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/workspace/SidebarTeamspaceSection.tsx`

**Export:** Named export `SidebarTeamspaceSection`

**Props Interface:**
```typescript
interface SidebarTeamspaceSectionProps {
  sectionId: string;              // Unique identifier (can be "private", teamspace ID, or "agent")
  label: string;                   // Section title (e.g., "Private", "Teamspace Name", "Agent")
  icon: ReactNode;                 // SVG or React node for icon
  badge?: string;                  // Optional badge (e.g., member count)
  isLoading: boolean;               // Loading state
  error: Error | null;              // Error state
  tree: PageTreeNode[];             // Array of page tree nodes
}
```

**Key Features:**
- Collapsible section using useCollapsedState hook (persisted in localStorage)
- Rotation animation on collapse/expand arrow
- Loading skeleton display
- Error state handling
- Empty state message ("No pages yet")
- Renders DndSidebarTree when data is loaded
- Badge display on hover (member count for teamspaces)

---

### 1.4 Workspace Dropdown Component
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/workspace/WorkspaceDropdown.tsx`

**Export:** Named export `WorkspaceDropdown`

**Props Interface:**
```typescript
interface WorkspaceDropdownProps {
  onOpenSettings: () => void;  // Callback when settings clicked
}
```

**Key Structure:**
- Trigger button shows: "SymbioKnowledgeBase" with chevron icon
- Dropdown menu items:
  1. **Current workspace display** (with checkmark icon)
  2. **Settings** option (gear icon)
  3. **Log out** option (exit icon)

**Key Features:**
- Click-outside detection for closing dropdown
- Escape key handling for closing
- Chevron rotation animation when open
- Uses Supabase auth client: `supabase.auth.signOut()`
- Routes to `/login` after logout
- Full keyboard accessibility (role="menu", menuitem)
- Clean separation of concerns (Settings navigates via callback, logout is internal)

**Important Notes:**
- Settings are accessed via `onOpenSettings()` callback which navigates to `/settings`
- Logout functionality uses Supabase auth client
- Hardcoded workspace name "SymbioKnowledgeBase"

---

## 2. AUTHENTICATION & LOGIN SYSTEM

### 2.1 Auth Provider Architecture

**Primary Auth Provider:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/providers/SupabaseProvider.tsx`

**Context Type:**
```typescript
interface SupabaseContextType {
  supabase: SupabaseClient | null;
  user: User | null;
  isLoading: boolean;
}
```

**Key Features:**
- Uses Supabase JavaScript SDK for authentication
- Provides hooks: `useSupabaseClient()`, `useUser()`, `useAuthLoading()`
- Fallback `DEV_USER` for local development without Supabase
- Handles initial user session fetching
- Listens to auth state changes via `supabase.auth.onAuthStateChange()`
- **Proactive token refresh:** Refreshes session every 45 minutes (tokens expire in 1 hour)
- SSR-safe initialization with lazy state initialization

**User Type:** `User` from `@supabase/supabase-js`
- Includes: id, email, app_metadata, user_metadata, identities array
- user_metadata can contain: name, avatar_url, etc.

---

### 2.2 Authentication Wrapper
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/providers/AuthProvider.tsx`

**Purpose:** Simple wrapper that exposes SupabaseProvider

```typescript
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return <SupabaseProvider>{children}</SupabaseProvider>;
}
```

---

### 2.3 Legacy NextAuth Configuration (Still in codebase)
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/lib/auth.ts`

**Status:** LEGACY - NextAuth configuration exists but appears to be inactive
- Uses CredentialsProvider with email/password
- JWT session strategy
- Bcrypt password hashing
- Database: Prisma ORM for user lookup

**Important:** This appears to be superseded by Supabase auth but still present in codebase

---

### 2.4 Auth Pages

**Login Page:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/app/(auth)/login/page.tsx`

**Register Page:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/app/(auth)/register/page.tsx`

Both in `(auth)` route group (separate from workspace)

---

## 3. SETTINGS SYSTEM

### 3.1 Settings Architecture Overview

**Two Settings Implementations Exist:**

#### A. Settings Modal (Client-side, deprecated?)
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/workspace/SettingsModal.tsx`

**Status:** LIKELY DEPRECATED - Settings have moved to page-based routing

**Props:**
```typescript
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

**Sections (Modal-based):**
- Account → Preferences, My Profile, Security
- Workspace → General, Import & Export, API Keys, AI Configuration

**Note:** This modal is not currently rendered in the main Sidebar component

#### B. Settings Pages (Server-side, ACTIVE)
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/app/(workspace)/settings/`

**Structure:**
```
/settings/
  ├── layout.tsx          (SettingsSidebar + main content area)
  ├── page.tsx            (Redirects to /settings/profile)
  ├── profile/page.tsx    (AccountProfileSection)
  ├── preferences/page.tsx (PreferencesSection)
  ├── security/page.tsx   (AccountSecuritySection)
  ├── general/page.tsx    (Workspace settings stub)
  ├── people/page.tsx     (Team management)
  ├── notifications/page.tsx
  ├── api-keys/page.tsx
  └── ai-config/page.tsx
```

**Settings Layout:**
```
┌─────────────────────────────────┐
│     SettingsSidebar (220px)     │  Main Content
│                                 │  (flex-1, scrollable)
├─────────────────────────────────┤
│ Sections:                       │
│ Account:                        │
│  • Profile                      │
│  • Preferences                  │
│  • Notifications                │
│                                 │
│ Workspace:                      │
│  • General                      │
│  • People                       │
│  • AI Configuration             │
│                                 │
│ Security:                       │
│  • Security                     │
│  • API Keys                     │
└─────────────────────────────────┘
```

---

### 3.2 Settings Sidebar Component
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/settings/SettingsSidebar.tsx`

**Export:** Named export `SettingsSidebar`

**Key Structure:**
- Uses lucide-react icons (User, Settings, Bell, Building, Users, Shield, Key, BrainCircuit)
- Sections: Account, Workspace, Security
- Active state highlighting based on pathname matching
- Responsive design with truncation

**Section Items:**
```typescript
[
  {
    title: "Account",
    items: [
      { id: "profile", label: "Profile", href: "/settings/profile" },
      { id: "preferences", label: "Preferences", href: "/settings/preferences" },
      { id: "notifications", label: "Notifications", href: "/settings/notifications" },
    ]
  },
  {
    title: "Workspace",
    items: [
      { id: "general", label: "General", href: "/settings/general" },
      { id: "people", label: "People", href: "/settings/people" },
      { id: "ai-config", label: "AI Configuration", href: "/settings/ai-config" },
    ]
  },
  {
    title: "Security",
    items: [
      { id: "security", label: "Security", href: "/settings/security" },
      { id: "api-keys", label: "API Keys", href: "/settings/api-keys" },
    ]
  }
]
```

---

### 3.3 Settings Section Components

#### A. Account Profile Section
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/settings/AccountProfileSection.tsx`

**Features:**
- Avatar display with initials or uploaded image
- Avatar color generation from name/email hash
- Edit profile name field
- Copy User ID to clipboard
- Photo upload (stores as data URL)
- Save changes button with loading state
- API endpoint: `/api/settings/profile` (GET, PATCH)

**State:**
- profile data (id, name, email, avatarUrl)
- isSaving, isLoading, hasChanges, error states

#### B. Account Security Section
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/settings/AccountSecuritySection.tsx`

**Features:**
- Email display (read-only for now)
- Password change/add (opens ChangePasswordModal)
- Two-factor verification (coming soon - disabled)
- Passkeys (coming soon - disabled)
- Uses Supabase user identities to detect if user has password

**Connected Component:** ChangePasswordModal

#### C. Account Preferences Section (Partial Data)
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/settings/PreferencesSection.tsx`

**Features (from partial read):**
- Theme selection (Light, Dark, System) via useTheme hook
- Language selection (English, Deutsch, Español)
- Date format selection (MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD)
- Week start selection (Sunday or Monday)
- Custom select components with dropdown
- localStorage persistence

---

### 3.4 Settings Access Points

1. **Sidebar Footer Button:** "Settings" gear icon → navigates to `/settings`
2. **Workspace Dropdown Menu:** "Settings" option → navigates via `onOpenSettings()` callback → `/settings`
3. **Direct URL:** User can navigate to `/settings/profile` or any settings page directly

---

## 4. AUTHENTICATION FLOW

### 4.1 Current Authentication Process

1. **Login Page:** User enters email/password
2. **Supabase Auth:** `supabase.auth.signInWithPassword()` (or equivalent)
3. **SupabaseProvider:** Captures user session via `getUser()` and auth state listener
4. **Session Persistence:** Tokens stored in browser (Supabase handles this)
5. **Token Refresh:** Automatic refresh every 45 minutes

### 4.2 Logout Flow

1. **User clicks "Log out"** in WorkspaceDropdown
2. **handleLogout():**
   ```typescript
   const supabase = createClient();
   await supabase.auth.signOut();
   router.push("/login");
   router.refresh();
   ```
3. User session cleared, redirected to login page

---

## 5. UI COMPONENTS & PATTERNS

### 5.1 Dropdown Component
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/ui/Dropdown.tsx`

**Props:**
```typescript
interface DropdownProps {
  trigger: React.ReactNode;        // What to click to open
  items: DropdownItem[];            // Array of menu items
  onSelect: (value: string) => void;// Callback on selection
  align?: "left" | "right";         // Alignment (default: left)
}

interface DropdownItem {
  label: string;
  value: string;
  disabled?: boolean;
}
```

**Features:**
- Keyboard navigation (Arrow Up/Down, Enter, Escape)
- Click-outside to close
- Active index management
- Disabled item support
- Accessibility (aria-haspopup, aria-expanded, role="listbox")

---

### 5.2 Tooltip Component
**Path:** `/Users/mpriessner/windsurf_repos/SymbioKnowledgeBase/src/components/ui/Tooltip.tsx`

**Props:**
```typescript
interface TooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: "top" | "bottom" | "left" | "right"; // default: "top"
}
```

**Features:**
- Simple hover/focus trigger
- Positional placement
- Z-index: 50

---

### 5.3 Other UI Components in `/src/components/ui/`
- **Button.tsx** - Reusable button component
- **Input.tsx** - Text input
- **Modal.tsx** - Modal dialog
- **Toggle.tsx** - Toggle switch
- **ThemeToggle.tsx** - Theme switcher
- **Toast.tsx** - Toast notifications
- **Skeleton.tsx** - Loading skeleton

---

## 6. WORKSPACE SWITCHING & MULTI-TENANT ARCHITECTURE

### 6.1 Current State

**Workspace Switching:** NOT IMPLEMENTED

**Current Setup:**
- Single workspace name hardcoded: "SymbioKnowledgeBase"
- Teamspace support exists (not full workspace switching)
- WorkspaceDropdown shows current workspace with checkmark

**Teamspaces vs. Workspaces:**
- **Teamspaces:** Sub-groups within a workspace (like teams/departments)
- **Workspaces:** Top-level tenant containers (NOT yet implemented in UI)

### 6.2 Multi-Tenant Database Structure (Prisma)
- **Tenant model** exists in database
- **User.tenantId** field - users belong to tenants
- **Page.tenantId** field - pages belong to tenants
- **TeamspaceMember** model - users can be members of teamspaces

---

## 7. THEME & STYLING SYSTEM

### 7.1 Theme Implementation

**CSS Variables:** Used throughout (e.g., `var(--sidebar-bg)`, `var(--text-primary)`)

**Colors/Theme Variables:**
- `--sidebar-bg` - Sidebar background
- `--sidebar-text` - Sidebar primary text
- `--sidebar-text-secondary` - Sidebar secondary text
- `--sidebar-hover` - Sidebar hover state
- `--sidebar-active` - Active sidebar item
- `--bg-primary`, `--bg-secondary`, `--bg-tertiary` - Background colors
- `--text-primary`, `--text-secondary`, `--text-tertiary` - Text colors
- `--border-default` - Border color
- `--accent-primary` - Primary accent (buttons, links)
- `--overlay` - Overlay color
- `--danger` - Error/danger color

**Hook:** `useTheme()` - Provides theme state and `setTheme()` function
- Returns: `{ theme: "light" | "dark" | "system", setTheme: (theme) => void }`

---

## 8. KEY HOOKS & DEPENDENCIES

### 8.1 Custom Hooks Used

- **usePageTree()** - Fetches page hierarchy
- **useCreatePage()** - Creates new pages
- **useRecentPages()** - Gets recently viewed pages
- **useSidebarCollapse()** - Sidebar collapse state
- **useSidebarWidth()** - Sidebar resize logic
- **useTeamspaces()** - Fetches teamspaces
- **useIsMac()** - Detect macOS for keyboard shortcuts
- **useCollapsedState()** - localStorage-backed collapse state per section
- **useSidebarExpandState()** - Manages page tree expand/collapse state
- **useTheme()** - Theme management
- **useUser()** - Get current user (from SupabaseProvider)
- **useSupabaseClient()** - Get Supabase client instance
- **useAuthLoading()** - Auth loading state

---

## 9. CURRENT STATE SUMMARY

### Top of Sidebar (From Top to Bottom)
1. **WorkspaceDropdown** - Workspace name + dropdown menu
2. **Collapse/New buttons** - Collapse sidebar + create menu
3. **Search bar** - Cmd/Ctrl+K
4. **Home button** - Quick navigation
5. **Graph button** - Graph view navigation
6. **Recents section** - Last 5 viewed pages
7. **Private pages section** - User's private pages (collapsible)
8. **Teamspace sections** - One per teamspace (collapsible)
9. **Agent space section** - Agent knowledge base (collapsible)
10. **Settings button** - Bottom-left gear icon

### Settings Access
- **Current:** `/settings` page-based system with SettingsSidebar
- **Accessed via:** Sidebar footer button OR WorkspaceDropdown menu
- **Full Settings Path:** `/settings/{section}` (profile, preferences, security, etc.)

### User Profile Display
- **Avatar:** Generated from name/email hash or uploaded image
- **Location:** AccountProfileSection in settings/profile page
- **Features:** Color-coded initials, photo upload

### Existing Dropdowns/Popovers
1. **WorkspaceDropdown** - Custom built with click-outside & keyboard handling
2. **Create menu** - Inline dropdown in Sidebar header
3. **Dropdown component** - Reusable UI component (with keyboard nav)
4. **Theme selector** - Custom select in PreferencesSection

---

## 10. FUTURE CONSIDERATIONS FOR MIGRATION

### If migrating to sidebar-based user menu/profile:
1. **Consider:** Moving user avatar + name display to sidebar header OR as dropdown trigger
2. **Consider:** Workspace/tenant switching UI (not yet implemented)
3. **Consider:** Team/account switcher menu similar to Notion or Linear
4. **Keep:** Existing page tree and navigation structure
5. **Reusable:** Dropdown component with keyboard/accessibility support

### Current Architecture Strengths
- Clean separation: Workspace sidebar vs. Settings sidebar
- Modular components (SidebarTeamspaceSection, etc.)
- Good accessibility patterns
- Supabase auth integration with token refresh
- Theme system with CSS variables

---

## APPENDIX: File Paths Reference

```
Sidebar Components:
  src/components/workspace/Sidebar.tsx (ACTIVE)
  src/components/layout/Sidebar.tsx (LEGACY)
  src/components/workspace/SidebarTeamspaceSection.tsx
  src/components/workspace/WorkspaceDropdown.tsx
  src/components/workspace/SidebarTree.tsx
  src/components/workspace/SidebarTreeNode.tsx
  src/components/workspace/DndSidebarTree.tsx

Auth:
  src/components/providers/AuthProvider.tsx
  src/components/providers/SupabaseProvider.tsx
  src/lib/auth.ts (NextAuth legacy)
  src/app/(auth)/login/page.tsx
  src/app/(auth)/register/page.tsx

Settings:
  src/components/workspace/SettingsModal.tsx (DEPRECATED)
  src/components/settings/SettingsSidebar.tsx
  src/components/settings/AccountProfileSection.tsx
  src/components/settings/AccountSecuritySection.tsx
  src/components/settings/PreferencesSection.tsx
  src/components/settings/ChangePasswordModal.tsx
  src/components/settings/AIConfigSection.tsx
  src/app/(workspace)/settings/layout.tsx
  src/app/(workspace)/settings/page.tsx
  src/app/(workspace)/settings/profile/page.tsx
  src/app/(workspace)/settings/preferences/page.tsx
  src/app/(workspace)/settings/security/page.tsx
  src/app/(workspace)/settings/general/page.tsx
  src/app/(workspace)/settings/people/page.tsx
  src/app/(workspace)/settings/api-keys/page.tsx
  src/app/(workspace)/settings/ai-config/page.tsx
  src/app/(workspace)/settings/notifications/page.tsx

UI Components:
  src/components/ui/Dropdown.tsx
  src/components/ui/Tooltip.tsx
  src/components/ui/Button.tsx
  src/components/ui/Input.tsx
  src/components/ui/Modal.tsx
  src/components/ui/Toggle.tsx
  src/components/ui/ThemeToggle.tsx
  src/components/ui/Toast.tsx
  src/components/ui/Skeleton.tsx

Layout:
  src/app/(workspace)/layout.tsx
```

---

**End of Report**
