# Story SKB-09.1: Light/Dark Mode with Theme Persistence

**Epic:** Epic 9 - Theming & UI Polish
**Story ID:** SKB-09.1
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-01.4 (Application shell and global CSS must exist)

---

## User Story

As a researcher, I want to switch between light and dark themes, So that I can use the application comfortably in different lighting conditions.

---

## Acceptance Criteria

- [ ] `ThemeToggle.tsx` component with sun/moon icon button, three states: light, dark, system
- [ ] CSS custom properties in `globals.css`: `--color-bg-primary`, `--color-bg-secondary`, `--color-text-primary`, `--color-text-secondary`, `--color-border`, `--color-accent`, etc.
- [ ] Light theme under `:root`, dark theme under `.dark` selector
- [ ] Tailwind dark mode: class strategy (`dark:` prefix)
- [ ] Theme stored in localStorage key `'symbio-theme'` with values `'light'`, `'dark'`, `'system'`
- [ ] Inline `<script>` in `layout.tsx` to apply theme class before React hydration (prevents flash of wrong theme / FOWT)
- [ ] System preference detection via `prefers-color-scheme` media query as default
- [ ] `useTheme` hook providing `theme` (stored), `resolvedTheme` (actual applied), and `setTheme`
- [ ] Clicking ThemeToggle cycles: light -> dark -> system -> light
- [ ] Warm gray palette for light mode, cool dark palette for dark mode (Notion-inspired)
- [ ] All color values reference CSS custom properties (no hardcoded hex in components)
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Theme System Architecture
─────────────────────────

  Page Load (before React hydration)
  ┌──────────────────────────────────────────────────────┐
  │  <head>                                                │
  │    <script>                                            │
  │      // Inline script (no deps, runs immediately)      │
  │      const theme = localStorage.getItem('symbio-theme')│
  │      const prefersDark = matchMedia(                   │
  │        '(prefers-color-scheme: dark)').matches          │
  │                                                        │
  │      if (theme === 'dark' || (!theme && prefersDark)   │
  │        || (theme === 'system' && prefersDark))          │
  │        document.documentElement.classList.add('dark')   │
  │      else                                              │
  │        document.documentElement.classList.remove('dark')│
  │    </script>                                           │
  │  </head>                                               │
  │                                                        │
  │  Result: <html class="dark"> or <html class="">       │
  │  → No flash of wrong theme (FOWT)                     │
  └──────────────────────────────────────────────────────┘

  CSS Custom Properties
  ┌──────────────────────────────────────────────────────┐
  │  globals.css                                           │
  │                                                        │
  │  :root {                                               │
  │    --color-bg-primary: #ffffff;                         │
  │    --color-bg-secondary: #f7f7f5;                      │
  │    --color-bg-tertiary: #f1f1ef;                       │
  │    --color-text-primary: #37352f;                       │
  │    --color-text-secondary: #787774;                     │
  │    --color-text-muted: #b4b4b0;                         │
  │    --color-border: #e9e9e7;                             │
  │    --color-accent: #2eaadc;                             │
  │    --color-accent-hover: #1a9bce;                       │
  │    --color-danger: #e03e3e;                             │
  │    --color-success: #0f7b0f;                            │
  │    --color-shadow: rgba(15, 15, 15, 0.05);             │
  │  }                                                     │
  │                                                        │
  │  .dark {                                               │
  │    --color-bg-primary: #191919;                         │
  │    --color-bg-secondary: #202020;                      │
  │    --color-bg-tertiary: #2a2a2a;                       │
  │    --color-text-primary: #ffffffcf;                     │
  │    --color-text-secondary: #ffffff71;                   │
  │    --color-text-muted: #ffffff3d;                       │
  │    --color-border: #ffffff18;                           │
  │    --color-accent: #529cca;                             │
  │    --color-accent-hover: #6aadda;                       │
  │    --color-danger: #ff6b6b;                             │
  │    --color-success: #4caf50;                            │
  │    --color-shadow: rgba(0, 0, 0, 0.25);                │
  │  }                                                     │
  └──────────────────────────────────────────────────────┘

  useTheme Hook
  ┌──────────────────────────────────────────────────────┐
  │  const { theme, resolvedTheme, setTheme } = useTheme()│
  │                                                        │
  │  theme: 'light' | 'dark' | 'system'                    │
  │  resolvedTheme: 'light' | 'dark'  (actual applied)    │
  │  setTheme: (t) => { save to localStorage, apply class}│
  └──────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define CSS Custom Properties

**File: `src/app/globals.css` (modification)**

```css
@import "tailwindcss";

/* ─────────────── Light Theme (default) ─────────────── */
:root {
  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f7f7f5;
  --color-bg-tertiary: #f1f1ef;
  --color-text-primary: #37352f;
  --color-text-secondary: #787774;
  --color-text-muted: #b4b4b0;
  --color-border: #e9e9e7;
  --color-border-hover: #d3d3d0;
  --color-accent: #2eaadc;
  --color-accent-hover: #1a9bce;
  --color-danger: #e03e3e;
  --color-danger-hover: #c93636;
  --color-success: #0f7b0f;
  --color-warning: #dfab01;
  --color-shadow: rgba(15, 15, 15, 0.05);
  --color-shadow-lg: rgba(15, 15, 15, 0.1);
  --color-overlay: rgba(0, 0, 0, 0.4);
}

/* ─────────────── Dark Theme ─────────────── */
.dark {
  --color-bg-primary: #191919;
  --color-bg-secondary: #202020;
  --color-bg-tertiary: #2a2a2a;
  --color-text-primary: #ffffffcf;
  --color-text-secondary: #ffffff71;
  --color-text-muted: #ffffff3d;
  --color-border: #ffffff18;
  --color-border-hover: #ffffff29;
  --color-accent: #529cca;
  --color-accent-hover: #6aadda;
  --color-danger: #ff6b6b;
  --color-danger-hover: #ff5252;
  --color-success: #4caf50;
  --color-warning: #ffc107;
  --color-shadow: rgba(0, 0, 0, 0.25);
  --color-shadow-lg: rgba(0, 0, 0, 0.5);
  --color-overlay: rgba(0, 0, 0, 0.6);
}

/* ─────────────── Base Styles ─────────────── */
body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
```

