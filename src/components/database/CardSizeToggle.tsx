"use client";

type CardSize = "small" | "medium" | "large";

interface CardSizeToggleProps {
  size: CardSize;
  onChange: (size: CardSize) => void;
}

const SIZES: { label: string; value: CardSize }[] = [
  { label: "S", value: "small" },
  { label: "M", value: "medium" },
  { label: "L", value: "large" },
];

export function CardSizeToggle({ size, onChange }: CardSizeToggleProps) {
  return (
    <div className="inline-flex rounded border border-[var(--border-default)] overflow-hidden">
      {SIZES.map((s) => (
        <button
          key={s.value}
          onClick={() => onChange(s.value)}
          className={`px-2 py-1 text-xs font-medium transition-colors
            ${s.value === size ? "bg-[var(--accent-primary)] text-white" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}
            ${s.value !== "small" ? "border-l border-[var(--border-default)]" : ""}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
