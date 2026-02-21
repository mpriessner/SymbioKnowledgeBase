"use client";

interface CheckboxEditorProps {
  value: boolean;
  onSave: (value: boolean) => void;
}

export function CheckboxEditor({ value, onSave }: CheckboxEditorProps) {
  return (
    <button
      onClick={() => onSave(!value)}
      className="text-lg cursor-pointer"
      aria-label={value ? "Uncheck" : "Check"}
    >
      {value ? "\u2705" : "\u2B1C"}
    </button>
  );
}
