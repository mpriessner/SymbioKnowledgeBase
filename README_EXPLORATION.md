# SymbioKnowledgeBase Sidebar & Settings Exploration - Index

## Overview

This directory contains comprehensive documentation of the SymbioKnowledgeBase sidebar, authentication, and settings system architecture. These documents provide detailed reference material for understanding, modifying, or extending the UI.

## Documents in This Exploration

### 1. EXPLORATION_SUMMARY.md (START HERE)
**Best for:** Quick overview, finding things, understanding what exists  
**Contains:**
- Key findings summary
- Component overview table
- Quick navigation guide ("Want to... go to...")
- File organization chart
- Hooks reference
- CSS variables list
- What's not implemented

**Read this first for:** 5-minute understanding of the entire system

---

### 2. SIDEBAR_QUICK_REFERENCE.md
**Best for:** Cheat sheet, visual quick lookups  
**Contains:**
- ASCII diagrams of sidebar layout
- Component location table
- Auth flow diagram
- Settings access points
- Settings page structure
- Theme variables overview
- Reusable components list

**Read this for:** Visual diagrams and quick lookups while coding

---

### 3. SIDEBAR_EXPLORATION_REPORT.md
**Best for:** Detailed reference, deep dives, complete understanding  
**Contains:**
- 10 sections covering every aspect
- Full file paths for every component
- Props interfaces for each component
- Code snippets and examples
- Feature lists
- Important notes and caveats
- Complete appendix with all file paths

**Read this for:** Complete reference when modifying components

---

### 4. ARCHITECTURE_DIAGRAM.md
**Best for:** Understanding how components interact  
**Contains:**
- Overall app structure diagrams
- Authentication layer visualization
- Sidebar component hierarchy (ASCII art)
- Settings system architecture
- Detailed component breakdowns
- Data flow diagrams
- User object structure
- Theme system overview

**Read this for:** Understanding relationships between components

---

## Quick Start Guide

### I need to understand the sidebar
1. Read: EXPLORATION_SUMMARY.md (Key Findings → Sidebar Structure)
2. View: SIDEBAR_QUICK_REFERENCE.md (Current Sidebar Layout)
3. Deep dive: SIDEBAR_EXPLORATION_REPORT.md (Section 1)

### I need to modify the sidebar
1. Check: SIDEBAR_EXPLORATION_REPORT.md (Section 1.1 - Main Sidebar Component)
2. Reference: ARCHITECTURE_DIAGRAM.md (Sidebar Component Hierarchy)
3. File: `src/components/workspace/Sidebar.tsx`

### I need to understand settings
1. Read: EXPLORATION_SUMMARY.md (Key Findings → Settings System)
2. View: SIDEBAR_QUICK_REFERENCE.md (Settings Pages Structure)
3. Deep dive: SIDEBAR_EXPLORATION_REPORT.md (Section 3)

### I need to modify settings pages
1. Check: EXPLORATION_SUMMARY.md (Component Overview → Settings Pages table)
2. Reference: SIDEBAR_EXPLORATION_REPORT.md (Section 3.2 or 3.3)
3. Files: `src/app/(workspace)/settings/{section}/page.tsx`

### I need to understand authentication
1. Read: EXPLORATION_SUMMARY.md (Key Findings → Authentication)
2. View: ARCHITECTURE_DIAGRAM.md (Authentication Layer)
3. Deep dive: SIDEBAR_EXPLORATION_REPORT.md (Section 2)

### I need to use the current user
1. Check: EXPLORATION_SUMMARY.md (Key Hooks Reference)
2. Reference: SIDEBAR_EXPLORATION_REPORT.md (Section 2.1)
3. Code: `const user = useUser();`

### I need to add a new settings section
1. Check: EXPLORATION_SUMMARY.md (Quick Navigation → "add a new settings section")
2. Reference: SIDEBAR_EXPLORATION_REPORT.md (Section 3.2)
3. Steps:
   - Create component in `src/components/settings/`
   - Create page at `src/app/(workspace)/settings/{name}/page.tsx`
   - Add link to `src/components/settings/SettingsSidebar.tsx`

---

## Document Selection Matrix

| Need | Best Document | Section |
|------|---|---|
| Overview | EXPLORATION_SUMMARY | All |
| Visual layout | SIDEBAR_QUICK_REFERENCE | Current Sidebar Layout |
| Component structure | ARCHITECTURE_DIAGRAM | Sidebar Component Hierarchy |
| Detailed reference | SIDEBAR_EXPLORATION_REPORT | Relevant section (1-10) |
| Hooks to use | EXPLORATION_SUMMARY | Key Hooks Reference |
| File locations | SIDEBAR_EXPLORATION_REPORT | Appendix |
| Auth details | SIDEBAR_EXPLORATION_REPORT | Section 2 |
| Settings details | SIDEBAR_EXPLORATION_REPORT | Section 3 |
| UI components | SIDEBAR_EXPLORATION_REPORT | Section 5 |

---

## Key Findings at a Glance

### Sidebar
- **Location:** `src/components/workspace/Sidebar.tsx` (active)
- **Structure:** Header (workspace dropdown + controls) → Navigation → Content (page tree) → Footer (settings)
- **State:** Uses multiple hooks (collapse, width, page tree, teamspaces, recent)

