# Story SKB-08.3: Inline Property Editing

**Epic:** Epic 8 - Database (Table View)
**Story ID:** SKB-08.3
**Story Points:** 5 | **Priority:** High | **Status:** Draft
**Depends On:** SKB-08.2 (Table view must render cells to make them editable)

---

## User Story

As a researcher, I want to edit properties directly in the table, So that I can quickly update data without navigating to each row's page.

---

## Acceptance Criteria

- [ ] `PropertyEditor.tsx` with type-specific editor components for each property type
- [ ] `TEXT`/`TITLE`: inline text input
- [ ] `NUMBER`: number input with numeric validation
- [ ] `SELECT`: dropdown with options from database schema
- [ ] `MULTI_SELECT`: tag input allowing add/remove from schema options
- [ ] `DATE`: native date picker
- [ ] `CHECKBOX`: toggle switch (click to toggle, no edit mode needed)
- [ ] `URL`: text input with URL validation
- [ ] Click cell to enter edit mode
- [ ] Blur (click outside) or Enter to save
- [ ] Escape to cancel and revert
- [ ] Optimistic update via TanStack Query (instant UI feedback, rollback on error)
- [ ] Zod validation runs client-side before submission for instant feedback
- [ ] Error state: red border on invalid input
- [ ] TypeScript strict mode — no `any` types

---

## Architecture Overview

```
Inline Editing Flow
───────────────────

  1. User clicks a cell in the table
     │
     ▼
  ┌──────────────────────────────────────────┐
  │  PropertyCell → switches to edit mode     │
  │                                            │
  │  Before click: "Done" (read-only pill)    │
  │  After click:  [Done ▼] (dropdown open)   │
  └──────────────────────┬───────────────────┘
                         │
  2. User changes value (selects new option)
     │
     ▼
  3. On blur / Enter:
     │
     ├── Client-side Zod validation
     │   ├── Valid → Optimistic update → PUT API
     │   └── Invalid → Show error, don't save
     │
     ▼
  4. Optimistic update:
     │
     ├── Immediately update UI (TanStack Query cache)
     ├── PUT /api/databases/:id/rows/:rowId
     │   ├── Success → done
     │   └── Failure → rollback UI, show error toast
     └── Return to read mode

Editor Components by Type
─────────────────────────

  ┌──────────────────────────────────────────────┐
  │  PropertyEditor.tsx (dispatcher)              │
  │                                               │
  │  switch (column.type) {                       │
  │    case 'TEXT':        → TextEditor           │
  │    case 'TITLE':       → TextEditor           │
  │    case 'NUMBER':      → NumberEditor         │
  │    case 'SELECT':      → SelectEditor         │
  │    case 'MULTI_SELECT':→ MultiSelectEditor    │
  │    case 'DATE':        → DateEditor           │
  │    case 'CHECKBOX':    → CheckboxEditor       │
  │    case 'URL':         → URLEditor            │
  │  }                                            │
  └──────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Individual Editor Components

**File: `src/components/database/editors/TextEditor.tsx`**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface TextEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function TextEditor({ value, onSave, onCancel }: TextEditorProps) {
  const [text, setText] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onSave(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onSave(text);
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-primary)]
                 px-2 py-1 text-sm outline-none"
    />
  );
}
```

**File: `src/components/database/editors/NumberEditor.tsx`**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface NumberEditorProps {
  value: number;
  onSave: (value: number) => void;
  onCancel: () => void;
}

export function NumberEditor({ value, onSave, onCancel }: NumberEditorProps) {
  const [num, setNum] = useState(String(value));
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    const parsed = Number(num);
    if (isNaN(parsed)) {
      setError(true);
      return;
    }
    onSave(parsed);
  };

  return (
    <input
      ref={inputRef}
      type="number"
      value={num}
      onChange={(e) => {
        setNum(e.target.value);
        setError(false);
      }}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onCancel();
      }}
      className={`w-full rounded border bg-[var(--color-bg-primary)] px-2 py-1 text-sm outline-none
        ${error ? 'border-red-500' : 'border-[var(--color-accent)]'}`}
    />
  );
}
```

**File: `src/components/database/editors/SelectEditor.tsx`**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface SelectEditorProps {
  value: string;
  options: string[];
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function SelectEditor({ value, options, onSave, onCancel }: SelectEditorProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <select
      ref={selectRef}
      value={value}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-primary)]
                 px-2 py-1 text-sm outline-none"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}
```

