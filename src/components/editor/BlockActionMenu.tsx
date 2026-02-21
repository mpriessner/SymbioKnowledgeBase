"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import {
  convertBlock,
  getAvailableConversions,
  type ConvertibleBlockType,
} from "@/lib/editor/blockConversion";

interface BlockActionMenuProps {
  editor: Editor;
  /** The position of the block node in the document */
  blockPos: number;
  /** Pixel coordinates for positioning the menu */
  anchorX: number;
  anchorY: number;
  /** Callback to close the menu */
  onClose: () => void;
}

export function BlockActionMenu({
  editor,
  blockPos,
  anchorX,
  anchorY,
  onClose,
}: BlockActionMenuProps) {
  const [showTurnInto, setShowTurnInto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const availableConversions = getAvailableConversions(editor);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  // Handle block type conversion
  const handleConvert = useCallback(
    (targetType: ConvertibleBlockType) => {
      editor.commands.setTextSelection(blockPos + 1);
      convertBlock(editor, targetType);
      onClose();
    },
    [editor, blockPos, onClose]
  );

  // Handle block deletion
  const handleDelete = useCallback(() => {
    const node = editor.state.doc.nodeAt(blockPos);
    if (node) {
      editor
        .chain()
        .focus()
        .deleteRange({
          from: blockPos,
          to: blockPos + node.nodeSize,
        })
        .run();
    }
    onClose();
  }, [editor, blockPos, onClose]);

  // Handle block duplication
  const handleDuplicate = useCallback(() => {
    const node = editor.state.doc.nodeAt(blockPos);
    if (node) {
      const insertPos = blockPos + node.nodeSize;
      editor
        .chain()
        .focus()
        .insertContentAt(insertPos, node.toJSON() as Record<string, unknown>)
        .run();
    }
    onClose();
  }, [editor, blockPos, onClose]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showTurnInto) {
        const mainItems = ["turnInto", "duplicate", "delete"];
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= mainItems.length - 1 ? 0 : prev + 1
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? mainItems.length - 1 : prev - 1
          );
        } else if (e.key === "Enter" || e.key === "ArrowRight") {
          e.preventDefault();
          if (selectedIndex === 0) {
            setShowTurnInto(true);
            setSelectedIndex(0);
          } else if (selectedIndex === 1) {
            handleDuplicate();
          } else if (selectedIndex === 2) {
            handleDelete();
          }
        }
      } else {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev >= availableConversions.length - 1 ? 0 : prev + 1
          );
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev <= 0 ? availableConversions.length - 1 : prev - 1
          );
        } else if (e.key === "Enter") {
          e.preventDefault();
          const option = availableConversions[selectedIndex];
          if (option) {
            handleConvert(option.id);
          }
        } else if (e.key === "ArrowLeft" || e.key === "Escape") {
          e.preventDefault();
          setShowTurnInto(false);
          setSelectedIndex(0);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [
    showTurnInto,
    selectedIndex,
    availableConversions,
    handleConvert,
    handleDelete,
    handleDuplicate,
  ]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
      style={{ left: anchorX, top: anchorY }}
      role="menu"
      aria-label="Block actions"
      data-testid="block-action-menu"
    >
      {!showTurnInto ? (
        /* Main menu */
        <div className="w-56 py-1">
          {/* Turn into */}
          <button
            className={`flex w-full items-center justify-between px-3 py-2 text-sm ${
              selectedIndex === 0
                ? "bg-gray-100 dark:bg-gray-700"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
            onClick={() => {
              setShowTurnInto(true);
              setSelectedIndex(0);
            }}
            onMouseEnter={() => setSelectedIndex(0)}
            role="menuitem"
            data-testid="menu-turn-into"
          >
            <div className="flex items-center gap-2">
              <TurnIntoIcon />
              <span>Turn into</span>
            </div>
            <ChevronRightIcon />
          </button>

          {/* Duplicate */}
          <button
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm ${
              selectedIndex === 1
                ? "bg-gray-100 dark:bg-gray-700"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
            onClick={handleDuplicate}
            onMouseEnter={() => setSelectedIndex(1)}
            role="menuitem"
            data-testid="menu-duplicate"
          >
            <DuplicateIcon />
            <span>Duplicate</span>
          </button>

          {/* Separator */}
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

          {/* Delete */}
          <button
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 ${
              selectedIndex === 2
                ? "bg-red-50 dark:bg-red-900/20"
                : "hover:bg-red-50 dark:hover:bg-red-900/20"
            }`}
            onClick={handleDelete}
            onMouseEnter={() => setSelectedIndex(2)}
            role="menuitem"
            data-testid="menu-delete"
          >
            <DeleteIcon />
            <span>Delete</span>
          </button>
        </div>
      ) : (
        /* Turn into submenu */
        <div className="w-60 py-1" data-testid="turn-into-submenu">
          {/* Back button */}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            onClick={() => {
              setShowTurnInto(false);
              setSelectedIndex(0);
            }}
            data-testid="turn-into-back"
          >
            <ChevronLeftIcon />
            <span>Back</span>
          </button>
          <div className="my-1 border-t border-gray-200 dark:border-gray-700" />

          {/* Conversion options */}
          {availableConversions.map((option, index) => (
            <button
              key={option.id}
              className={`flex w-full items-center gap-3 px-3 py-2 text-sm ${
                index === selectedIndex
                  ? "bg-gray-100 dark:bg-gray-700"
                  : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
              onClick={() => handleConvert(option.id)}
              onMouseEnter={() => setSelectedIndex(index)}
              role="menuitem"
              data-testid={`convert-to-${option.id}`}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded border border-gray-200 text-xs font-bold text-gray-500 dark:border-gray-600 dark:text-gray-400">
                {option.icon}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {option.name}
                </p>
                <p className="text-xs text-gray-400">{option.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TurnIntoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}
