"use client";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
}: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-5 w-9 flex-shrink-0 rounded-full
        transition-colors duration-200 ease-in-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]
        ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${checked ? "bg-[var(--accent-primary)]" : "bg-[var(--bg-tertiary)]"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-4 w-4 rounded-full
          bg-white shadow-sm ring-0
          transition-transform duration-200 ease-in-out
          ${checked ? "translate-x-4" : "translate-x-0.5"}
          mt-0.5
        `}
      />
    </button>
  );
}
