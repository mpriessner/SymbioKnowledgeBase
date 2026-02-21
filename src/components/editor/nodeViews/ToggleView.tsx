"use client";

import { NodeViewWrapper, NodeViewContent } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

export function ToggleView({ node, updateAttributes }: NodeViewProps) {
  const isOpen = node.attrs.isOpen as boolean;

  const handleToggle = () => {
    updateAttributes({ isOpen: !isOpen });
  };

  return (
    <NodeViewWrapper
      className="toggle-block my-2"
      data-testid="toggle-block"
    >
      <div className="flex items-start gap-1">
        {/* Toggle indicator */}
        <button
          onClick={handleToggle}
          className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-[var(--bg-tertiary)]"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Collapse toggle" : "Expand toggle"}
          data-testid="toggle-trigger"
          contentEditable={false}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="currentColor"
            className={`transition-transform duration-200 ${
              isOpen ? "rotate-90" : "rotate-0"
            }`}
          >
            <path d="M4 2l4 4-4 4z" />
          </svg>
        </button>

        {/* Toggle content */}
        <div className="min-w-0 flex-1">
          <NodeViewContent
            className={`toggle-content ${isOpen ? "" : "hidden"}`}
          />
        </div>
      </div>
    </NodeViewWrapper>
  );
}
