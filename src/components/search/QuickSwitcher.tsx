"use client";

import { useState, useCallback } from "react";
import { useHotkeys } from "@/hooks/useHotkeys";
import { SearchDialog } from "./SearchDialog";

/**
 * Quick Switcher — command palette overlay triggered by Cmd/Ctrl+K.
 *
 * Shows recent pages by default (before typing).
 * Typing triggers the same search functionality as SearchDialog.
 *
 * Registered at the workspace layout level to capture keyboard
 * shortcuts globally across all pages.
 */
export function QuickSwitcher() {
  const [isOpen, setIsOpen] = useState(false);

  const openSwitcher = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSwitcher = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Register global Cmd/Ctrl+K shortcut
  useHotkeys([
    {
      key: "k",
      cmdOrCtrl: true,
      handler: () => {
        if (isOpen) {
          closeSwitcher();
        } else {
          openSwitcher();
        }
      },
    },
  ]);

  return <SearchDialog isOpen={isOpen} onClose={closeSwitcher} />;
}
