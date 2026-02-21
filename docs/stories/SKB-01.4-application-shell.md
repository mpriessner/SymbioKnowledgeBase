# Story SKB-01.4: Application Shell and Routing Structure

**Epic:** Epic 1 - Project Foundation & Infrastructure
**Story ID:** SKB-01.4
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-01.1 (Next.js project must exist with Tailwind CSS and TypeScript)

---

## User Story

As a user, I want a clean application layout with sidebar navigation and proper routing, So that I can navigate between different sections of the knowledge base.

---

## Acceptance Criteria

- [ ] Root layout (`src/app/layout.tsx`) with HTML structure, font (Inter via `next/font`), metadata, theme class
- [ ] Auth route group `(auth)/login/page.tsx` and `(auth)/register/page.tsx` with placeholder content
- [ ] Workspace layout `(workspace)/layout.tsx` with sidebar + main content area
- [ ] Workspace routes: `pages/[id]/page.tsx`, `databases/[id]/page.tsx`, `graph/page.tsx`, `settings/page.tsx`
- [ ] Sidebar component with placeholder navigation (will be replaced by page tree in Epic 3)
- [ ] `src/lib/apiResponse.ts` with helper functions: `successResponse(data, meta?)`, `errorResponse(code, message, details?, status?)`, `listResponse(data, total, limit, offset)`
- [ ] `src/types/api.ts` with `ApiResponse<T>`, `ApiError`, `ApiListMeta` TypeScript interfaces
- [ ] Global CSS with Tailwind base, CSS custom properties for theme colors
- [ ] Responsive layout: sidebar collapses on narrow viewports

---

## Architecture Overview

```
src/app/
│
├── layout.tsx                 ← Root layout: <html>, <body>, font, metadata
├── page.tsx                   ← Landing page (redirect to workspace or login)
├── globals.css                ← Tailwind base + CSS custom properties for theming
│
├── (auth)/                    ← Auth route group (no layout nesting)
│   ├── login/
│   │   └── page.tsx           ← Login placeholder
│   └── register/
│       └── page.tsx           ← Register placeholder
│
└── (workspace)/               ← Workspace route group
    ├── layout.tsx             ← Sidebar + main content area
    ├── pages/
    │   └── [id]/
    │       └── page.tsx       ← Page editor (placeholder)
    ├── databases/
    │   └── [id]/
    │       └── page.tsx       ← Database table view (placeholder)
    ├── graph/
    │   └── page.tsx           ← Knowledge graph (placeholder)
    └── settings/
        └── page.tsx           ← Settings (placeholder)


Layout Nesting:
───────────────
Root Layout (font, metadata, global styles)
  │
  ├── (auth) pages → rendered directly in root layout
  │   No sidebar, centered content for auth forms
  │
  └── (workspace) layout → sidebar + main content
      │
      ├── Sidebar (left, 256px wide, collapsible)
      │   ├── Logo/brand
      │   ├── New Page button
      │   ├── Navigation links
      │   │   ├── Search (placeholder)
      │   │   ├── All Pages
      │   │   ├── Graph View
      │   │   └── Settings
      │   └── Page tree (placeholder — Epic 3)
      │
      └── Main Content (flex-1, right side)
          └── Route content (pages, databases, graph, settings)


Responsive Behavior:
────────────────────
Desktop (≥1024px):  Sidebar visible (w-64) + Main content
Tablet (≥768px):    Sidebar collapsed (w-0, toggle to open) + Main content
Mobile (<768px):    Sidebar overlay (full-width when open) + Main content


API Response Envelope:
──────────────────────
Every API endpoint uses these helpers:

  successResponse({ title: "My Page" })
  → { data: { title: "My Page" }, meta: { timestamp: "2026-02-21T..." } }

  errorResponse("NOT_FOUND", "Page not found", undefined, 404)
  → { error: { code: "NOT_FOUND", message: "Page not found" }, meta: { timestamp: "..." } }

  listResponse(pages, 142, 20, 0)
  → { data: [...], meta: { total: 142, limit: 20, offset: 0, timestamp: "..." } }
```

