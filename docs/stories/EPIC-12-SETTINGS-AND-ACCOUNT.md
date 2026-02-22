# Epic 12: Settings & Account Management

**Epic ID:** EPIC-12
**Created:** 2026-02-22
**Total Story Points:** 8
**Priority:** Medium
**Status:** Done

---

## Epic Overview

Epic 12 delivers a comprehensive settings modal accessible from the workspace dropdown and sidebar footer. The modal provides a dedicated interface for managing user account preferences (name, email, appearance theme) and workspace settings (workspace name). The settings modal uses a full-screen overlay with a left sidebar navigation pattern, matching Notion's settings interface design.

A critical aspect of this epic is the integration of NextAuth's `SessionProvider` to enable authentication-aware components. Initially attempted as a separate `AuthProvider` wrapper, the implementation encountered a Turbopack caching issue and was resolved by merging `SessionProvider` into the existing `QueryProvider` component.

The appearance settings section integrates with the theme system from Epic 9, providing visual theme cards (Light, Dark, System) with checkmarks indicating the active theme. The modal implements proper accessibility features including keyboard navigation (Escape to close), focus management, and body scroll prevention when open.

This epic covers FR55-56 (settings interface, account management).

---

## Business Value

- Settings modal provides a centralized location for all user and workspace configuration, improving discoverability
- Account information display helps users verify which account they're logged into, especially important for users with multiple accounts
- Appearance settings integration makes theme switching more discoverable than a standalone toggle button
- Full-screen modal design provides ample space for future settings sections without cluttering the main interface
- SessionProvider integration enables authentication-aware features throughout the application (user profile, permissions, etc.)
- Keyboard shortcuts (Escape to close) and body scroll prevention provide a polished user experience matching production-quality applications

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│  Settings Modal Architecture                                     │
│                                                                  │
│  <SettingsModal isOpen={true} onClose={fn}>                     │
│    │                                                             │
│    └─ createPortal(content, document.body) ◄─ Renders at root  │
│                                                                  │
│       ┌──────────────────────────────────────────────────────┐  │
│       │  Full-screen overlay (fixed inset-0, z-[100])         │  │
│       │                                                        │  │
│       │  ┌─────────────────┬──────────────────────────────┐  │  │
│       │  │ Left Sidebar    │  Main Content Area           │  │  │
│       │  │ (w-60)          │  (flex-1, scrollable)        │  │  │
│       │  │                 │                              │  │  │
│       │  │ ACCOUNT         │  Active Section Content:     │  │  │
│       │  │  • Preferences ◄┼─ • Account (name, email)     │  │  │
│       │  │                 │  • Appearance (theme cards)  │  │  │
│       │  │ WORKSPACE       │                              │  │  │
│       │  │  • General      │  OR                          │  │  │
│       │  │                 │                              │  │  │
│       │  │                 │  • Workspace (name)          │  │  │
│       │  └─────────────────┴──────────────────────────────┘  │  │
│       │                                                        │  │
│       │  [X] Close button (absolute top-right)                │  │
│       └──────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Session Provider Integration                                    │
│                                                                  │
│  /app/(workspace)/layout.tsx                                     │
│    └─ <QueryProvider>  ◄─ Single provider wrapping both         │
│         ├─ <SessionProvider> (NextAuth)                          │
│         │    └─ <QueryClientProvider> (React Query)              │
│         │         └─ {children}                                  │
│         │                                                         │
│         └─ Enables useSession() in all child components          │
│                                                                  │
│  <SettingsModal>                                                 │
│    const { data: session } = useSession();                       │
│    → Displays: session.user.name, session.user.email            │
│                                                                  │
│  <WorkspaceDropdown>                                             │
│    const { data: session } = useSession();                       │
│    → Could display user avatar (future enhancement)              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  State Management                                                │
│                                                                  │
│  SettingsModal State:                                            │
│    • activeSection: "account-preferences" | "workspace-general" │
│    • mounted: boolean (hydration-safe portal rendering)         │
│                                                                  │
│  Effects:                                                        │
│    • Escape key listener (closes modal)                         │
│    • Body scroll prevention (overflow: hidden)                  │
│    • Cleanup on unmount (restore scroll, remove listener)       │
│                                                                  │
│  Integration with useTheme:                                      │
│    • theme: "light" | "dark" | "system"                         │
│    • setTheme(newTheme) → updates theme, persists to storage    │
│    • Visual cards show checkmark on active theme                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stories Breakdown

