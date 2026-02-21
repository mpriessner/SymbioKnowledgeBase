"use client";

import { forwardRef } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, className = "", id, ...props }, ref) {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="space-y-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--text-primary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full rounded-md border bg-[var(--bg-primary)] px-3 py-2 text-sm
            text-[var(--text-primary)] placeholder-[var(--text-tertiary)]
            transition-colors duration-150 outline-none
            focus:border-[var(--accent-primary)] focus:ring-1 focus:ring-[var(--accent-primary)]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? "border-[var(--danger)]" : "border-[var(--border-default)]"}
            ${className}
          `}
          aria-invalid={!!error}
          aria-describedby={
            error
              ? `${inputId}-error`
              : hint
                ? `${inputId}-hint`
                : undefined
          }
          {...props}
        />
        {error && (
          <p
            id={`${inputId}-error`}
            className="text-xs text-[var(--danger)]"
          >
            {error}
          </p>
        )}
        {hint && !error && (
          <p
            id={`${inputId}-hint`}
            className="text-xs text-[var(--text-secondary)]"
          >
            {hint}
          </p>
        )}
      </div>
    );
  }
);
