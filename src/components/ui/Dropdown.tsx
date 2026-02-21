"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface DropdownItem {
  label: string;
  value: string;
  disabled?: boolean;
}

interface DropdownProps {
  trigger: React.ReactNode;
  items: DropdownItem[];
  onSelect: (value: string) => void;
  align?: "left" | "right";
}

export function Dropdown({
  trigger,
  items,
  onSelect,
  align = "left",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Reset active index when opening
  useEffect(() => {
    if (isOpen) setActiveIndex(-1);
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
        e.preventDefault();
        setIsOpen(true);
        return;
      }

      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          setActiveIndex((prev) => {
            let next = prev + 1;
            while (next < items.length && items[next].disabled) next++;
            return next < items.length ? next : prev;
          });
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          setActiveIndex((prev) => {
            let next = prev - 1;
            while (next >= 0 && items[next].disabled) next--;
            return next >= 0 ? next : prev;
          });
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          if (activeIndex >= 0 && !items[activeIndex].disabled) {
            onSelect(items[activeIndex].value);
            setIsOpen(false);
          }
          break;
        }
        case "Escape": {
          e.preventDefault();
          setIsOpen(false);
          break;
        }
      }
    },
    [isOpen, activeIndex, items, onSelect]
  );

  return (
    <div ref={containerRef} className="relative inline-block" onKeyDown={handleKeyDown}>
      <div
        role="button"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          role="listbox"
          className={`absolute z-50 mt-1 min-w-[160px] rounded-md border border-[var(--border-default)]
            bg-[var(--bg-primary)] py-1 shadow-lg
            ${align === "right" ? "right-0" : "left-0"}`}
        >
          {items.map((item, index) => (
            <div
              key={item.value}
              role="option"
              aria-selected={index === activeIndex}
              aria-disabled={item.disabled}
              className={`cursor-pointer px-3 py-2 text-sm transition-colors
                ${item.disabled ? "opacity-50 cursor-not-allowed" : ""}
                ${index === activeIndex ? "bg-[var(--bg-hover)] text-[var(--text-primary)]" : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"}`}
              onClick={() => {
                if (!item.disabled) {
                  onSelect(item.value);
                  setIsOpen(false);
                }
              }}
              onMouseEnter={() => !item.disabled && setActiveIndex(index)}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
