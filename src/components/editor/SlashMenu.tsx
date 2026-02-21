"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { BlockTypeItem } from "@/lib/editor/blockTypeRegistry";

export interface SlashMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface SlashMenuProps {
  items: BlockTypeItem[];
  command: (item: BlockTypeItem) => void;
}

export const SlashMenu = forwardRef<SlashMenuRef, SlashMenuProps>(
  function SlashMenu({ items, command }, ref) {
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when items change
    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    // Expose keyboard handler to the Suggestion plugin
    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) =>
            prev <= 0 ? items.length - 1 : prev - 1
          );
          return true;
        }

        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) =>
            prev >= items.length - 1 ? 0 : prev + 1
          );
          return true;
        }

        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div
          className="z-50 rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-3 shadow-lg"
          data-testid="slash-menu"
        >
          <p className="text-sm text-[var(--text-secondary)]">
            No results
          </p>
        </div>
      );
    }

    return (
      <div
        className="z-50 max-h-[300px] w-72 overflow-y-auto rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] shadow-lg"
        data-testid="slash-menu"
        role="listbox"
        aria-label="Block types"
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            className={`flex w-full items-start gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex
                ? "bg-[var(--bg-hover)]"
                : "hover:bg-[var(--bg-tertiary)]"
            }`}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            role="option"
            aria-selected={index === selectedIndex}
            data-testid={`slash-menu-item-${item.id}`}
          >
            {/* Icon */}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)] text-xs font-bold text-[var(--text-secondary)]">
              {item.icon}
            </span>

            {/* Name and description */}
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">
                {item.name}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate">
                {item.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    );
  }
);
