"use client";

import { useCallback } from "react";
import { X, Sparkles, Trash2 } from "lucide-react";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { useAIChat } from "@/hooks/useAIChat";

interface AIChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * AI Chat Popup Window.
 *
 * Floating popup with header, message area, and input field.
 * Wires together ChatMessages, ChatInput, and useAIChat hook.
 */
export function AIChatPopup({ isOpen, onClose }: AIChatPopupProps) {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    cancelRequest,
    clearError,
  } = useAIChat();

  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  const handleSend = useCallback(
    (content: string) => {
      clearError();
      sendMessage(content);
    },
    [sendMessage, clearError]
  );

  const handleClearHistory = useCallback(() => {
    if (messages.length > 0) {
      clearHistory();
    }
  }, [messages.length, clearHistory]);

  if (!isOpen) return null;

  return (
    <div
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
        <div className="flex items-center gap-1">
          {/* Clear history button */}
          <button
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            aria-label="Clear chat history"
            title="Clear chat history"
            className="
              rounded-md p-1.5
              text-[var(--text-secondary)]
              hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]
              transition-colors duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {/* Close button */}
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
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-4 py-2 bg-[var(--danger)] bg-opacity-10 border-b border-[var(--danger)] text-sm text-[var(--danger)]">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="text-[var(--danger)] hover:underline text-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Message Area */}
      <ChatMessages messages={messages} isLoading={isLoading} />

      {/* Input Area */}
      <ChatInput
        onSend={handleSend}
        onCancel={cancelRequest}
        isLoading={isLoading}
        placeholder="Ask Symbio AI..."
      />
    </div>
  );
}
