# Story SKB-09.2: Notion-Inspired UI Design System

**Epic:** Epic 9 - Theming & UI Polish
**Story ID:** SKB-09.2
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-09.1 (Theme system and CSS custom properties must be in place)

---

## User Story

As a user, I want a clean, professional UI, So that the application feels polished and consistent across all features.

---

## Acceptance Criteria

- [ ] Shared UI components in `src/components/ui/`:
  - `Button.tsx`: variants (primary, secondary, ghost, danger), sizes (sm, md, lg), loading state
  - `Input.tsx`: with label, error state, disabled state
  - `Modal.tsx`: overlay + centered panel, close on Escape/outside click, focus trap
  - `Dropdown.tsx`: trigger + floating menu, keyboard navigation
  - `Toast.tsx`: success/error/info notifications with auto-dismiss (5s)
  - `Skeleton.tsx`: loading placeholders with shimmer animation
  - `Tooltip.tsx`: hover tooltip with configurable placement
- [ ] Typography: Inter/system font, 14px body, 30px H1, 24px H2, 20px H3
- [ ] Consistent spacing: 4px grid (p-1 = 4px, p-2 = 8px, etc.)
- [ ] Color palette uses CSS custom properties from SKB-09.1 exclusively
- [ ] All components fully accessible: keyboard navigable, proper ARIA attributes
- [ ] No external component library — all primitives built from scratch
- [ ] TypeScript strict mode — all props fully typed

---

## Architecture Overview

```
Design System Component Library
────────────────────────────────

  src/components/ui/
  ├── Button.tsx         ← primary | secondary | ghost | danger
  ├── Input.tsx          ← labeled input with error state
  ├── Modal.tsx          ← overlay with focus trap
  ├── Dropdown.tsx       ← trigger + floating menu
  ├── Toast.tsx          ← notification variants
  ├── ToastContainer.tsx ← toast stack manager
  ├── Skeleton.tsx       ← loading placeholders
  └── Tooltip.tsx        ← hover tooltip

  src/hooks/
  └── useToast.ts        ← imperative toast API

Typography Scale (Notion-inspired)
───────────────────────────────────
  H1:   30px / 1.2 / bold    (page titles)
  H2:   24px / 1.3 / semibold
  H3:   20px / 1.4 / semibold
  Body: 14px / 1.6 / normal  (default)
  Small:12px / 1.5 / normal  (captions, hints)

Spacing (4px grid)
──────────────────
  1 = 4px    3 = 12px   6 = 24px   10 = 40px
  2 = 8px    4 = 16px   8 = 32px   12 = 48px
```

---

## Implementation Steps

### Step 1: Button Component

**File: `src/components/ui/Button.tsx`**

```typescript
'use client';

import { forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] active:opacity-90',
  secondary:
    'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-tertiary)]',
  ghost:
    'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)]',
  danger:
    'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] active:opacity-90',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs rounded',
  md: 'px-4 py-2 text-sm rounded-md',
  lg: 'px-6 py-2.5 text-base rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...props
    },
    ref
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`
          inline-flex items-center justify-center font-medium transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        {...props}
      >
        {loading && (
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);
```

---

### Step 2: Input Component

**File: `src/components/ui/Input.tsx`**

```typescript
'use client';

import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, className = '', id, ...props }, ref) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-text-primary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-md border bg-[var(--color-bg-primary)] px-3 py-2 text-sm
            text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)]
            transition-colors duration-150 outline-none
            focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-[var(--color-danger)]' : 'border-[var(--color-border)]'}
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--color-danger)]">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--color-text-secondary)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
```

---

### Step 3: Modal Component

**File: `src/components/ui/Modal.tsx`**

```typescript
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children, footer }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap and restore
  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  // Close on Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-[var(--color-overlay)] backdrop-blur-sm" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-lg rounded-lg border border-[var(--color-border)]
                   bg-[var(--color-bg-primary)] shadow-xl"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{title}</h2>
            <button onClick={onClose} className="rounded p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]" aria-label="Close">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        <div className="px-6 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 4: Toast System

