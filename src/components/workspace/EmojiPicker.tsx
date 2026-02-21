"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { EMOJI_CATEGORIES, searchEmojis } from "@/lib/emojis";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onRemove?: () => void;
  onClose: () => void;
}

export function EmojiPicker({ onSelect, onRemove, onClose }: EmojiPickerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleEmojiClick = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      onClose();
    },
    [onSelect, onClose]
  );

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = isSearching ? searchEmojis(searchQuery) : null;

  return (
    <div
      ref={pickerRef}
      className="absolute z-50 w-80 bg-white border border-gray-200 rounded-lg shadow-xl"
      role="dialog"
      aria-label="Emoji picker"
    >
      {/* Search bar */}
      <div className="p-2 border-b border-gray-100">
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emojis..."
          className="w-full px-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-300"
          aria-label="Search emojis"
        />
      </div>

      {/* Category tabs (hidden during search) */}
      {!isSearching && (
        <div className="flex gap-1 px-2 py-1 border-b border-gray-100 overflow-x-auto">
          {EMOJI_CATEGORIES.map((category, index) => (
            <button
              key={category.name}
              onClick={() => setActiveCategory(index)}
              className={`
                px-2 py-1 text-xs rounded whitespace-nowrap transition-colors
                ${
                  activeCategory === index
                    ? "bg-blue-100 text-blue-700 font-medium"
                    : "text-gray-500 hover:bg-gray-100"
                }
              `}
              aria-label={`${category.name} category`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="p-2 max-h-52 overflow-y-auto">
        {isSearching ? (
          // Search results
          <div className="grid grid-cols-8 gap-0.5">
            {searchResults?.map((emoji, index) => (
              <button
                key={`${emoji}-${index}`}
                onClick={() => handleEmojiClick(emoji)}
                className="w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-gray-100 transition-colors"
                aria-label={`Select ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : (
          // Category view
          <div>
            <p className="text-xs text-gray-400 font-medium mb-1 px-1">
              {EMOJI_CATEGORIES[activeCategory].name}
            </p>
            <div className="grid grid-cols-8 gap-0.5">
              {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, index) => (
                <button
                  key={`${emoji}-${index}`}
                  onClick={() => handleEmojiClick(emoji)}
                  className="w-8 h-8 flex items-center justify-center text-xl rounded hover:bg-gray-100 transition-colors"
                  aria-label={`Select ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Remove icon button */}
      {onRemove && (
        <div className="p-2 border-t border-gray-100">
          <button
            onClick={() => {
              onRemove();
              onClose();
            }}
            className="w-full text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded py-1.5 transition-colors"
            aria-label="Remove icon"
          >
            Remove icon
          </button>
        </div>
      )}
    </div>
  );
}