---

### Step 2: Create the Theme Script for FOWT Prevention

**File: `src/lib/theme/themeScript.ts`**

```typescript
/**
 * Inline script to apply the theme class before React hydration.
 * This prevents the flash of wrong theme (FOWT).
 *
 * This string is injected as a <script> tag in the root layout.
 * It must be self-contained (no imports, no framework dependencies).
 */
export const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('symbio-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var shouldBeDark = theme === 'dark' || (theme !== 'light' && prefersDark);

    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;
```

---

### Step 3: Create the useTheme Hook

**File: `src/hooks/useTheme.ts`**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'symbio-theme';

/**
 * Hook for managing the application theme.
 *
 * Provides:
 * - theme: The stored theme preference ('light', 'dark', 'system')
 * - resolvedTheme: The actual applied theme ('light' or 'dark')
 * - setTheme: Function to change the theme
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ['light', 'dark', 'system'].includes(stored)) {
      setThemeState(stored);
    }
  }, []);

  // Resolve theme and apply class
  useEffect(() => {
    const applyTheme = () => {
      const prefersDark = window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;

      let resolved: ResolvedTheme;
      if (theme === 'system') {
        resolved = prefersDark ? 'dark' : 'light';
      } else {
        resolved = theme;
      }

      setResolvedTheme(resolved);

      if (resolved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    applyTheme();

    // Listen for system preference changes (when theme is 'system')
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // Ignore storage errors
    }
  }, []);

  return { theme, resolvedTheme, setTheme };
}
```

---

### Step 4: Create the ThemeToggle Component

**File: `src/components/ui/ThemeToggle.tsx`**

```typescript
'use client';

import { useTheme } from '@/hooks/useTheme';

/**
 * Theme toggle button that cycles through light, dark, and system themes.
 * Displays a sun icon (light), moon icon (dark), or monitor icon (system).
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const next: Record<string, 'light' | 'dark' | 'system'> = {
      light: 'dark',
      dark: 'system',
      system: 'light',
    };
    setTheme(next[theme]);
  };

  return (
    <button
      onClick={cycleTheme}
      className="rounded-md p-2 text-[var(--color-text-secondary)]
                 hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]
                 transition-colors"
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      {theme === 'light' && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
      {theme === 'dark' && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
      {theme === 'system' && (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
    </button>
  );
}
```

---

### Step 5: Add Theme Script and Toggle to Root Layout

**File: `src/app/layout.tsx` (modification)**

```typescript
import { themeScript } from '@/lib/theme/themeScript';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/hooks/useTheme.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '@/hooks/useTheme';

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('should default to system theme', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('system');
  });

  it('should apply dark class when set to dark', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(result.current.resolvedTheme).toBe('dark');
  });

  it('should remove dark class when set to light', () => {
    document.documentElement.classList.add('dark');
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('light'));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(result.current.resolvedTheme).toBe('light');
  });

  it('should persist theme to localStorage', () => {
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('dark'));
    expect(localStorage.getItem('symbio-theme')).toBe('dark');
  });

  it('should read theme from localStorage on mount', () => {
    localStorage.setItem('symbio-theme', 'dark');
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
  });
});
```

### Unit Tests: `src/__tests__/components/ui/ThemeToggle.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

vi.mock('@/hooks/useTheme', () => ({
  useTheme: vi.fn().mockReturnValue({
    theme: 'light',
    resolvedTheme: 'light',
    setTheme: vi.fn(),
  }),
}));

import { useTheme } from '@/hooks/useTheme';
const mockUseTheme = vi.mocked(useTheme);

describe('ThemeToggle', () => {
  it('should render toggle button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should cycle from light to dark on click', () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({ theme: 'light', resolvedTheme: 'light', setTheme });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('should cycle from dark to system on click', () => {
    const setTheme = vi.fn();
    mockUseTheme.mockReturnValue({ theme: 'dark', resolvedTheme: 'dark', setTheme });

    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button'));
    expect(setTheme).toHaveBeenCalledWith('system');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `src/app/globals.css` (add CSS custom properties for light/dark themes) |
| CREATE | `src/lib/theme/themeScript.ts` |
| CREATE | `src/hooks/useTheme.ts` |
| CREATE | `src/components/ui/ThemeToggle.tsx` |
| MODIFY | `src/app/layout.tsx` (add inline theme script, add ThemeToggle) |
| CREATE | `src/__tests__/hooks/useTheme.test.ts` |
| CREATE | `src/__tests__/components/ui/ThemeToggle.test.tsx` |

---

**Last Updated:** 2026-02-21