**File: `src/hooks/useToast.ts`**

```typescript
'use client';

import { useState, useCallback } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = String(++toastId);
    setToasts((prev) => [...prev, { id, message, variant }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
```

**File: `src/components/ui/Toast.tsx`**

```typescript
'use client';

import type { Toast as ToastType, ToastVariant } from '@/hooks/useToast';

const variantStyles: Record<ToastVariant, string> = {
  success: 'border-l-[var(--color-success)] bg-green-50 dark:bg-green-900/20',
  error: 'border-l-[var(--color-danger)] bg-red-50 dark:bg-red-900/20',
  info: 'border-l-[var(--color-accent)] bg-blue-50 dark:bg-blue-900/20',
};

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-md border-l-4 px-4 py-3 shadow-lg
            bg-[var(--color-bg-primary)] border border-[var(--color-border)]
            ${variantStyles[toast.variant]}
            animate-in slide-in-from-right`}
        >
          <p className="text-sm text-[var(--color-text-primary)]">{toast.message}</p>
          <button onClick={() => onRemove(toast.id)} className="ml-auto text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" aria-label="Dismiss">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

### Step 5: Skeleton Component

**File: `src/components/ui/Skeleton.tsx`**

```typescript
interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

export function Skeleton({ className = '', width, height, rounded = 'md' }: SkeletonProps) {
  const roundedClass = { sm: 'rounded-sm', md: 'rounded-md', lg: 'rounded-lg', full: 'rounded-full' };

  return (
    <div
      className={`animate-pulse bg-[var(--color-bg-secondary)] ${roundedClass[rounded]} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}
```

---

### Step 6: Tooltip Component

**File: `src/components/ui/Tooltip.tsx`**

```typescript
'use client';

import { useState, useRef } from 'react';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, placement = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  const placementClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      ref={triggerRef}
      className="relative inline-block"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={`absolute z-50 whitespace-nowrap rounded-md bg-[var(--color-text-primary)]
            px-2.5 py-1.5 text-xs text-[var(--color-bg-primary)] shadow-lg
            pointer-events-none ${placementClasses[placement]}`}
        >
          {content}
        </div>
      )}
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/ui/Button.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('should render children', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should be disabled when loading', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should show spinner when loading', () => {
    const { container } = render(<Button loading>Save</Button>);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should call onClick handler', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).toHaveBeenCalled();
  });

  it('should not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Click</Button>);
    fireEvent.click(screen.getByText('Click'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

### Unit Tests: `src/__tests__/components/ui/Modal.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Modal } from '@/components/ui/Modal';

describe('Modal', () => {
  it('should render when open', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="Test">Content</Modal>);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<Modal isOpen={false} onClose={vi.fn()} title="Test">Content</Modal>);
    expect(screen.queryByText('Test')).not.toBeInTheDocument();
  });

  it('should call onClose on Escape', () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} title="Test">Content</Modal>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('should have proper ARIA attributes', () => {
    render(<Modal isOpen={true} onClose={vi.fn()} title="Test Modal">Content</Modal>);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-label', 'Test Modal');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/ui/Button.tsx` |
| CREATE | `src/components/ui/Input.tsx` |
| CREATE | `src/components/ui/Modal.tsx` |
| CREATE | `src/components/ui/Dropdown.tsx` |
| CREATE | `src/components/ui/Toast.tsx` |
| CREATE | `src/hooks/useToast.ts` |
| CREATE | `src/components/ui/Skeleton.tsx` |
| CREATE | `src/components/ui/Tooltip.tsx` |
| CREATE | `src/__tests__/components/ui/Button.test.tsx` |
| CREATE | `src/__tests__/components/ui/Modal.test.tsx` |

---

**Last Updated:** 2026-02-21