---

## Implementation Steps

### Step 1: Define TypeScript Interfaces for API Responses

Create the shared type definitions that all API routes and client-side code will use.

**File: `src/types/api.ts`**

```typescript
/**
 * Standard API response envelope for single-item responses.
 *
 * Usage:
 *   const response: ApiResponse<Page> = {
 *     data: { id: "...", title: "My Page" },
 *     meta: { timestamp: "2026-02-21T10:00:00.000Z" }
 *   };
 */
export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

/**
 * Standard API response envelope for list responses with pagination.
 *
 * Usage:
 *   const response: ApiListResponse<Page> = {
 *     data: [{ id: "...", title: "My Page" }],
 *     meta: { total: 142, limit: 20, offset: 0, timestamp: "..." }
 *   };
 */
export interface ApiListResponse<T> {
  data: T[];
  meta: ApiListMeta;
}

/**
 * Metadata included in every API response.
 */
export interface ApiMeta {
  timestamp: string; // ISO 8601
}

/**
 * Extended metadata for list endpoints with pagination info.
 */
export interface ApiListMeta extends ApiMeta {
  total: number;
  limit: number;
  offset: number;
}

/**
 * Standard error response envelope.
 *
 * Usage:
 *   const error: ApiErrorResponse = {
 *     error: {
 *       code: "VALIDATION_ERROR",
 *       message: "Title is required",
 *       details: [{ field: "title", message: "Must not be empty" }]
 *     },
 *     meta: { timestamp: "..." }
 *   };
 */
export interface ApiErrorResponse {
  error: ApiError;
  meta: ApiMeta;
}

/**
 * Error details within the error envelope.
 */
export interface ApiError {
  code: string; // UPPER_SNAKE_CASE error code
  message: string; // Human-readable error message
  details?: ApiValidationError[];
}

/**
 * Field-level validation error details.
 */
export interface ApiValidationError {
  field: string;
  message: string;
}
```

---

### Step 2: Create API Response Helper Functions

Create the helper functions that all API route handlers will use to produce consistent responses.

**File: `src/lib/apiResponse.ts`**

```typescript
import { NextResponse } from "next/server";

import type {
  ApiResponse,
  ApiListResponse,
  ApiErrorResponse,
  ApiValidationError,
} from "@/types/api";

/**
 * Create a success response for a single item.
 *
 * @param data - The response payload
 * @param meta - Optional additional metadata
 * @param status - HTTP status code (default: 200)
 * @returns NextResponse with standard envelope
 *
 * @example
 *   return successResponse({ id: "...", title: "My Page" });
 *   // → { data: { id: "...", title: "My Page" }, meta: { timestamp: "..." } }
 *
 * @example
 *   return successResponse(newPage, undefined, 201);
 *   // → HTTP 201 with { data: newPage, meta: { timestamp: "..." } }
 */
export function successResponse<T>(
  data: T,
  meta?: Record<string, unknown>,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
    },
    { status }
  );
}

/**
 * Create a success response for a list of items with pagination metadata.
 *
 * @param data - Array of items
 * @param total - Total number of items matching the query (not just this page)
 * @param limit - Maximum items per page
 * @param offset - Number of items skipped
 * @returns NextResponse with standard list envelope
 *
 * @example
 *   const pages = await prisma.page.findMany({ take: 20, skip: 0 });
 *   const total = await prisma.page.count();
 *   return listResponse(pages, total, 20, 0);
 *   // → { data: [...], meta: { total: 142, limit: 20, offset: 0, timestamp: "..." } }
 */
export function listResponse<T>(
  data: T[],
  total: number,
  limit: number,
  offset: number
): NextResponse<ApiListResponse<T>> {
  return NextResponse.json({
    data,
    meta: {
      total,
      limit,
      offset,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Create an error response with the standard error envelope.
 *
 * @param code - UPPER_SNAKE_CASE error code (e.g., "VALIDATION_ERROR", "NOT_FOUND")
 * @param message - Human-readable error message
 * @param details - Optional field-level validation errors
 * @param status - HTTP status code (default: 400)
 * @returns NextResponse with standard error envelope
 *
 * @example
 *   return errorResponse("NOT_FOUND", "Page not found", undefined, 404);
 *
 * @example
 *   return errorResponse("VALIDATION_ERROR", "Invalid input", [
 *     { field: "title", message: "Must not be empty" },
 *     { field: "email", message: "Invalid email format" },
 *   ], 400);
 */
export function errorResponse(
  code: string,
  message: string,
  details?: ApiValidationError[],
  status: number = 400
): NextResponse<ApiErrorResponse> {
  const body: ApiErrorResponse = {
    error: {
      code,
      message,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  if (details && details.length > 0) {
    body.error.details = details;
  }

  return NextResponse.json(body, { status });
}
```

