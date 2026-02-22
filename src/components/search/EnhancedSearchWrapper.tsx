"use client";

import { useState, useCallback } from "react";
import { useHotkeys } from "@/hooks/useHotkeys";
import { EnhancedSearchDialog } from "./EnhancedSearchDialog";

/**
 * Wrapper for EnhancedSearchDialog that registers Cmd+Shift+F hotkey.
 */
export function EnhancedSearchWrapper() {
  const [isOpen, setIsOpen] = useState(false);

  const openDialog = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsOpen(false);
  }, []);

  useHotkeys([
    {
      key: "f",
      cmdOrCtrl: true,
      shift: true,
      handler: () => {
        if (isOpen) {
          closeDialog();
        } else {
          openDialog();
        }
      },
    },
  ]);

  return <EnhancedSearchDialog isOpen={isOpen} onClose={closeDialog} />;
}
