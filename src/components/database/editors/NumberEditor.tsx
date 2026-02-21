"use client";

import { useState, useRef, useEffect } from "react";

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
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") onCancel();
      }}
      className={`w-full rounded border bg-[var(--bg-primary)] px-2 py-1 text-sm outline-none
        ${error ? "border-red-500" : "border-[var(--accent-primary)]"}`}
    />
  );
}