---

### Step 3: Set Up Global CSS with Theme Variables

Configure the global stylesheet with Tailwind CSS base directives and CSS custom properties for light/dark theming.

**File: `src/app/globals.css`**

```css
@import "tailwindcss";

/*
 * SymbioKnowledgeBase — Global Styles
 *
 * Theme system uses CSS custom properties (variables) that change
 * based on the .light / .dark class on <html>. Components use these
 * variables via Tailwind's arbitrary value syntax: bg-[var(--bg-primary)]
 *
 * Color naming follows a semantic pattern:
 *   --bg-*       Background colors
 *   --text-*     Text colors
 *   --border-*   Border colors
 *   --accent-*   Accent/brand colors
 *   --sidebar-*  Sidebar-specific colors
 */

/* ── Light Theme (default) ────────────────────────────── */
:root {
  /* Backgrounds */
  --bg-primary: #ffffff;
  --bg-secondary: #f7f7f5;
  --bg-tertiary: #f0f0ee;
  --bg-hover: #ebebea;

  /* Text */
  --text-primary: #37352f;
  --text-secondary: #787774;
  --text-tertiary: #9b9a97;
  --text-inverse: #ffffff;

  /* Borders */
  --border-default: #e3e3e0;
  --border-strong: #cfcfcb;

  /* Accent (brand color) */
  --accent-primary: #2383e2;
  --accent-primary-hover: #1b6ec2;
  --accent-bg: #e8f0fe;

  /* Sidebar */
  --sidebar-bg: #f7f7f5;
  --sidebar-hover: #ebebea;
  --sidebar-active: #e3e3e0;
  --sidebar-text: #37352f;
  --sidebar-text-secondary: #787774;
  --sidebar-width: 256px;
}

/* ── Dark Theme ───────────────────────────────────────── */
.dark {
  /* Backgrounds */
  --bg-primary: #191919;
  --bg-secondary: #202020;
  --bg-tertiary: #2c2c2c;
  --bg-hover: #363636;

  /* Text */
  --text-primary: #ffffffcf;
  --text-secondary: #ffffff80;
  --text-tertiary: #ffffff4d;
  --text-inverse: #191919;

  /* Borders */
  --border-default: #ffffff14;
  --border-strong: #ffffff29;

  /* Accent */
  --accent-primary: #529cca;
  --accent-primary-hover: #6bb0d6;
  --accent-bg: #143a5c;

  /* Sidebar */
  --sidebar-bg: #202020;
  --sidebar-hover: #2c2c2c;
  --sidebar-active: #363636;
  --sidebar-text: #ffffffcf;
  --sidebar-text-secondary: #ffffff80;
}

/* ── Base Styles ──────────────────────────────────────── */
body {
  color: var(--text-primary);
  background: var(--bg-primary);
  font-family: var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── Selection ────────────────────────────────────────── */
::selection {
  background: var(--accent-bg);
  color: var(--text-primary);
}

/* ── Scrollbar (Webkit) ───────────────────────────────── */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-default);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--border-strong);
}

/* ── Focus Ring (Accessibility) ───────────────────────── */
*:focus-visible {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}
```

---

### Step 4: Create the Root Layout

The root layout wraps every page in the application. It sets up the HTML structure, font loading, metadata, and global providers.

