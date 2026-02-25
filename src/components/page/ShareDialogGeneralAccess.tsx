"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useUpdateGeneralAccess } from "@/hooks/usePageShares";

type AccessLevel = "INVITED_ONLY" | "ANYONE_WITH_LINK";

interface ShareDialogGeneralAccessProps {
  pageId: string;
  currentAccess: AccessLevel;
}

const accessOptions: { value: AccessLevel; label: string; description: string }[] = [
  {
    value: "INVITED_ONLY",
    label: "Only people invited",
    description: "Only people you've shared with can access",
  },
  {
    value: "ANYONE_WITH_LINK",
    label: "Anyone with the link",
    description: "Anyone in this workspace with the link can view",
  },
];

const accessLabels: Record<AccessLevel, string> = {
  INVITED_ONLY: "Only people invited",
  ANYONE_WITH_LINK: "Anyone with the link",
};

export function ShareDialogGeneralAccess({
  pageId,
  currentAccess,
}: ShareDialogGeneralAccessProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const updateAccess = useUpdateGeneralAccess(pageId);

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
    (value: AccessLevel) => {
      updateAccess.mutate(value);
      setIsOpen(false);
    },
    [updateAccess]
  );

  return (
    <div className="mb-4 pt-3 border-t border-[var(--border-default)]">
      <div className="flex items-center gap-3">
        {/* Lock icon */}
        <div className="w-7 h-7 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center flex-shrink-0">
          <svg
            className="w-3.5 h-3.5 text-[var(--text-tertiary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-sm text-[var(--text-primary)]">General access</div>
        </div>

        {/* Access dropdown */}
        <div ref={containerRef} className="relative">
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="text-xs px-2 py-1 rounded text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            {accessLabels[currentAccess]}
            <svg
              className="inline-block ml-1 w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] py-1 shadow-lg">
              {accessOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[var(--text-primary)]">{opt.label}</div>
                    <div className="text-xs text-[var(--text-tertiary)]">{opt.description}</div>
                  </div>
                  {currentAccess === opt.value && (
                    <svg
                      className="w-4 h-4 text-[var(--accent-primary)] mt-0.5 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