### Authentication
- **Provider:** Supabase (via SupabaseProvider context)
- **Current:** Email/password auth
- **Token refresh:** Every 45 minutes
- **Logout:** Via `supabase.auth.signOut()`

### Settings
- **System:** Page-based routing at `/settings/{section}`
- **Access:** Sidebar footer button OR WorkspaceDropdown menu
- **Architecture:** SettingsSidebar (left nav) + content pages (right)

### User Profile
- **Avatar:** Color-coded initials or uploaded image
- **Location:** `/settings/profile` page
- **Features:** Edit name, copy ID, upload photo

### What's Missing
- Workspace switching (UI only - DB support exists)
- Email management
- 2FA / Passkeys
- Team management UI
- Notifications system

---

## File Organization Reference

```
MAIN SIDEBAR COMPONENTS:
  src/components/workspace/Sidebar.tsx              # Main sidebar
  src/components/workspace/WorkspaceDropdown.tsx    # Workspace menu
  src/components/workspace/SidebarTeamspaceSection.tsx
  src/components/workspace/SidebarTree.tsx
  src/components/workspace/SidebarTreeNode.tsx
  src/components/workspace/DndSidebarTree.tsx

SETTINGS:
  src/components/settings/SettingsSidebar.tsx
  src/components/settings/AccountProfileSection.tsx
  src/components/settings/AccountSecuritySection.tsx
  src/components/settings/PreferencesSection.tsx
  src/app/(workspace)/settings/layout.tsx
  src/app/(workspace)/settings/{section}/page.tsx

AUTH:
  src/components/providers/SupabaseProvider.tsx
  src/components/providers/AuthProvider.tsx
  src/lib/auth.ts (legacy NextAuth)

UI COMPONENTS:
  src/components/ui/Dropdown.tsx
  src/components/ui/Tooltip.tsx
  src/components/ui/Button.tsx
  src/components/ui/Modal.tsx
  (others...)
```

---

## For Different User Types

### I'm a Designer
→ Start with: SIDEBAR_QUICK_REFERENCE.md → ARCHITECTURE_DIAGRAM.md

### I'm a Frontend Developer
→ Start with: EXPLORATION_SUMMARY.md → SIDEBAR_EXPLORATION_REPORT.md

### I'm a Fullstack Developer
→ Start with: EXPLORATION_SUMMARY.md → SIDEBAR_EXPLORATION_REPORT.md (all sections)

### I'm Planning a Feature
→ Start with: EXPLORATION_SUMMARY.md (What's NOT Implemented) → ARCHITECTURE_DIAGRAM.md

### I'm Debugging an Issue
→ Use: SIDEBAR_EXPLORATION_REPORT.md (find relevant component) + ARCHITECTURE_DIAGRAM.md

---

## Navigation by Section

### EXPLORATION_SUMMARY.md sections:
- What Was Explored
- Documents Generated
- Key Findings (6 subsections)
- Component Overview
- Technical Highlights
- What's NOT Implemented
- Quick Navigation ("Want to...")
- File Organization
- Key Hooks Reference
- CSS Variables
- Next Steps for Implementation
- Notes for Developers

### SIDEBAR_QUICK_REFERENCE.md sections:
- Current Sidebar Layout (diagram)
- Key Components at a Glance (table)
- Authentication Flow (diagram)
- Settings Access Points
- Settings Pages Structure
- Key CSS Variables
- Reusable Dropdown Component
- User Profile in Settings
- Authentication Methods
- What's NOT Implemented Yet
- Quick Hook Reference
- Important File Locations

### SIDEBAR_EXPLORATION_REPORT.md sections:
1. Sidebar Components
2. Authentication & Login System
3. Settings System
4. Authentication Flow
5. UI Components & Patterns
6. Workspace Switching & Multi-Tenant
7. Theme & Styling System
8. Key Hooks & Dependencies
9. Current State Summary
10. Future Considerations & Appendix

### ARCHITECTURE_DIAGRAM.md sections:
- Overall App Structure
- Authentication Layer
- Sidebar Component Hierarchy
- Settings System Architecture
- Settings Pages Detail
- Dropdown Component (Reusable UI)
- WorkspaceDropdown in Detail
- User Object Structure
- Theme CSS Variables System
- Data Flow: Page Tree
- CSS Styling Pattern

---

## Tips for Using These Documents

1. **Ctrl+F / Cmd+F** is your friend - use it to search for component names
2. **File paths** are absolute and can be opened directly
3. **Component props** are shown as TypeScript interfaces
4. **Diagrams** are ASCII-based and plain text readable
5. **Links** are generally cross-references within sections
6. **Code snippets** show actual patterns from the codebase

---

## Last Updated

**Generated:** 2026-02-25  
**Codebase:** SymbioKnowledgeBase  
**Status:** Complete exploration

---

## Questions Answered by These Documents

- Where is X component located?
- How do I modify the sidebar?
- How do I add a new settings page?
- How does authentication work?
- What's the user object structure?
- Which hooks should I use?
- How is theming implemented?
- What CSS variables are available?
- What's not implemented yet?
- How do components interact?
- What's the settings architecture?
- How do I access the current user?
- How do I log a user out?
- What keyboard shortcuts are available?
- Are there reusable dropdown components?

---

**Start with EXPLORATION_SUMMARY.md for a quick understanding, then dive into specific documents as needed.**
