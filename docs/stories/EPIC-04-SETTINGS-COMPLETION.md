# Epic 4: Settings Page Completion

**Status:** Partially Complete  
**Priority:** Medium  
**Dependencies:** Stories 12 & 13 complete ✅

## Overview
Complete the settings page with proper navigation sidebar and additional sections.

## Current State
- ✅ Story 12: Account Profile Section (implemented)
- ✅ Story 13: Account Security Section (implemented)
- ❌ Story 14: Settings Layout & Navigation (pending)

---

## Story 14: Settings Page Layout & Navigation

**Points:** 5  
**Files to create:**
- `src/components/settings/SettingsSidebar.tsx`
- `src/components/settings/SettingsSection.tsx`
- `src/app/(workspace)/settings/[section]/page.tsx`

**Files to modify:**
- `src/app/(workspace)/settings/page.tsx`
- `src/app/(workspace)/settings/layout.tsx` (create)

### Requirements

1. **Settings Sidebar Navigation**
   ```typescript
   const settingsSections = [
     {
       title: "Account",
       items: [
         { id: "profile", label: "Profile", icon: User },
         { id: "preferences", label: "Preferences", icon: Settings },
         { id: "notifications", label: "Notifications", icon: Bell },
       ]
     },
     {
       title: "Workspace", 
       items: [
         { id: "general", label: "General", icon: Building },
         { id: "people", label: "People", icon: Users },
         { id: "integrations", label: "Integrations", icon: Plug },
       ]
     },
     {
       title: "Security",
       items: [
         { id: "security", label: "Security", icon: Shield },
         { id: "api-keys", label: "API Keys", icon: Key },
       ]
     }
   ];
   ```

2. **Layout Structure**
   ```
   ┌─────────────────────────────────────────────┐
   │ Settings                                    │
   ├──────────────┬──────────────────────────────┤
   │ Sidebar      │ Content Area                 │
   │              │                              │
   │ Account      │ [Selected Section Content]   │
   │  • Profile   │                              │
   │  • Prefs     │                              │
   │              │                              │
   │ Workspace    │                              │
   │  • General   │                              │
   │  • People    │                              │
   │              │                              │
   │ Security     │                              │
   │  • Security  │                              │
   │  • API Keys  │                              │
   └──────────────┴──────────────────────────────┘
   ```

3. **URL Routing**
   - `/settings` → redirects to `/settings/profile`
   - `/settings/profile` → Profile section
   - `/settings/security` → Security section
   - `/settings/api-keys` → API Keys section
   - etc.

4. **Sidebar Styling**
   - Fixed width: 200px
   - Section headers (Account, Workspace, Security)
   - Items with icons
   - Active item highlighted
   - Hover states

5. **Responsive Behavior**
   - On mobile: sidebar becomes top tabs or hamburger menu
   - Content takes full width on mobile

### Acceptance Criteria
- [ ] Sidebar shows all settings sections
- [ ] Clicking item navigates and updates URL
- [ ] Active section highlighted in sidebar
- [ ] Content area shows selected section
- [ ] Works on mobile (responsive)

---

## Story 15: Preferences Section (Optional)

**Points:** 3  
**Files to create:**
- `src/components/settings/PreferencesSection.tsx`

### Requirements

1. **Theme Setting**
   - Light / Dark / System toggle
   - Preview of selected theme

2. **Language Setting**
   - Dropdown with language options
   - Currently: English only (placeholder for future)

3. **Date Format**
   - Dropdown: MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD

4. **Start of Week**
   - Dropdown: Sunday, Monday

### Acceptance Criteria
- [ ] Theme toggle works
- [ ] Settings persist to localStorage/database
- [ ] Changes apply immediately

---

## Story 16: Notifications Section (Optional)

**Points:** 3  
**Files to create:**
- `src/components/settings/NotificationsSection.tsx`

### Requirements

1. **Email Notifications**
   - Toggle: Document updates
   - Toggle: Comments and mentions
   - Toggle: Weekly digest

2. **In-App Notifications**
   - Toggle: Show notifications
   - Toggle: Play sounds

### Acceptance Criteria
- [ ] Toggles save to database
- [ ] Settings affect actual notification behavior

---

## Implementation Order

1. **Story 14** (Layout & Navigation) - Foundation for all settings
2. **Story 15** (Preferences) - Quick addition
3. **Story 16** (Notifications) - If notifications feature exists

## Design Reference

Follow Notion's settings layout:
- Clean left sidebar with grouped sections
- Large, readable content area
- Subtle separators between setting groups
- Consistent icon usage (lucide-react)
