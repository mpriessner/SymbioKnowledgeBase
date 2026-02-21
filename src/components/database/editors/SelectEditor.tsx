"use client";

import { useRef, useEffect } from "react";

interface SelectEditorProps {
  value: string;
  options: string[];
  onSave: (value: string) => void;
  onCancel: () => void;
}

export function SelectEditor({
  value,
  options,
  onSave,
  onCancel,
}: SelectEditorProps) {
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
        if (e.key === "Escape") onCancel();
      }}
      className="w-full rounded border border-[var(--accent-primary)] bg-[var(--bg-primary)]
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
