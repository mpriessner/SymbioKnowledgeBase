"use client";

import { useEffect, useRef, useCallback, useState, useLayoutEffect } from "react";
import { Pencil, Copy, Link, Star, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useDeletePage } from "@/hooks/usePages";
import { useRouter, usePathname } from "next/navigation";

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface PageContextMenuProps {
  pageId: string;
  pageTitle: string;
  position: ContextMenuPosition;
  onClose: () => void;
  onRename?: () => void;
  onDuplicate?: () => void;
}

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: string;
  danger?: boolean;
  divider?: boolean;
}

const menuItems: MenuItem[] = [
  { icon: Pencil, label: "Rename", action: "rename" },
  { icon: Copy, label: "Duplicate", action: "duplicate" },
  { icon: Link, label: "Copy link", action: "copyLink" },
  { icon: Star, label: "Add to favorites", action: "favorite", divider: true },
  { icon: Trash2, label: "Delete", action: "delete", danger: true },
];

// Calculate adjusted position to keep menu in viewport
function getAdjustedPosition(
  position: ContextMenuPosition,
  menuWidth: number,
  menuHeight: number
): ContextMenuPosition {
  const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  let adjustedX = position.x;
  let adjustedY = position.y;

  // Check right edge
  if (position.x + menuWidth > viewportWidth - 8) {
    adjustedX = viewportWidth - menuWidth - 8;
  }

  // Check bottom edge
  if (position.y + menuHeight > viewportHeight - 8) {
    adjustedY = viewportHeight - menuHeight - 8;
  }

  // Ensure minimum position
  adjustedX = Math.max(8, adjustedX);
  adjustedY = Math.max(8, adjustedY);

  return { x: adjustedX, y: adjustedY };
}

export function PageContextMenu({
  pageId,
  pageTitle,
  position,
  onClose,
  onRename,
  onDuplicate,
}: PageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [menuDimensions, setMenuDimensions] = useState({ width: 180, height: 200 });
  const deletePage = useDeletePage();
  const router = useRouter();
  const pathname = usePathname();

  // Measure menu dimensions after render
  useLayoutEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      setMenuDimensions({ width: rect.width, height: rect.height });
    }
  }, []);

  // Calculate adjusted position based on dimensions
  const menuPosition = getAdjustedPosition(position, menuDimensions.width, menuDimensions.height);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, showDeleteConfirm]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay adding listener to prevent immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleAction = useCallback(
    async (action: string) => {
      switch (action) {
        case "rename":
          onRename?.();
          onClose();
          break;

        case "duplicate":
          onDuplicate?.();
          onClose();
          break;

        case "copyLink": {
          const pageUrl = `${window.location.origin}/pages/${pageId}`;
          await navigator.clipboard.writeText(pageUrl);
          onClose();
          break;
        }

        case "favorite":
          // Placeholder - would toggle favorite status
          console.log("Toggle favorite:", pageId);
          onClose();
          break;

        case "delete":
          setShowDeleteConfirm(true);
          break;
      }
    },
    [pageId, onClose, onRename, onDuplicate]
  );

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deletePage.mutateAsync(pageId);
      
      // If we're currently viewing this page, navigate away
      if (pathname === `/pages/${pageId}`) {
        router.push("/");
      }
      
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error("Failed to delete page:", error);
      // Error is handled by the mutation, keep modal open
    }
  }, [deletePage, pageId, pathname, router, onClose]);

  if (showDeleteConfirm) {
    return (
      <Modal
        isOpen={true}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete page"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
              loading={deletePage.isPending}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[var(--text-secondary)]">
          Delete <span className="font-medium text-[var(--text-primary)]">&quot;{pageTitle}&quot;</span>? 
          This cannot be undone.
        </p>
        {deletePage.isError && (
          <p className="mt-2 text-sm text-[var(--danger)]">
            Failed to delete page. Please try again.
          </p>
        )}
      </Modal>
    );
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 min-w-[180px] rounded-lg border border-[var(--border-default)]
                 bg-[var(--bg-primary)] py-1 shadow-lg shadow-black/20"
      style={{
        left: `${menuPosition.x}px`,
        top: `${menuPosition.y}px`,
      }}
    >
      {menuItems.map((item, index) => (
        <div key={item.action}>
          {item.divider && index > 0 && (
            <div className="my-1 h-px bg-[var(--border-default)]" />
          )}
          <button
            role="menuitem"
            className={`
              flex w-full items-center gap-2 px-3 py-1.5 text-sm transition-colors
              ${
                item.danger
                  ? "text-[var(--danger)] hover:bg-[var(--danger)]/10"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }
            `}
            onClick={() => handleAction(item.action)}
          >
            <item.icon className="h-4 w-4" />
            <span>{item.label}</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// Hook to manage context menu state
export function usePageContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    pageId: string;
    pageTitle: string;
    position: ContextMenuPosition;
  } | null>(null);

  const openContextMenu = useCallback(
    (
      e: React.MouseEvent,
      pageId: string,
      pageTitle: string
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        pageId,
        pageTitle,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
  };
}
