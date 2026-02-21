"use client";

import { useEffect, useRef, useCallback } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      modalRef.current?.focus();
    } else {
      previousFocusRef.current?.focus();
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-lg rounded-lg border border-[var(--border-default)]
                   bg-[var(--bg-primary)] shadow-xl"
      >
        {title && (
          <div className="flex items-center justify-between border-b border-[var(--border-default)] px-6 py-4">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        <div className="px-6 py-4">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-[var(--border-default)] px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
