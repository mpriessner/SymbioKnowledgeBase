"use client";

import { useEffect, useCallback } from "react";

interface HotkeyConfig {
  /** The key to listen for (e.g., 'k', 'p', '/') */
  key: string;
  /** Whether Cmd (macOS) or Ctrl (Windows/Linux) must be held */
  cmdOrCtrl?: boolean;
  /** Whether Shift must be held */
  shift?: boolean;
  /** Whether Alt must be held */
  alt?: boolean;
  /** Callback to execute when the hotkey is triggered */
  handler: (event: KeyboardEvent) => void;
  /** Whether to prevent the default browser action */
  preventDefault?: boolean;
  /** Whether the hotkey is currently active */
  enabled?: boolean;
}

/**
 * Hook for registering global keyboard shortcuts.
 *
 * Supports modifier keys (Cmd/Ctrl, Shift, Alt) and
 * automatically handles platform differences (Cmd on macOS, Ctrl elsewhere).
 *
 * @param configs - Array of hotkey configurations
 */
export function useHotkeys(configs: HotkeyConfig[]): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      for (const config of configs) {
        if (config.enabled === false) continue;

        // Check key match (case-insensitive)
        if (event.key.toLowerCase() !== config.key.toLowerCase()) continue;

        // Check Cmd/Ctrl modifier
        if (config.cmdOrCtrl) {
          const isMac = navigator.platform.toUpperCase().includes("MAC");
          const cmdOrCtrlPressed = isMac ? event.metaKey : event.ctrlKey;
          if (!cmdOrCtrlPressed) continue;
        }

        // Check Shift modifier
        if (config.shift && !event.shiftKey) continue;
        if (!config.shift && event.shiftKey) continue;

        // Check Alt modifier
        if (config.alt && !event.altKey) continue;
        if (!config.alt && event.altKey) continue;

        // All checks passed — execute handler
        if (config.preventDefault !== false) {
          event.preventDefault();
          event.stopPropagation();
        }

        config.handler(event);
        return;
      }
    },
    [configs]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}
