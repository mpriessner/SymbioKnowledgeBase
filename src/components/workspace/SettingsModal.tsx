"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@/components/providers/SupabaseProvider";
import { useTheme } from "@/hooks/useTheme";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsSection = "account-preferences" | "workspace-general";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("account-preferences");
  const [mounted, setMounted] = useState(false);
  const user = useUser();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !mounted) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm">
      <div className="relative w-full h-full max-w-5xl max-h-[90vh] m-4 bg-[var(--bg-primary)] rounded-lg shadow-2xl flex overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded p-2 text-[var(--text-secondary)]
            hover:bg-[var(--bg-secondary)] transition-colors"
          aria-label="Close settings"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Left sidebar navigation */}
        <aside className="w-60 flex-shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-secondary)] p-6 overflow-y-auto">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Settings</h2>

          {/* Account section */}
          <div className="mb-6">
            <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Account
            </h3>
            <button
              onClick={() => setActiveSection("account-preferences")}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                activeSection === "account-preferences"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              Preferences
            </button>
          </div>

          {/* Workspace section */}
          <div>
            <h3 className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-2">
              Workspace
            </h3>
            <button
              onClick={() => setActiveSection("workspace-general")}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                activeSection === "workspace-general"
                  ? "bg-[var(--bg-hover)] text-[var(--text-primary)] font-medium"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              }`}
            >
              General
            </button>
          </div>
        </aside>

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto p-8">
          {activeSection === "account-preferences" && (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
                Preferences
              </h1>

              {/* User info */}
              {user && (
                <div className="mb-8 pb-8 border-b border-[var(--border-default)]">
                  <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                    Account
                  </h2>
                  <div className="space-y-2">
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">Name:</span> {user.user_metadata?.name || "Not set"}
                    </p>
                    <p className="text-sm text-[var(--text-primary)]">
                      <span className="font-medium">Email:</span> {user.email || "Not set"}
                    </p>
                  </div>
                </div>
              )}

              {/* Theme selector */}
              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                  Appearance
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Choose how SymbioKnowledgeBase looks to you
                </p>

                <div className="grid grid-cols-3 gap-3 max-w-md">
                  {/* Light theme */}
                  <button
                    onClick={() => setTheme("light")}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      theme === "light"
                        ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                        : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    {theme === "light" && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="w-4 h-4 text-[var(--accent-primary)]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-md bg-white border border-gray-300 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-yellow-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Light</span>
                  </button>

                  {/* Dark theme */}
                  <button
                    onClick={() => setTheme("dark")}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      theme === "dark"
                        ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                        : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    {theme === "dark" && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="w-4 h-4 text-[var(--accent-primary)]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-md bg-gray-900 border border-gray-700 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-blue-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">Dark</span>
                  </button>

                  {/* System theme */}
                  <button
                    onClick={() => setTheme("system")}
                    className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                      theme === "system"
                        ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
                        : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
                    }`}
                  >
                    {theme === "system" && (
                      <div className="absolute top-2 right-2">
                        <svg
                          className="w-4 h-4 text-[var(--accent-primary)]"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                        </svg>
                      </div>
                    )}
                    <div className="w-12 h-12 rounded-md bg-gradient-to-br from-white to-gray-900 border border-gray-400 flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <span className="text-sm font-medium text-[var(--text-primary)]">System</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeSection === "workspace-general" && (
            <div>
              <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
                Workspace Settings
              </h1>

              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
                  General
                </h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-[var(--text-primary)] block mb-2">
                      Workspace Name
                    </label>
                    <div className="max-w-md">
                      <input
                        type="text"
                        value="SymbioKnowledgeBase"
                        disabled
                        className="w-full px-3 py-2 rounded-md border border-[var(--border-default)]
                          bg-[var(--bg-secondary)] text-[var(--text-primary)]
                          opacity-60 cursor-not-allowed text-sm"
                      />
                      <p className="text-xs text-[var(--text-secondary)] mt-2">
                        Workspace name customization coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
