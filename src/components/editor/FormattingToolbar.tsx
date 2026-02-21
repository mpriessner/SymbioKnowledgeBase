"use client";

import { useState, useCallback, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { NodeSelection } from "@tiptap/pm/state";

interface FormattingToolbarProps {
  editor: Editor;
}

export function FormattingToolbar({ editor }: FormattingToolbarProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  // Open link input with current URL if link is active
  const handleLinkClick = useCallback(() => {
    const currentUrl = editor.getAttributes("link").href as string | undefined;
    setLinkUrl(currentUrl ?? "");
    setShowLinkInput(true);
  }, [editor]);

  // Apply the link
  const handleLinkApply = useCallback(() => {
    if (linkUrl.trim()) {
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: linkUrl.trim() })
        .run();
    }
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor, linkUrl]);

  // Remove the link
  const handleLinkRemove = useCallback(() => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setShowLinkInput(false);
    setLinkUrl("");
  }, [editor]);

  // Handle Enter key in link input
  const handleLinkKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleLinkApply();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowLinkInput(false);
        setLinkUrl("");
        editor.commands.focus();
      }
    },
    [handleLinkApply, editor]
  );

  // Listen for Cmd/Ctrl+K keyboard shortcut to open link input
  useEffect(() => {
    const handleOpenLink = () => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        handleLinkClick();
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener("tiptap:open-link-input", handleOpenLink);

    return () => {
      editorDom.removeEventListener("tiptap:open-link-input", handleOpenLink);
    };
  }, [editor, handleLinkClick]);

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
      }}
      shouldShow={({ editor: e, from, to }) => {
        // Only show when there is a text selection (not empty)
        if (from === to) return false;
        // Don't show for node selections (e.g., selected image)
        if (e.state.selection instanceof NodeSelection) return false;
        return true;
      }}
    >
      <div
        className="flex items-center gap-0.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-1 shadow-lg"
        data-testid="formatting-toolbar"
        role="toolbar"
        aria-label="Text formatting"
      >
        {!showLinkInput ? (
          <>
            {/* Bold */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive("bold")}
              title="Bold (Ctrl+B)"
              testId="toolbar-bold"
            >
              <span className="font-bold">B</span>
            </ToolbarButton>

            {/* Italic */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive("italic")}
              title="Italic (Ctrl+I)"
              testId="toolbar-italic"
            >
              <span className="italic">I</span>
            </ToolbarButton>

            {/* Strikethrough */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleStrike().run()}
              isActive={editor.isActive("strike")}
              title="Strikethrough (Ctrl+Shift+S)"
              testId="toolbar-strike"
            >
              <span className="line-through">S</span>
            </ToolbarButton>

            {/* Inline Code */}
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleCode().run()}
              isActive={editor.isActive("code")}
              title="Inline Code (Ctrl+E)"
              testId="toolbar-code"
            >
              <span className="font-mono text-xs">&lt;&gt;</span>
            </ToolbarButton>

            {/* Separator */}
            <div className="mx-1 h-5 w-px bg-[var(--border-default)]" />

            {/* Link */}
            <ToolbarButton
              onClick={handleLinkClick}
              isActive={editor.isActive("link")}
              title="Add Link (Ctrl+K)"
              testId="toolbar-link"
            >
              <LinkIcon />
            </ToolbarButton>
          </>
        ) : (
          /* Link URL input */
          <div
            className="flex items-center gap-1"
            data-testid="link-input-container"
          >
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={handleLinkKeyDown}
              placeholder="https://..."
              className="w-48 rounded border border-[var(--border-default)] bg-[var(--bg-primary)] px-2 py-1 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              data-testid="link-url-input"
              autoFocus
            />
            <button
              onClick={handleLinkApply}
              className="rounded bg-[var(--accent-primary)] px-2 py-1 text-xs font-medium text-[var(--text-inverse)] hover:bg-[var(--accent-primary-hover)]"
              data-testid="link-apply-btn"
            >
              Apply
            </button>
            {editor.isActive("link") && (
              <button
                onClick={handleLinkRemove}
                className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400"
                data-testid="link-remove-btn"
              >
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}

// --- Sub-components ---

interface ToolbarButtonProps {
  onClick: () => void;
  isActive: boolean;
  title: string;
  testId: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive,
  title,
  testId,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded text-sm transition-colors ${
        isActive
          ? "bg-[var(--bg-hover)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
      }`}
      title={title}
      data-testid={testId}
      aria-pressed={isActive}
    >
      {children}
    </button>
  );
}

function LinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