**File: `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SymbioKnowledgeBase",
    template: "%s | SymbioKnowledgeBase",
  },
  description: "AI-agent-first knowledge management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Design decisions:**

- **`inter.variable`** — Loads the Inter font as a CSS variable (`--font-inter`) rather than applying it as a class. This allows the `globals.css` body rule to reference it, providing a single source of truth for the font.
- **`suppressHydrationWarning`** — Prevents hydration mismatch warnings when the theme class (`dark`) is set client-side from localStorage before React hydrates.
- **`title.template`** — Uses Next.js metadata template so child pages can set their title as `"My Page"` and it renders as `"My Page | SymbioKnowledgeBase"` in the browser tab.

---

### Step 5: Create Auth Route Pages

Create the login and register pages within the `(auth)` route group. These are placeholder pages that will be fully implemented in Epic 2 (SKB-02.1).

**File: `src/app/(auth)/login/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-[var(--text-primary)]">
          Log in to SymbioKnowledgeBase
        </h1>
        <p className="text-center text-sm text-[var(--text-secondary)]">
          Login form will be implemented in Epic 2 (SKB-02.1).
        </p>
      </div>
    </div>
  );
}
```

**File: `src/app/(auth)/register/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register",
};

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold text-[var(--text-primary)]">
          Create your account
        </h1>
        <p className="text-center text-sm text-[var(--text-secondary)]">
          Registration form will be implemented in Epic 2 (SKB-02.1).
        </p>
      </div>
    </div>
  );
}
```

---

### Step 6: Create the Sidebar Component

Create a placeholder sidebar with navigation links. This will be replaced by the full page tree component in Epic 3, but provides the navigation structure needed for routing.

**File: `src/components/layout/Sidebar.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/graph", label: "Graph View", icon: "🕸️" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
] as const;

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!isCollapsed && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setIsCollapsed(true)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 z-30 h-full
          bg-[var(--sidebar-bg)] border-r border-[var(--border-default)]
          transition-all duration-200 ease-in-out
          ${isCollapsed ? "w-0 overflow-hidden" : "w-[var(--sidebar-width)]"}
          lg:relative lg:z-auto
        `}
      >
        <div className="flex h-full w-[var(--sidebar-width)] flex-col">
          {/* Header */}
          <div className="flex h-12 items-center justify-between px-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-semibold text-[var(--sidebar-text)]"
            >
              <span className="text-lg">📚</span>
              <span>SymbioKB</span>
            </Link>
            <button
              onClick={() => setIsCollapsed(true)}
              className="rounded p-1 text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)] lg:hidden"
              aria-label="Close sidebar"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M12 4L4 12M4 4l8 8" />
              </svg>
            </button>
          </div>

          {/* New Page button */}
          <div className="px-3 py-1">
            <button
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm
                text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]"
              aria-label="Create new page"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M8 3v10M3 8h10" />
              </svg>
              <span>New Page</span>
            </button>
          </div>

          {/* Navigation */}
          <nav className="mt-2 flex-1 overflow-y-auto px-3" aria-label="Sidebar navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 rounded px-2 py-1.5 text-sm
                    transition-colors duration-100
                    ${
                      isActive
                        ? "bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-medium"
                        : "text-[var(--sidebar-text-secondary)] hover:bg-[var(--sidebar-hover)]"
                    }
                  `}
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* Separator */}
            <div className="my-3 border-t border-[var(--border-default)]" />

            {/* Page tree placeholder */}
            <div className="px-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--sidebar-text-secondary)]">
                Pages
              </p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Page tree will be implemented in Epic 3.
              </p>
            </div>
          </nav>

          {/* Footer */}
          <div className="border-t border-[var(--border-default)] px-3 py-2">
            <p className="text-xs text-[var(--sidebar-text-secondary)]">
              SymbioKnowledgeBase
            </p>
          </div>
        </div>
      </aside>

      {/* Mobile toggle button (visible when sidebar is collapsed on mobile) */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)}
          className="fixed left-3 top-3 z-20 rounded-lg border border-[var(--border-default)]
            bg-[var(--bg-primary)] p-2 shadow-sm lg:hidden"
          aria-label="Open sidebar"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 4h12M3 9h12M3 14h12" />
          </svg>
        </button>
      )}
    </>
  );
}
```

**Design decisions:**

- **`"use client"`** — Required because the sidebar uses `useState` for collapse state and `usePathname` for active link highlighting.
- **CSS custom properties** — All colors use CSS variables from `globals.css`, ensuring automatic theme switching when the `.dark` class is applied to `<html>`.
- **Responsive behavior:** On desktop (`lg:` breakpoint, 1024px+), the sidebar is always visible and positioned relative. On mobile/tablet, it overlays the content as a fixed panel with a backdrop.
- **Inline SVG icons** — Uses minimal SVG instead of an icon library to avoid adding dependencies. These will be replaced with a proper icon system in a later story if needed.
- **`aria-label` attributes** — All interactive elements have accessible labels for screen readers.

---

### Step 7: Create the Workspace Layout

The workspace layout wraps all authenticated pages and provides the sidebar + main content structure.

**File: `src/app/(workspace)/layout.tsx`**

```tsx
import Sidebar from "@/components/layout/Sidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
```

**Layout structure:**
- `flex h-screen overflow-hidden` — Full viewport height, prevents double scrollbars
- `Sidebar` — Fixed-width (256px) left panel
- `main flex-1 overflow-y-auto` — Takes remaining width, scrolls independently from sidebar

---

### Step 8: Create Workspace Route Pages

Create all workspace route pages with placeholder content. Each page shows its route name and a brief description of what will be implemented.

**File: `src/app/(workspace)/pages/[id]/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page",
};

