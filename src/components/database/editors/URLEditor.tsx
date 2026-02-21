"use client";

import { useState, useRef, useEffect } from "react";

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
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") onCancel();
      }}
      placeholder="https://..."
      className={`w-full rounded border bg-[var(--bg-primary)] px-2 py-1 text-sm outline-none
        ${error ? "border-red-500" : "border-[var(--accent-primary)]"}`}
    />
  );
}
