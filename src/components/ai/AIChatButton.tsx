"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles, MessageCircle } from "lucide-react";
import { AIChatPopup, ChatMode } from "./AIChatPopup";
import { useHydrated } from "@/hooks/useHydrated";

const STORAGE_KEY = "symbio-ai-chat-open";
const MODE_STORAGE_KEY = "symbio-ai-chat-mode";
const CHAT_HISTORY_KEY = "skb-ai-chat-history";

/**
 * Check for messages in localStorage.
 * Defined as a standalone function to avoid hook ordering issues.
 */
function checkStorageForMessages(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(CHAT_HISTORY_KEY);
    if (stored) {
      const messages = JSON.parse(stored);
      return Array.isArray(messages) && messages.length > 0;
    }
  } catch {
    // Ignore errors
  }
  return false;
}

/**
 * Floating AI Chat Button with popup.
 *
 * Renders a circular button in the bottom-right corner that toggles
 * the AI chat popup. Open/closed state and display mode persist in localStorage.
 * Supports minimize behavior - when minimized, only the button is visible
 * with an optional indicator when chat has content.
 */
export function AIChatButton() {
  // Use hydration-safe hook instead of mounted state
  const hydrated = useHydrated();
  
  // Use lazy initialization for state that reads from localStorage
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });
  
  const [chatMode, setChatMode] = useState<ChatMode>(() => {
    if (typeof window === "undefined") return "floating";
    const stored = localStorage.getItem(MODE_STORAGE_KEY) as ChatMode;
    return stored === "floating" || stored === "sidebar" ? stored : "floating";
  });
  
  const [hasMessages, setHasMessages] = useState(() => checkStorageForMessages());

  // Re-check for messages function
  const refreshMessageIndicator = useCallback(() => {
    setHasMessages(checkStorageForMessages());
  }, []);

  // Listen for storage changes (to detect when messages are cleared/added)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === CHAT_HISTORY_KEY) {
        refreshMessageIndicator();
      }
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshMessageIndicator]);

  // Persist open state changes
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    }
  }, [isOpen, hydrated]);

  // Persist mode changes
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(MODE_STORAGE_KEY, chatMode);
    }
  }, [chatMode, hydrated]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
    // Re-check messages when opening
    refreshMessageIndicator();
  }, [refreshMessageIndicator]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Re-check messages to show indicator
    refreshMessageIndicator();
  }, [refreshMessageIndicator]);

  const handleMinimize = useCallback(() => {
    setIsOpen(false);
    // Re-check messages to show indicator
    refreshMessageIndicator();
  }, [refreshMessageIndicator]);

  const handleModeChange = useCallback((mode: ChatMode) => {
    setChatMode(mode);
  }, []);

  // Prevent hydration mismatch
  if (!hydrated) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleOpen}
        aria-label={isOpen ? "Close AI Chat" : "Open AI Chat"}
        aria-expanded={isOpen}
        title={isOpen ? "Close AI Chat" : "Open AI Chat"}
        className={`
          fixed bottom-6 right-6 z-40
          flex h-12 w-12 items-center justify-center
          rounded-full shadow-lg
          transition-all duration-200 ease-in-out
          ${
            isOpen
              ? "bg-[var(--accent-primary)] text-white scale-90"
              : "bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] hover:scale-105"
          }
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-2
        `}
      >
        {/* Show different icon if minimized with messages */}
        {!isOpen && hasMessages ? (
          <MessageCircle className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
        
        {/* Message indicator dot */}
        {!isOpen && hasMessages && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-[var(--accent-primary)] border-2 border-[var(--bg-primary)]" />
        )}
      </button>

      {/* Chat Popup */}
      <AIChatPopup
        isOpen={isOpen}
        onClose={handleClose}
        onMinimize={handleMinimize}
        mode={chatMode}
        onModeChange={handleModeChange}
      />
    </>
  );
}