interface PageViewProps {
  params: Promise<{ id: string }>;
}

export default async function PageView({ params }: PageViewProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Page Editor
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Page ID: <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs">{id}</code>
      </p>
      <p className="mt-4 text-[var(--text-secondary)]">
        The TipTap block editor will be implemented in Epic 4 (SKB-04.x).
      </p>
    </div>
  );
}
```

**File: `src/app/(workspace)/databases/[id]/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Database",
};

interface DatabaseViewProps {
  params: Promise<{ id: string }>;
}

export default async function DatabaseView({ params }: DatabaseViewProps) {
  const { id } = await params;

  return (
    <div className="mx-auto max-w-6xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Database Table View
      </h1>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">
        Database ID: <code className="rounded bg-[var(--bg-tertiary)] px-1.5 py-0.5 text-xs">{id}</code>
      </p>
      <p className="mt-4 text-[var(--text-secondary)]">
        The database table view will be implemented in Epic 7 (SKB-07.x).
      </p>
    </div>
  );
}
```

**File: `src/app/(workspace)/graph/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowledge Graph",
};

export default function GraphPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[var(--text-primary)]">
          Knowledge Graph
        </h1>
        <p className="mt-4 text-[var(--text-secondary)]">
          The interactive knowledge graph will be implemented in Epic 6 (SKB-06.x).
        </p>
        <p className="mt-2 text-sm text-[var(--text-tertiary)]">
          Uses react-force-graph for force-directed visualization of page connections.
        </p>
      </div>
    </div>
  );
}
```

**File: `src/app/(workspace)/settings/page.tsx`**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl px-8 py-12">
      <h1 className="text-3xl font-bold text-[var(--text-primary)]">
        Settings
      </h1>
      <p className="mt-4 text-[var(--text-secondary)]">
        Settings page sections:
      </p>
      <ul className="mt-4 list-inside list-disc space-y-2 text-[var(--text-secondary)]">
        <li>API Key Management (Epic 2 — SKB-02.3)</li>
        <li>User Management (Epic 2 — SKB-02.4)</li>
        <li>Theme Selection (Epic 8)</li>
      </ul>
    </div>
  );
}
```

---

### Step 9: Update the Landing Page

Update the root `page.tsx` to serve as a simple hub that links to the workspace and auth pages.

**File: `src/app/page.tsx`**

