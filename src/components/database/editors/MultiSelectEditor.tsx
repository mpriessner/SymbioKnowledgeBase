"use client";

import { useState, useRef } from "react";

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
      className="rounded border border-[var(--accent-primary)] bg-[var(--bg-primary)] p-1"
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          handleSave();
        }
      }}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
        if (e.key === "Enter") handleSave();
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
                  ? "bg-[var(--accent-primary)] text-white"
                  : "bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
              }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
