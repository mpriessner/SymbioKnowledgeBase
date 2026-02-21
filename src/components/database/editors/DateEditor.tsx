"use client";

import { useRef, useEffect } from "react";

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
        if (e.key === "Escape") onCancel();
      }}
      className="w-full rounded border border-[var(--accent-primary)] bg-[var(--bg-primary)]
                 px-2 py-1 text-sm outline-none"
    />
  );
}