```tsx
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold tracking-tight text-[var(--text-primary)]">
        {APP_NAME}
      </h1>
      <p className="mt-4 text-lg text-[var(--text-secondary)]">
        AI-agent-first knowledge management platform
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/graph"
          className="rounded-lg bg-[var(--accent-primary)] px-6 py-2.5 text-sm font-medium
            text-[var(--text-inverse)] transition-colors hover:bg-[var(--accent-primary-hover)]"
        >
          Open Workspace
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
            px-6 py-2.5 text-sm font-medium text-[var(--text-primary)]
            transition-colors hover:bg-[var(--bg-hover)]"
        >
          Log In
        </Link>
      </div>
    </main>
  );
}
```

---

### Step 10: Verify All Routes Compile and Render

Run the build and manually verify each route.

```bash
# Build to verify all routes compile
npm run build

# Start dev server
npm run dev
```

**Routes to verify:**

| Route | Expected Content |
|-------|-----------------|
| `http://localhost:3000` | Landing page with "SymbioKnowledgeBase" heading |
| `http://localhost:3000/login` | Login placeholder card |
| `http://localhost:3000/register` | Register placeholder card |
| `http://localhost:3000/pages/test-id` | Page editor placeholder showing "test-id" |
| `http://localhost:3000/databases/test-id` | Database table view placeholder |
| `http://localhost:3000/graph` | Knowledge graph placeholder |
| `http://localhost:3000/settings` | Settings placeholder with feature list |

---

## Testing Requirements

### Test File: `tests/api/apiResponse.test.ts`

Unit tests for the API response helper functions.

```typescript
import { successResponse, listResponse, errorResponse } from "@/lib/apiResponse";

// Helper to extract JSON body from NextResponse
async function getBody<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

describe("successResponse", () => {
  test("wraps data in standard envelope with timestamp", async () => {
    const data = { id: "123", title: "Test Page" };
    const response = successResponse(data);

    expect(response.status).toBe(200);

    const body = await getBody(response);
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("meta");
    expect((body as Record<string, unknown>).data).toEqual(data);
    expect((body as Record<string, { timestamp: string }>).meta.timestamp).toBeTruthy();
  });

  test("supports custom status code", async () => {
    const response = successResponse({ id: "new" }, undefined, 201);
    expect(response.status).toBe(201);
  });

  test("includes additional meta fields", async () => {
    const response = successResponse(
      { id: "123" },
      { version: "1.0" }
    );

    const body = await getBody<{ meta: { version: string } }>(response);
    expect(body.meta.version).toBe("1.0");
  });

  test("timestamp is valid ISO 8601", async () => {
    const response = successResponse({});
    const body = await getBody<{ meta: { timestamp: string } }>(response);
    const date = new Date(body.meta.timestamp);
    expect(date.toISOString()).toBe(body.meta.timestamp);
  });
});

describe("listResponse", () => {
  test("wraps array data with pagination metadata", async () => {
    const data = [{ id: "1" }, { id: "2" }];
    const response = listResponse(data, 100, 20, 0);

    expect(response.status).toBe(200);

    const body = await getBody<{
      data: Array<{ id: string }>;
      meta: { total: number; limit: number; offset: number; timestamp: string };
    }>(response);
    expect(body.data).toEqual(data);
    expect(body.meta.total).toBe(100);
    expect(body.meta.limit).toBe(20);
    expect(body.meta.offset).toBe(0);
    expect(body.meta.timestamp).toBeTruthy();
  });

  test("handles empty data array", async () => {
    const response = listResponse([], 0, 20, 0);
    const body = await getBody<{ data: unknown[]; meta: { total: number } }>(response);
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });
});

describe("errorResponse", () => {
  test("creates error envelope with code and message", async () => {
    const response = errorResponse("NOT_FOUND", "Page not found", undefined, 404);

    expect(response.status).toBe(404);

    const body = await getBody<{
      error: { code: string; message: string; details?: unknown[] };
      meta: { timestamp: string };
    }>(response);
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("Page not found");
    expect(body.error.details).toBeUndefined();
    expect(body.meta.timestamp).toBeTruthy();
  });

  test("includes validation details when provided", async () => {
    const details = [
      { field: "title", message: "Must not be empty" },
      { field: "email", message: "Invalid email format" },
    ];
    const response = errorResponse("VALIDATION_ERROR", "Invalid input", details, 400);

    const body = await getBody<{
      error: { details: Array<{ field: string; message: string }> };
    }>(response);
    expect(body.error.details).toHaveLength(2);
    expect(body.error.details![0].field).toBe("title");
    expect(body.error.details![1].field).toBe("email");
  });

  test("defaults to status 400", async () => {
    const response = errorResponse("VALIDATION_ERROR", "Bad request");
    expect(response.status).toBe(400);
  });

  test("omits details when empty array provided", async () => {
    const response = errorResponse("ERROR", "Something failed", []);
    const body = await getBody<{ error: { details?: unknown[] } }>(response);
    expect(body.error.details).toBeUndefined();
  });
});
```

