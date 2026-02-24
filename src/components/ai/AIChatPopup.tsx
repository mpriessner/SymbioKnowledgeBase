"use client";

import { useRef, useEffect, useCallback } from "react";
import { X, Send, Sparkles } from "lucide-react";

interface AIChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * AI Chat Popup Window.
 *
 * Floating popup with header, message area, and input field.
 * Story 2 will implement full chat functionality.
 */
export function AIChatPopup({ isOpen, onClose }: AIChatPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when popup opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure popup is rendered
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      ref={popupRef}
      role="dialog"
      aria-label="AI Chat Assistant"
      aria-modal="false"
      onKeyDown={handleKeyDown}
      className="
        fixed bottom-20 right-6 z-50
        flex flex-col
        w-[400px] h-[500px]
        rounded-xl
        border border-[var(--border-default)]
        bg-[var(--bg-primary)]
        shadow-2xl
        overflow-hidden
        animate-in fade-in slide-in-from-bottom-4 duration-200
      "
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-primary)] text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <span className="font-semibold text-[var(--text-primary)]">
            Symbio AI
          </span>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="
            rounded-md p-1.5
            text-[var(--text-secondary)]
            hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]
            transition-colors duration-150
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
          "
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Message Area (placeholder for Story 2) */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-secondary)] mb-3">
            <Sparkles className="h-6 w-6 text-[var(--accent-primary)]" />
          </div>
          <h3 className="text-lg font-medium text-[var(--text-primary)] mb-1">
            How can I help you?
          </h3>
          <p className="text-sm text-[var(--text-secondary)] max-w-[280px]">
            Ask me anything about your workspace, get help writing content, or analyze documents.
          </p>
        </div>
      </div>

      {/* Footer / Input Area */}
      <div className="px-4 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask Symbio AI..."
            disabled
            className="
              flex-1
              rounded-lg
              border border-[var(--border-default)]
              bg-[var(--bg-primary)]
              px-3 py-2
              text-sm text-[var(--text-primary)]
              placeholder:text-[var(--text-tertiary)]
              focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          />
          <button
            disabled
            aria-label="Send message"
            className="
              flex h-9 w-9 items-center justify-center
              rounded-lg
              bg-[var(--accent-primary)] text-white
              hover:bg-[var(--accent-primary-hover)]
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--text-tertiary)] text-center">
          Chat functionality coming in Story 2
        </p>
      </div>
    </div>
  );
}
