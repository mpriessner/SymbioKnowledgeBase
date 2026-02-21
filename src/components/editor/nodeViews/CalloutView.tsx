"use client";

import { useState, useRef, useEffect } from "react";
import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";
import type { CalloutVariant } from "@/components/editor/extensions/callout";

const variantStyles: Record<
  CalloutVariant,
  { bg: string; border: string; text: string }
> = {
  info: {
    bg: "bg-blue-50 dark:bg-blue-950/30",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-900 dark:text-blue-100",
  },
  warning: {
    bg: "bg-yellow-50 dark:bg-yellow-950/30",
    border: "border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-900 dark:text-yellow-100",
  },
  success: {
    bg: "bg-green-50 dark:bg-green-950/30",
    border: "border-green-200 dark:border-green-800",
    text: "text-green-900 dark:text-green-100",
  },
  error: {
    bg: "bg-red-50 dark:bg-red-950/30",
    border: "border-red-200 dark:border-red-800",
    text: "text-red-900 dark:text-red-100",
  },
};

const defaultEmojis = ["\u{1F4A1}", "\u26A0\uFE0F", "\u2705", "\u274C", "\u{1F4DD}", "\u{1F525}", "\u{1F4AC}", "\u{1F4CC}", "\u{1F3AF}", "\u{1F680}"];

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const emoji = node.attrs.emoji as string;
  const variant = node.attrs.variant as CalloutVariant;
  const styles = variantStyles[variant];

  // Close emoji picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(e.target as globalThis.Node)
      ) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <NodeViewWrapper
      className={`callout-block my-3 rounded-lg border-l-4 p-4 ${styles.bg} ${styles.border}`}
      data-testid="callout-block"
      data-variant={variant}
    >
      <div className="flex items-start gap-3">
        {/* Emoji icon -- clickable to change */}
        <div className="relative" ref={emojiPickerRef} contentEditable={false}>
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-8 w-8 items-center justify-center rounded text-xl hover:bg-black/5 dark:hover:bg-white/5"
            data-testid="callout-emoji-btn"
            title="Change icon"
          >
            {emoji}
          </button>

          {/* Mini emoji picker */}
          {showEmojiPicker && (
            <div
              className="absolute left-0 top-10 z-50 grid grid-cols-5 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800"
              data-testid="callout-emoji-picker"
            >
              {defaultEmojis.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    updateAttributes({ emoji: e });
                    setShowEmojiPicker(false);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Callout content */}
        <div className={`min-w-0 flex-1 ${styles.text}`}>
          <NodeViewContent className="callout-content" />
        </div>
      </div>

      {/* Variant selector */}
      <div
        className="mt-2 flex gap-1"
        contentEditable={false}
        data-testid="callout-variant-selector"
      >
        {(Object.keys(variantStyles) as CalloutVariant[]).map((v) => (
          <button
            key={v}
            onClick={() => updateAttributes({ variant: v })}
            className={`rounded px-2 py-0.5 text-xs capitalize ${
              variant === v
                ? "bg-gray-200 font-medium dark:bg-gray-600"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
            data-testid={`callout-variant-${v}`}
          >
            {v}
          </button>
        ))}
      </div>
    </NodeViewWrapper>
  );
}
