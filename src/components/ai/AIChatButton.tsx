"use client";

import { useState, useEffect, useCallback } from "react";
import { Sparkles } from "lucide-react";
import { AIChatPopup } from "./AIChatPopup";

const STORAGE_KEY = "symbio-ai-chat-open";

/**
 * Floating AI Chat Button with popup.
 *
 * Renders a circular button in the bottom-right corner that toggles
 * the AI chat popup. Open/closed state persists in localStorage.
 */
export function AIChatButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") {
      setIsOpen(true);
    }
  }, []);

  // Persist state changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem(STORAGE_KEY, String(isOpen));
    }
  }, [isOpen, mounted]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Prevent hydration mismatch
  if (!mounted) return null;

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={toggleOpen}
        aria-label={isOpen ? "Close AI Chat" : "Open AI Chat"}
        aria-expanded={isOpen}
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
        <Sparkles className="h-5 w-5" />
      </button>

      {/* Chat Popup */}
      <AIChatPopup isOpen={isOpen} onClose={handleClose} />
    </>
  );
}