**File: `src/components/database/editors/MultiSelectEditor.tsx`**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface MultiSelectEditorProps {
  value: string[];
  options: string[];
  onSave: (value: string[]) => void;
  onCancel: () => void;
}

export function MultiSelectEditor({
  value,
  options,
  onSave,
  onCancel,
}: MultiSelectEditorProps) {
  const [selected, setSelected] = useState<string[]>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleOption = (opt: string) => {
    setSelected((prev) =>
      prev.includes(opt) ? prev.filter((v) => v !== opt) : [...prev, opt]
    );
  };

  const handleSave = () => onSave(selected);

  return (
    <div
      ref={containerRef}
      className="rounded border border-[var(--color-accent)] bg-[var(--color-bg-primary)] p-1"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          handleSave();
        }
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
        if (e.key === 'Enter') handleSave();
      }}
    >
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => toggleOption(opt)}
            className={`rounded-full px-2 py-0.5 text-xs font-medium transition-colors
              ${
                selected.includes(opt)
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
              }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
```

**File: `src/components/database/editors/DateEditor.tsx`**

```typescript
'use client';

import { useRef, useEffect } from 'react';

interface DateEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function DateEditor({ value, onSave, onCancel }: DateEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.showPicker?.();
  }, []);

  return (
    <input
      ref={inputRef}
      type="date"
      value={value}
      onChange={(e) => onSave(e.target.value)}
      onBlur={onCancel}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onCancel();
      }}
      className="w-full rounded border border-[var(--color-accent)] bg-[var(--color-bg-primary)]
                 px-2 py-1 text-sm outline-none"
    />
  );
}
```

**File: `src/components/database/editors/CheckboxEditor.tsx`**

```typescript
'use client';

interface CheckboxEditorProps {
  value: boolean;
  onSave: (value: boolean) => void;
}

export function CheckboxEditor({ value, onSave }: CheckboxEditorProps) {
  return (
    <button
      onClick={() => onSave(!value)}
      className="text-lg cursor-pointer"
      aria-label={value ? 'Uncheck' : 'Check'}
    >
      {value ? '\u2705' : '\u2B1C'}
    </button>
  );
}
```

**File: `src/components/database/editors/URLEditor.tsx`**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface URLEditorProps {
  value: string;
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function URLEditor({ value, onSave, onCancel }: URLEditorProps) {
  const [url, setUrl] = useState(value);
  const [error, setError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSave = () => {
    try {
      new URL(url);
      onSave(url);
    } catch {
      setError(true);
    }
  };

  return (
    <input
      ref={inputRef}
      type="url"
      value={url}
      onChange={(e) => {
        setUrl(e.target.value);
        setError(false);
      }}
      onBlur={handleSave}
      onKeyDown={(e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') onCancel();
      }}
      placeholder="https://..."
      className={`w-full rounded border bg-[var(--color-bg-primary)] px-2 py-1 text-sm outline-none
        ${error ? 'border-red-500' : 'border-[var(--color-accent)]'}`}
    />
  );
}
```

---

### Step 2: Create the PropertyEditor Dispatcher

**File: `src/components/database/PropertyEditor.tsx`**

```typescript
'use client';

import type { Column, PropertyValue } from '@/types/database';
import { TextEditor } from './editors/TextEditor';
import { NumberEditor } from './editors/NumberEditor';
import { SelectEditor } from './editors/SelectEditor';
import { MultiSelectEditor } from './editors/MultiSelectEditor';
import { DateEditor } from './editors/DateEditor';
import { CheckboxEditor } from './editors/CheckboxEditor';
import { URLEditor } from './editors/URLEditor';

interface PropertyEditorProps {
  column: Column;
  value: PropertyValue | undefined;
  onSave: (value: PropertyValue) => void;
  onCancel: () => void;
}

export function PropertyEditor({ column, value, onSave, onCancel }: PropertyEditorProps) {
  switch (column.type) {
    case 'TITLE':
    case 'TEXT':
      return (
        <TextEditor
          value={value?.type === column.type ? value.value : ''}
          onSave={(v) => onSave({ type: column.type, value: v })}
          onCancel={onCancel}
        />
      );

    case 'NUMBER':
      return (
        <NumberEditor
          value={value?.type === 'NUMBER' ? value.value : 0}
          onSave={(v) => onSave({ type: 'NUMBER', value: v })}
          onCancel={onCancel}
        />
      );

    case 'SELECT':
      return (
        <SelectEditor
          value={value?.type === 'SELECT' ? value.value : ''}
          options={column.options || []}
          onSave={(v) => onSave({ type: 'SELECT', value: v })}
          onCancel={onCancel}
        />
      );

    case 'MULTI_SELECT':
      return (
        <MultiSelectEditor
          value={value?.type === 'MULTI_SELECT' ? value.value : []}
          options={column.options || []}
          onSave={(v) => onSave({ type: 'MULTI_SELECT', value: v })}
          onCancel={onCancel}
        />
      );

    case 'DATE':
      return (
        <DateEditor
          value={value?.type === 'DATE' ? value.value : ''}
          onSave={(v) => onSave({ type: 'DATE', value: v })}
          onCancel={onCancel}
        />
      );

    case 'CHECKBOX':
      return (
        <CheckboxEditor
          value={value?.type === 'CHECKBOX' ? value.value : false}
          onSave={(v) => onSave({ type: 'CHECKBOX', value: v })}
        />
      );

    case 'URL':
      return (
        <URLEditor
          value={value?.type === 'URL' ? value.value : ''}
          onSave={(v) => onSave({ type: 'URL', value: v })}
          onCancel={onCancel}
        />
      );

    default:
      return null;
  }
}
```

---

## Testing Requirements

### Unit Tests: `src/__tests__/components/database/editors/TextEditor.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TextEditor } from '@/components/database/editors/TextEditor';

describe('TextEditor', () => {
  it('should render with initial value', () => {
    render(<TextEditor value="hello" onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
  });

  it('should call onSave on Enter', () => {
    const onSave = vi.fn();
    render(<TextEditor value="hello" onSave={onSave} onCancel={vi.fn()} />);
    const input = screen.getByDisplayValue('hello');
    fireEvent.change(input, { target: { value: 'world' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('world');
  });

  it('should call onCancel on Escape', () => {
    const onCancel = vi.fn();
    render(<TextEditor value="hello" onSave={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByDisplayValue('hello'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('should call onSave on blur', () => {
    const onSave = vi.fn();
    render(<TextEditor value="hello" onSave={onSave} onCancel={vi.fn()} />);
    fireEvent.blur(screen.getByDisplayValue('hello'));
    expect(onSave).toHaveBeenCalledWith('hello');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/components/database/editors/TextEditor.tsx` |
| CREATE | `src/components/database/editors/NumberEditor.tsx` |
| CREATE | `src/components/database/editors/SelectEditor.tsx` |
| CREATE | `src/components/database/editors/MultiSelectEditor.tsx` |
| CREATE | `src/components/database/editors/DateEditor.tsx` |
| CREATE | `src/components/database/editors/CheckboxEditor.tsx` |
| CREATE | `src/components/database/editors/URLEditor.tsx` |
| CREATE | `src/components/database/PropertyEditor.tsx` |
| MODIFY | `src/components/database/TableView.tsx` (integrate PropertyEditor for click-to-edit) |
| CREATE | `src/__tests__/components/database/editors/TextEditor.test.tsx` |

---

**Last Updated:** 2026-02-21