### Test File: `tests/e2e/navigation.spec.ts`

End-to-end tests for route navigation using Playwright.

```typescript
import { test, expect } from "@playwright/test";

test.describe("Application Shell Navigation", () => {
  test("landing page loads with correct heading", async ({ page }) => {
    await page.goto("http://localhost:3000");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("SymbioKnowledgeBase");
  });

  test("login page renders auth form placeholder", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Log in");
  });

  test("register page renders registration placeholder", async ({ page }) => {
    await page.goto("http://localhost:3000/register");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText("Create your account");
  });

  test("graph page renders within workspace layout with sidebar", async ({ page }) => {
    await page.goto("http://localhost:3000/graph");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Knowledge Graph");

    // Verify sidebar is present (on desktop viewport)
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("settings page renders within workspace layout", async ({ page }) => {
    await page.goto("http://localhost:3000/settings");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Settings");
  });

  test("page route displays page ID from URL", async ({ page }) => {
    await page.goto("http://localhost:3000/pages/test-page-123");
    await expect(page.getByText("test-page-123")).toBeVisible();
  });

  test("database route displays database ID from URL", async ({ page }) => {
    await page.goto("http://localhost:3000/databases/test-db-456");
    await expect(page.getByText("test-db-456")).toBeVisible();
  });

  test("sidebar navigation links work", async ({ page }) => {
    await page.goto("http://localhost:3000/graph");

    // Click Settings link in sidebar
    await page.getByRole("link", { name: /Settings/i }).click();
    await expect(page).toHaveURL(/\/settings/);
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Settings");
  });

  test("landing page 'Open Workspace' link navigates to graph", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.getByRole("link", { name: /Open Workspace/i }).click();
    await expect(page).toHaveURL(/\/graph/);
  });

  test("landing page 'Log In' link navigates to login", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.getByRole("link", { name: /Log In/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Responsive Sidebar", () => {
  test("sidebar is visible on desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("http://localhost:3000/graph");
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible();
  });

  test("sidebar toggle button appears on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("http://localhost:3000/graph");

    // Sidebar should start collapsed on mobile — look for the toggle button
    const toggleButton = page.getByLabel("Open sidebar");
    await expect(toggleButton).toBeVisible();
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/types/api.ts` |
| CREATE | `src/lib/apiResponse.ts` |
| CREATE | `src/components/layout/Sidebar.tsx` |
| CREATE | `src/app/(auth)/login/page.tsx` |
| CREATE | `src/app/(auth)/register/page.tsx` |
| CREATE | `src/app/(workspace)/layout.tsx` |
| CREATE | `src/app/(workspace)/pages/[id]/page.tsx` |
| CREATE | `src/app/(workspace)/databases/[id]/page.tsx` |
| CREATE | `src/app/(workspace)/graph/page.tsx` |
| CREATE | `src/app/(workspace)/settings/page.tsx` |
| MODIFY | `src/app/layout.tsx` (replace default with themed root layout) |
| MODIFY | `src/app/page.tsx` (add navigation links to workspace and login) |
| MODIFY | `src/app/globals.css` (add CSS custom properties for theming) |
| CREATE | `tests/api/apiResponse.test.ts` |
| CREATE | `tests/e2e/navigation.spec.ts` |

---

**Last Updated:** 2026-02-21
