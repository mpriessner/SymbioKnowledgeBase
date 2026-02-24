"use client";

import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle, type KeyboardEvent } from "react";
import { Send, Square, Loader2 } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
  externalValue?: string;
  onExternalValueChange?: () => void;
}

export interface ChatInputRef {
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput(
  {
    onSend,
    onCancel,
    isLoading,
    disabled = false,
    placeholder = "Ask anything...",
    externalValue,
    onExternalValueChange,
  },
  ref
) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Expose focus method via ref
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
  }));

  // Handle external value changes (e.g., from suggestion cards)
  useEffect(() => {
    if (externalValue !== undefined && externalValue !== value) {
      setValue(externalValue);
      onExternalValueChange?.();
      // Focus the textarea after setting value
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [externalValue, onExternalValueChange]); // intentionally exclude value to avoid loops

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto";
    // Set new height (max 200px)
    const newHeight = Math.min(textarea.scrollHeight, 200);
    textarea.style.height = `${newHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Focus textarea on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (!trimmedValue || isLoading || disabled) return;

    onSend(trimmedValue);
    setValue("");
    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter to send, Shift+Enter for newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  const isDisabled = disabled || (!isLoading && !value.trim());

  return (
    <div className="border-t border-[var(--border-default)] p-3 bg-[var(--bg-primary)]">
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            rows={1}
            className="w-full resize-none rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            style={{ minHeight: "42px", maxHeight: "200px" }}
          />
        </div>

        {isLoading ? (
          <button
            onClick={handleCancel}
            className="flex-shrink-0 p-2.5 rounded-lg bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--danger)] focus:ring-offset-2"
            title="Stop generating"
          >
            <Square className="w-5 h-5 fill-current" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isDisabled}
            className="flex-shrink-0 p-2.5 rounded-lg bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)] focus:ring-offset-2"
            title="Send message"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-[var(--text-tertiary)]">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
});
