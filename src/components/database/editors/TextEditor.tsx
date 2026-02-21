"use client";

import { useState, useRef, useEffect } from "react";

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
        if (e.key === "Enter") onSave(text);
        if (e.key === "Escape") onCancel();
      }}
      className="w-full rounded border border-[var(--accent-primary)] bg-[var(--bg-primary)]
                 px-2 py-1 text-sm outline-none"
    />
  );
}
