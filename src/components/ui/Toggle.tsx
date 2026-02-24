"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  "aria-label"?: string;
}

/**
 * A toggle switch component styled as a modern switch.
 * Dark theme compatible using CSS variables.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  id,
  "aria-label": ariaLabel,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full 
        border-2 border-transparent transition-colors duration-200 ease-in-out
        focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2 
        focus:ring-offset-[var(--bg-primary)]
        ${disabled ? "cursor-not-allowed opacity-50" : ""}
        ${checked ? "bg-[var(--accent-primary)]" : "bg-[var(--bg-tertiary)]"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-5 w-5 transform rounded-full 
          bg-white shadow ring-0 transition duration-200 ease-in-out
          ${checked ? "translate-x-5" : "translate-x-0"}
        `}
      />
    </button>
  );
}