### SKB-12.1: Settings Modal — 5 points, High

**Delivers:** `SettingsModal.tsx` component rendered via `createPortal(content, document.body)` for proper z-index layering. Full-screen modal (`fixed inset-0 z-[100]`) with backdrop blur. Left sidebar navigation (240px width) with two sections: ACCOUNT (Preferences) and WORKSPACE (General). Main content area switches between sections. Preferences section shows: (1) Account info card with name and email from `useSession()`; (2) Appearance section with three theme cards (Light, Dark, System) using `useTheme()` hook, active theme indicated by blue checkmark. Workspace section shows: (1) Workspace name input (disabled, placeholder for future feature). Close button (absolute top-right) and Escape key close modal. Body scroll prevented when open (`document.body.style.overflow = "hidden"`). Hydration-safe rendering via `mounted` state in `useEffect`.

**Depends on:** SKB-09.1 (useTheme hook), SKB-12.2 (SessionProvider integration)

---

### SKB-12.2: Session Provider Integration — 3 points, Medium

**Delivers:** NextAuth `SessionProvider` merged into `QueryProvider.tsx` (not separate file). `SessionProvider` wraps `QueryClientProvider` at root of workspace layout. Enables `useSession()` hook in `SettingsModal` and `WorkspaceDropdown` components. Session data provides: `session.user.name`, `session.user.email`, `session.user.image` (optional). Dev note: Originally attempted as separate `AuthProvider.tsx` but encountered Turbopack caching issue where import failed with "module not found" before file was created. Resolved by merging into existing `QueryProvider.tsx` which Turbopack already tracked.

**Depends on:** None (modifies existing QueryProvider)

---

## Test Coverage Requirements

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|-----------|-------------------|-----------|
| 12.1 | SettingsModal renders; left nav switches sections; theme cards display checkmarks; close on Escape; body scroll prevention | - | Open modal, switch sections, verify content; select theme, verify applies; press Escape, modal closes |
| 12.2 | SessionProvider wraps QueryClientProvider; useSession returns user data | SettingsModal displays user name and email from session | User info displayed in settings; multiple authenticated components access session |

---

## Implementation Order

```
12.2 → 12.1 (strictly sequential)

┌────────┐     ┌────────┐
│ 12.2   │────▶│ 12.1   │
│Session │     │Settings│
│Provider│     │ Modal  │
└────────┘     └────────┘
```

---

## Shared Constraints

- All UI components use Tailwind utility classes only — no custom CSS classes
- All modals must use `createPortal(content, document.body)` for proper z-index
- Body scroll must be prevented when modals are open
- All keyboard shortcuts (Escape) must be implemented via event listeners with cleanup
- All client-side only code must be hydration-safe (useEffect for mounted state)
- TypeScript strict mode — no `any` types allowed
- SessionProvider must wrap QueryClientProvider (NextAuth requirement)

---

## Files Created/Modified by This Epic

### New Files
- `src/components/workspace/SettingsModal.tsx` — settings modal component

### Modified Files
- `src/components/providers/QueryProvider.tsx` — merged SessionProvider
- `src/components/workspace/WorkspaceDropdown.tsx` — could use useSession for avatar (future)
- `src/app/(workspace)/layout.tsx` — already wrapped in QueryProvider (no changes needed)

---

**Last Updated:** 2026-02-22
