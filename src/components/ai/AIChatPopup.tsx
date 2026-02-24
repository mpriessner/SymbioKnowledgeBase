"use client";

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { X, Sparkles, Trash2, PanelRight, MessageSquare, Check, FileText } from "lucide-react";
import { ChatMessages } from "./ChatMessages";
import { ChatInput } from "./ChatInput";
import { AIWelcomeScreen } from "./AIWelcomeScreen";
import { useAIChat } from "@/hooks/useAIChat";
import { usePage } from "@/hooks/usePages";
import type { PageContext } from "@/types/ai";

export type ChatMode = "floating" | "sidebar";

const CONTEXT_ENABLED_KEY = "symbio-ai-context-enabled";

interface AIChatPopupProps {
  isOpen: boolean;
  onClose: () => void;
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
}

/**
 * AI Chat Popup Window.
 *
 * Supports two display modes:
 * - Floating: Fixed position popup (400x500px) in bottom-right corner
 * - Sidebar: Docked to right edge, full viewport height (380px width)
 *
 * Wires together ChatMessages, ChatInput, and useAIChat hook.
 */
export function AIChatPopup({ isOpen, onClose, mode, onModeChange }: AIChatPopupProps) {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearHistory,
    cancelRequest,
    clearError,
  } = useAIChat();

  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [suggestionValue, setSuggestionValue] = useState<string | undefined>(undefined);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  
  // Context awareness state - initialize from localStorage
  const [contextEnabled, setContextEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(CONTEXT_ENABLED_KEY);
    return stored === null ? true : stored === "true";
  });
  const pathname = usePathname();
  
  // Extract page ID from pathname (e.g., /pages/abc123 → abc123)
  const pageId = useMemo(() => {
    const match = pathname?.match(/^\/pages\/([a-f0-9-]+)/i);
    return match?.[1] || null;
  }, [pathname]);
  
  // Fetch page data if we're on a page route
  const { data: pageData } = usePage(pageId || "", {
    enabled: !!pageId && contextEnabled,
  });
  
  // Build page context for AI
  const pageContext: PageContext | null = useMemo(() => {
    if (!contextEnabled || !pageId || !pageData?.data) return null;
    return {
      pageId: pageData.data.id,
      pageTitle: pageData.data.title,
      pathname: pathname || undefined,
    };
  }, [contextEnabled, pageId, pageData, pathname]);
  
  // Toggle context and persist preference
  const toggleContext = useCallback(() => {
    setContextEnabled((prev) => {
      const newValue = !prev;
      localStorage.setItem(CONTEXT_ENABLED_KEY, String(newValue));
      return newValue;
    });
  }, []);

  // Close mode menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setModeMenuOpen(false);
      }
    }
    if (modeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [modeMenuOpen]);

  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (modeMenuOpen) {
          setModeMenuOpen(false);
        } else {
          onClose();
        }
      }
    },
    [onClose, modeMenuOpen]
  );

  const handleSend = useCallback(
    (content: string) => {
      clearError();
      sendMessage(content, pageContext ? { context: pageContext } : undefined);
    },
    [sendMessage, clearError, pageContext]
  );

  const handleClearHistory = useCallback(() => {
    if (messages.length > 0) {
      clearHistory();
    }
  }, [messages.length, clearHistory]);

  const handleModeSelect = useCallback(
    (newMode: ChatMode) => {
      onModeChange(newMode);
      setModeMenuOpen(false);
    },
    [onModeChange]
  );

  const handleSelectSuggestion = useCallback((prompt: string) => {
    setSuggestionValue(prompt);
  }, []);

  const handleSuggestionValueConsumed = useCallback(() => {
    setSuggestionValue(undefined);
  }, []);

  if (!isOpen) return null;

  const isSidebar = mode === "sidebar";

  return (
    <div
      role="dialog"
      aria-label="AI Chat Assistant"
      aria-modal="false"
      onKeyDown={handleKeyDown}
      className={`
        fixed z-50
        flex flex-col
        border border-[var(--border-default)]
        bg-[var(--bg-primary)]
        shadow-2xl
        overflow-hidden
        transition-all duration-300 ease-in-out
        ${
          isSidebar
            ? "top-0 right-0 w-[380px] h-screen rounded-none border-r-0 border-t-0 border-b-0 border-l-[var(--border-default)]"
            : "bottom-20 right-6 w-[400px] h-[500px] rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        }
      `}
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
          {/* Mode toggle dropdown */}
          <div className="relative" ref={modeMenuRef}>
            <button
              onClick={() => setModeMenuOpen(!modeMenuOpen)}
              aria-label="Change display mode"
              title="Change display mode"
              aria-expanded={modeMenuOpen}
              aria-haspopup="true"
              className="
                rounded-md p-1.5
                text-[var(--text-secondary)]
                hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]
                transition-colors duration-150
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
              "
            >
              {isSidebar ? <PanelRight className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
            </button>
            {modeMenuOpen && (
              <div
                className="
                  absolute right-0 top-full mt-1
                  w-36
                  rounded-lg
                  border border-[var(--border-default)]
                  bg-[var(--bg-primary)]
                  shadow-lg
                  py-1
                  z-[60]
                "
              >
                <button
                  onClick={() => handleModeSelect("floating")}
                  className="
                    flex items-center justify-between w-full px-3 py-2
                    text-sm text-[var(--text-primary)]
                    hover:bg-[var(--bg-secondary)]
                    transition-colors duration-150
                  "
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span>Floating</span>
                  </div>
                  {mode === "floating" && <Check className="h-4 w-4 text-[var(--accent-primary)]" />}
                </button>
                <button
                  onClick={() => handleModeSelect("sidebar")}
                  className="
                    flex items-center justify-between w-full px-3 py-2
                    text-sm text-[var(--text-primary)]
                    hover:bg-[var(--bg-secondary)]
                    transition-colors duration-150
                  "
                >
                  <div className="flex items-center gap-2">
                    <PanelRight className="h-4 w-4" />
                    <span>Sidebar</span>
                  </div>
                  {mode === "sidebar" && <Check className="h-4 w-4 text-[var(--accent-primary)]" />}
                </button>
              </div>
            )}
          </div>
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

      {/* Message Area or Welcome Screen */}
      {messages.length === 0 ? (
        <AIWelcomeScreen onSelectSuggestion={handleSelectSuggestion} />
      ) : (
        <ChatMessages messages={messages} isLoading={isLoading} />
      )}

      {/* Context Indicator */}
      {pageId && (
        <div className="px-3 py-2 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className="h-3.5 w-3.5 flex-shrink-0 text-[var(--text-tertiary)]" />
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {contextEnabled && pageContext?.pageTitle
                  ? `Context: ${pageContext.pageTitle}`
                  : "Context available"}
              </span>
            </div>
            <button
              onClick={toggleContext}
              aria-label={contextEnabled ? "Disable page context" : "Enable page context"}
              title={contextEnabled ? "Click to disable page context" : "Click to enable page context"}
              className={`
                flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                transition-colors duration-150
                ${
                  contextEnabled
                    ? "bg-[var(--accent-primary)] bg-opacity-10 text-[var(--accent-primary)]"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                }
                hover:opacity-80
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]
              `}
            >
              {contextEnabled ? "ON" : "OFF"}
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <ChatInput
        onSend={handleSend}
        onCancel={cancelRequest}
        isLoading={isLoading}
        placeholder="Ask Symbio AI..."
        externalValue={suggestionValue}
        onExternalValueChange={handleSuggestionValueConsumed}
      />
    </div>
  );
}
