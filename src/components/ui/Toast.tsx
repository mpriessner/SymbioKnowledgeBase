"use client";

import type { Toast as ToastType, ToastVariant } from "@/hooks/useToast";

const variantStyles: Record<ToastVariant, string> = {
  success: "border-l-[var(--success)]",
  error: "border-l-[var(--danger)]",
  info: "border-l-[var(--accent-primary)]",
};

interface ToastContainerProps {
  toasts: ToastType[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-md border-l-4 px-4 py-3 shadow-lg
            bg-[var(--bg-primary)] border border-[var(--border-default)]
            ${variantStyles[toast.variant]}`}
        >
          <p className="text-sm text-[var(--text-primary)]">{toast.message}</p>
          <button
            onClick={() => onRemove(toast.id)}
            className="ml-auto text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Dismiss"
          >
            <svg
              className="h-4 w-4"
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
      ))}
    </div>
  );
}
