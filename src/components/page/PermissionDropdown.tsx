"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type PermissionLevel = "FULL_ACCESS" | "CAN_EDIT" | "CAN_COMMENT" | "CAN_VIEW";

interface PermissionOption {
  value: PermissionLevel;
  label: string;
  description: string;
}

const permissionOptions: PermissionOption[] = [
  { value: "FULL_ACCESS", label: "Full access", description: "Edit, comment, and share" },
  { value: "CAN_EDIT", label: "Can edit", description: "Edit and comment" },
  { value: "CAN_COMMENT", label: "Can comment", description: "Comment only" },
  { value: "CAN_VIEW", label: "Can view", description: "View only" },
];

const permissionLabels: Record<PermissionLevel, string> = {
  FULL_ACCESS: "Full access",
  CAN_EDIT: "Can edit",
  CAN_COMMENT: "Can comment",
  CAN_VIEW: "Can view",
};

interface PermissionDropdownProps {
  value: PermissionLevel;
  onChange: (value: PermissionLevel) => void;
  onRemove?: () => void;
  disabled?: boolean;
}

export function PermissionDropdown({
  value,
  onChange,
  onRemove,
  disabled,
}: PermissionDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const handleSelect = useCallback(
    (perm: PermissionLevel) => {
      onChange(perm);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleRemove = useCallback(() => {
    onRemove?.();
    setIsOpen(false);
  }, [onRemove]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`
          text-xs px-2 py-1 rounded transition-colors
          ${disabled
            ? "text-[var(--text-tertiary)] cursor-default"
            : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
          }
        `}
      >
        {permissionLabels[value]}
        {!disabled && (
          <svg className="inline-block ml-1 w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg">
          {permissionOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[var(--text-primary)]">{opt.label}</div>
                <div className="text-xs text-[var(--text-tertiary)]">{opt.description}</div>
              </div>
              {value === opt.value && (
                <svg className="w-4 h-4 text-[var(--accent-primary)] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}

          {onRemove && (
            <>
              <div className="my-1 h-px bg-[var(--border-default)]" />
              <button
                onClick={handleRemove}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                </svg>
                <span className="text-sm">Remove</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
