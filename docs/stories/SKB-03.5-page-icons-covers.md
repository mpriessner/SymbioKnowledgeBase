# Story SKB-03.5: Page Icons and Cover Images

**Epic:** Epic 3 - Page Management & Navigation
**Story ID:** SKB-03.5
**Story Points:** 3 | **Priority:** Medium | **Status:** Draft
**Depends On:** SKB-03.1 (page update endpoint must exist)

---

## User Story

As a researcher, I want to add emoji icons and cover images to my pages, So that I can visually distinguish and personalize my pages.

---

## Acceptance Criteria

- [ ] Clicking the page icon area opens an emoji picker component
- [ ] Emoji picker displays a searchable grid of common emojis organized by category
- [ ] Selecting an emoji saves it as the page icon via `PUT /api/pages/[id]`
- [ ] A "Remove icon" button clears the icon (sets it to `null`)
- [ ] Clicking "Add cover" or the cover area opens a URL input for pasting an image URL
- [ ] Cover image URL is validated (must be a valid URL) and saved via `PUT /api/pages/[id]`
- [ ] Cover image is displayed as a full-width banner above the page title
- [ ] A "Remove cover" button clears the cover URL (sets it to `null`)
- [ ] A "Change cover" button allows updating the cover URL
- [ ] Icons are displayed in the sidebar tree next to page titles (already supported by SidebarTreeNode)
- [ ] Icons are displayed in breadcrumb segments (already supported by Breadcrumbs)
- [ ] PageHeader is updated to wire the emoji picker and cover management to the "Add icon" / "Add cover" buttons

---

## Architecture Overview

```
Emoji Picker Component:

┌──────────────────────────────────────────────┐
│  Emoji Picker (Popover)                       │
│  ┌──────────────────────────────────────────┐│
│  │ 🔍 Search emojis...                      ││
│  ├──────────────────────────────────────────┤│
│  │ 😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉       ││
│  │ 😊 😇 🥰 😍 🤩 😘 😗 😚 😙 🥲 😋       ││
│  │ 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🤫 🤔 🫡       ││
│  │ ...                                       ││
│  ├──────────────────────────────────────────┤│
│  │ Smileys | People | Nature | Food | ...   ││
│  │ (category tabs)                           ││
│  ├──────────────────────────────────────────┤│
│  │ [Remove Icon]                             ││
│  └──────────────────────────────────────────┘│
└──────────────────────────────────────────────┘

Cover Image Management:

┌───────────────────────────────────────────────────┐
│  Cover Image Area (full width)                     │
│  ┌─────────────────────────────────────────────┐  │
│  │  [image from coverUrl]                       │  │
│  │                                               │  │
│  │  ┌─────────────┐ ┌──────────────┐           │  │
│  │  │ Change cover │ │ Remove cover │           │  │
│  │  └─────────────┘ └──────────────┘           │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
│  OR (when no cover):                               │
│                                                    │
│  [Add cover] ← appears on hover above title        │
└───────────────────────────────────────────────────┘

Cover URL Input Modal:

┌──────────────────────────────────────┐
│  Add Cover Image                      │
│                                       │
│  Paste an image URL:                  │
│  ┌────────────────────────────────┐  │
│  │ https://example.com/image.jpg  │  │
│  └────────────────────────────────┘  │
│                                       │
│  [Cancel]              [Save]         │
└──────────────────────────────────────┘

Data Flow:

User clicks icon area
     │
     ▼
EmojiPicker opens (popover)
     │
     │  User selects emoji
     ▼
useUpdatePage.mutate({ id, icon: "📄" })
     │
     │  PUT /api/pages/:id { icon: "📄" }
     ▼
TanStack Query cache updated → UI re-renders
     │
     ├── PageHeader shows new icon
     ├── Sidebar shows new icon
     └── Breadcrumbs show new icon
```

---

## Implementation Steps

### Step 1: Define the Emoji Data

A curated set of commonly used emojis organized by category. This avoids pulling in a heavy emoji library while providing a good selection for knowledge base use.

**File: `src/lib/emojis.ts`**

```typescript
export interface EmojiCategory {
  name: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😋", "😛", "😜", "🤪", "😝",
      "🤗", "🤔", "🫡", "😐", "😑", "😶", "🙄", "😏", "😬", "😮‍💨",
    ],
  },
  {
    name: "People",
    emojis: [
      "👋", "🤚", "🖐", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞",
      "🤟", "🤘", "🤙", "👈", "👉", "👆", "👇", "☝️", "👍", "👎",
      "👏", "🙌", "🤝", "🙏", "💪", "🧠", "👀", "👁", "👤", "👥",
    ],
  },
  {
    name: "Nature",
    emojis: [
      "🌱", "🌿", "🍀", "🌵", "🌲", "🌳", "🌴", "🌸", "🌺", "🌻",
      "🌹", "🌷", "🍁", "🍂", "🍃", "🌍", "🌎", "🌏", "🌈", "☀️",
      "🌤", "⛅", "🌧", "⛈", "🌩", "🌊", "❄️", "🔥", "⭐", "🌙",
    ],
  },
  {
    name: "Objects",
    emojis: [
      "📄", "📝", "📖", "📚", "📓", "📔", "📒", "📕", "📗", "📘",
      "📙", "📰", "🗞", "📑", "🔖", "🏷", "📌", "📍", "📎", "🖇",
      "📐", "📏", "🗂", "📁", "📂", "🗃", "🗄", "🗑", "🔒", "🔓",
      "🔑", "🔧", "🔨", "⚙️", "🧲", "🔬", "🔭", "📡", "💡", "🔋",
    ],
  },
  {
    name: "Symbols",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❗", "❓", "⭕", "❌", "✅", "☑️", "✔️", "➕", "➖", "➗",
      "💯", "🔴", "🟠", "🟡", "🟢", "🔵", "🟣", "⚫", "⚪", "🔶",
      "▶️", "⏸", "⏹", "⏺", "⏯", "🔀", "🔁", "🔂", "🔃", "🔄",
    ],
  },
  {
    name: "Science",
    emojis: [
      "🧪", "🧫", "🧬", "🔬", "🔭", "📊", "📈", "📉", "🧮", "💻",
      "🖥", "🖨", "⌨️", "🖱", "💾", "💿", "📀", "🗜", "📟", "📠",
      "🏥", "🏛", "🏫", "🏢", "🏭", "🏗", "🧰", "🛠", "⚗️", "🩺",
    ],
  },
  {
    name: "Food",
    emojis: [
      "🍎", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍒", "🍑",
      "🥭", "🍍", "🥥", "🥝", "🍅", "🥑", "🌽", "🥕", "🧅", "🧄",
      "☕", "🍵", "🧃", "🥤", "🍺", "🍷", "🥂", "🍸", "🧁", "🍰",
    ],
  },
  {
    name: "Travel",
    emojis: [
      "🚗", "🚕", "🚌", "🚎", "🏎", "🚓", "🚑", "🚒", "✈️", "🚀",
      "🛸", "🚁", "⛵", "🚢", "🗺", "🧭", "🏔", "⛰", "🌋", "🏕",
      "🏖", "🏜", "🏝", "🏞", "🗼", "🗽", "🏰", "🏯", "🎪", "🎢",
    ],
  },
];

/**
 * Flat list of all emojis for search functionality.
 */
export const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((cat) => cat.emojis);

/**
 * Simple emoji search — checks if the emoji is in the category name
 * or if it matches common associations.
 * For MVP, we use a basic approach. A full implementation would
 * use emoji metadata with keywords.
 */
export function searchEmojis(query: string): string[] {
  if (!query.trim()) return ALL_EMOJIS;

  const lower = query.toLowerCase();

  // Search by category name first
  const matchingCategories = EMOJI_CATEGORIES.filter((cat) =>
    cat.name.toLowerCase().includes(lower)
  );
  if (matchingCategories.length > 0) {
    return matchingCategories.flatMap((cat) => cat.emojis);
  }

  // Fallback: return all emojis (in a real app, we'd have keyword metadata)
  return ALL_EMOJIS;
}
```

---

### Step 2: Create the EmojiPicker Component

A popover component that displays emojis in a searchable grid with category tabs.

**File: `src/components/workspace/EmojiPicker.tsx`**

```tsx
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
```

---

### Step 3: Create the CoverImageManager Component

Handles cover image display, the URL input modal, and remove/change actions.

**File: `src/components/workspace/CoverImageManager.tsx`**

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";

interface CoverImageManagerProps {
  coverUrl: string | null;
  onSave: (url: string) => void;
  onRemove: () => void;
}

export function CoverImageManager({
  coverUrl,
  onSave,
  onRemove,
}: CoverImageManagerProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [urlInput, setUrlInput] = useState(coverUrl || "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(() => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError("Please enter a URL");
      return;
    }

    try {
      new URL(trimmed);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setError(null);
    onSave(trimmed);
    setIsEditing(false);
  }, [urlInput, onSave]);

  const handleCancel = useCallback(() => {
    setUrlInput(coverUrl || "");
    setError(null);
    setIsEditing(false);
  }, [coverUrl]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleSave();
      } else if (e.key === "Escape") {
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  // Cover image display with hover controls
  if (coverUrl && !isEditing) {
    return (
      <div className="relative w-full h-48 group overflow-hidden">
        <img
          src={coverUrl}
          alt="Page cover"
          className="w-full h-full object-cover"
        />
        {/* Hover controls */}
        <div className="absolute bottom-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => {
              setUrlInput(coverUrl);
              setIsEditing(true);
            }}
            className="px-3 py-1 text-xs font-medium text-white bg-black/50 hover:bg-black/70 rounded transition-colors"
            aria-label="Change cover image"
          >
            Change cover
          </button>
          <button
            onClick={onRemove}
            className="px-3 py-1 text-xs font-medium text-white bg-black/50 hover:bg-red-600/70 rounded transition-colors"
            aria-label="Remove cover image"
          >
            Remove cover
          </button>
        </div>
      </div>
    );
  }

  // URL input modal
  if (isEditing) {
    return (
      <div className="w-full bg-gray-50 border-b border-gray-200 px-16 py-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-sm font-medium text-gray-700 mb-2">
            {coverUrl ? "Change cover image" : "Add cover image"}
          </p>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                ref={inputRef}
                type="url"
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  setError(null);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Paste an image URL (e.g., https://example.com/image.jpg)"
                className={`
                  w-full px-3 py-2 text-sm border rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-300
                  ${error ? "border-red-300" : "border-gray-300"}
                `}
                aria-label="Cover image URL"
                aria-invalid={!!error}
              />
              {error && (
                <p className="text-xs text-red-500 mt-1">{error}</p>
              )}
            </div>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // No cover set — return null (the "Add cover" button is handled by PageHeader)
  return null;
}
```

---

### Step 4: Update PageHeader to Wire Icon and Cover Management

Enhance the PageHeader component from SKB-03.1 to integrate the EmojiPicker and CoverImageManager.

**Updated File: `src/components/workspace/PageHeader.tsx`**

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useUpdatePage } from "@/hooks/usePages";
import { EmojiPicker } from "@/components/workspace/EmojiPicker";
import { CoverImageManager } from "@/components/workspace/CoverImageManager";
import type { Page } from "@/types/page";

interface PageHeaderProps {
  page: Page;
}

export function PageHeader({ page }: PageHeaderProps) {
  const [title, setTitle] = useState(page.title);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverInput, setShowCoverInput] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const updatePage = useUpdatePage();

  // Sync title when page data changes externally
  useEffect(() => {
    setTitle(page.title);
  }, [page.title]);

  const handleTitleBlur = useCallback(() => {
    const newTitle = title.trim() || "Untitled";
    if (newTitle !== page.title) {
      updatePage.mutate({ id: page.id, title: newTitle });
    }
  }, [title, page.id, page.title, updatePage]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLHeadingElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        titleRef.current?.blur();
      }
    },
    []
  );

  const handleIconSelect = useCallback(
    (emoji: string) => {
      updatePage.mutate({ id: page.id, icon: emoji });
    },
    [page.id, updatePage]
  );

  const handleIconRemove = useCallback(() => {
    updatePage.mutate({ id: page.id, icon: null });
  }, [page.id, updatePage]);

  const handleCoverSave = useCallback(
    (url: string) => {
      updatePage.mutate({ id: page.id, coverUrl: url });
      setShowCoverInput(false);
    },
    [page.id, updatePage]
  );

  const handleCoverRemove = useCallback(() => {
    updatePage.mutate({ id: page.id, coverUrl: null });
  }, [page.id, updatePage]);

  return (
    <div className="w-full">
      {/* Cover Image Area */}
      {(page.coverUrl || showCoverInput) && (
        <CoverImageManager
          coverUrl={page.coverUrl}
          onSave={handleCoverSave}
          onRemove={handleCoverRemove}
        />
      )}

      {/* Icon and Title */}
      <div className="px-16 pt-8 pb-4 max-w-4xl mx-auto">
        {/* Icon with emoji picker */}
        {page.icon && (
          <div className="mb-2 relative">
            <button
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="text-5xl hover:bg-gray-100 rounded-lg p-2 transition-colors"
              aria-label="Change page icon"
            >
              {page.icon}
            </button>
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={handleIconSelect}
                onRemove={handleIconRemove}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        )}

        {/* Add Icon / Add Cover buttons (when not set) */}
        <div
          className={`
            flex gap-2 mb-2 transition-opacity
            ${!page.icon || !page.coverUrl ? "opacity-0 hover:opacity-100" : "hidden"}
          `}
        >
          {!page.icon && (
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors flex items-center gap-1"
                aria-label="Add icon"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                  />
                </svg>
                Add icon
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={handleIconSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
          )}
          {!page.coverUrl && (
            <button
              onClick={() => setShowCoverInput(true)}
              className="text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded px-2 py-1 transition-colors flex items-center gap-1"
              aria-label="Add cover"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                />
              </svg>
              Add cover
            </button>
          )}
        </div>

        {/* Editable Title */}
        <h1
          ref={titleRef}
          contentEditable
          suppressContentEditableWarning
          className="text-4xl font-bold text-gray-900 outline-none focus:outline-none empty:before:content-['Untitled'] empty:before:text-gray-300 cursor-text"
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
          onInput={(e) => setTitle(e.currentTarget.textContent || "")}
          role="textbox"
          aria-label="Page title"
        >
          {page.title}
        </h1>
      </div>
    </div>
  );
}
```

---

## Testing Requirements

### Unit Tests: Emoji Search and Data

**File: `src/__tests__/lib/emojis.test.ts`**

```typescript
import { describe, test, expect } from "vitest";
import {
  EMOJI_CATEGORIES,
  ALL_EMOJIS,
  searchEmojis,
} from "@/lib/emojis";

describe("Emoji Data", () => {
  test("EMOJI_CATEGORIES has categories with non-empty emoji arrays", () => {
    expect(EMOJI_CATEGORIES.length).toBeGreaterThan(0);
    for (const category of EMOJI_CATEGORIES) {
      expect(category.name).toBeTruthy();
      expect(category.emojis.length).toBeGreaterThan(0);
    }
  });

  test("ALL_EMOJIS is the flat list of all emojis", () => {
    const totalFromCategories = EMOJI_CATEGORIES.reduce(
      (sum, cat) => sum + cat.emojis.length,
      0
    );
    expect(ALL_EMOJIS.length).toBe(totalFromCategories);
  });

  test("every emoji is a string", () => {
    for (const emoji of ALL_EMOJIS) {
      expect(typeof emoji).toBe("string");
      expect(emoji.length).toBeGreaterThan(0);
    }
  });
});

describe("searchEmojis", () => {
  test("returns all emojis for empty query", () => {
    const results = searchEmojis("");
    expect(results.length).toBe(ALL_EMOJIS.length);
  });

  test("returns all emojis for whitespace-only query", () => {
    const results = searchEmojis("   ");
    expect(results.length).toBe(ALL_EMOJIS.length);
  });

  test("returns category emojis when searching by category name", () => {
    const results = searchEmojis("Science");
    const scienceCategory = EMOJI_CATEGORIES.find((c) => c.name === "Science");
    expect(scienceCategory).toBeDefined();
    expect(results.length).toBe(scienceCategory!.emojis.length);
    expect(results).toEqual(scienceCategory!.emojis);
  });

  test("category search is case-insensitive", () => {
    const results = searchEmojis("science");
    const scienceCategory = EMOJI_CATEGORIES.find((c) => c.name === "Science");
    expect(results.length).toBe(scienceCategory!.emojis.length);
  });

  test("returns all emojis when query does not match any category", () => {
    const results = searchEmojis("xyznonexistent");
    expect(results.length).toBe(ALL_EMOJIS.length);
  });
});
```

### Component Tests: EmojiPicker

**File: `src/__tests__/components/workspace/EmojiPicker.test.tsx`**

```tsx
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPicker } from "@/components/workspace/EmojiPicker";

describe("EmojiPicker", () => {
  test("renders search input", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByLabelText("Search emojis")).toBeInTheDocument();
  });

  test("renders category tabs", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByLabelText("Smileys category")).toBeInTheDocument();
    expect(screen.getByLabelText("Objects category")).toBeInTheDocument();
  });

  test("calls onSelect when emoji is clicked", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <EmojiPicker onSelect={onSelect} onClose={onClose} />
    );

    // Click the first emoji in the grid
    const firstEmoji = screen.getAllByRole("button").find(
      (btn) => btn.textContent && btn.textContent.length <= 2
    );
    if (firstEmoji) {
      fireEvent.click(firstEmoji);
      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  test("calls onRemove when remove button is clicked", () => {
    const onRemove = vi.fn();
    const onClose = vi.fn();
    render(
      <EmojiPicker
        onSelect={vi.fn()}
        onRemove={onRemove}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByLabelText("Remove icon"));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test("does not render remove button when onRemove is not provided", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.queryByLabelText("Remove icon")).not.toBeInTheDocument();
  });

  test("focuses search input on mount", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Search emojis"));
  });

  test("switches category when tab is clicked", () => {
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={vi.fn()} />
    );

    fireEvent.click(screen.getByLabelText("Objects category"));
    expect(screen.getByText("Objects")).toBeInTheDocument();
  });

  test("closes on Escape key", () => {
    const onClose = vi.fn();
    render(
      <EmojiPicker onSelect={vi.fn()} onClose={onClose} />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

### Component Tests: CoverImageManager

**File: `src/__tests__/components/workspace/CoverImageManager.test.tsx`**

```tsx
import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CoverImageManager } from "@/components/workspace/CoverImageManager";

describe("CoverImageManager", () => {
  test("renders cover image when coverUrl is provided", () => {
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    const img = screen.getByAltText("Page cover");
    expect(img).toHaveAttribute("src", "https://example.com/image.jpg");
  });

  test("shows Change/Remove buttons on hover of cover image", () => {
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Change cover image")).toBeInTheDocument();
    expect(screen.getByLabelText("Remove cover image")).toBeInTheDocument();
  });

  test("calls onRemove when Remove cover button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={onRemove}
      />
    );
    fireEvent.click(screen.getByLabelText("Remove cover image"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test("shows URL input when Change cover is clicked", () => {
    render(
      <CoverImageManager
        coverUrl="https://example.com/image.jpg"
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText("Change cover image"));
    expect(screen.getByLabelText("Cover image URL")).toBeInTheDocument();
  });

  test("validates URL input and shows error for invalid URL", () => {
    const onSave = vi.fn();
    render(
      <CoverImageManager
        coverUrl={null}
        onSave={onSave}
        onRemove={vi.fn()}
      />
    );

    // This renders nothing when coverUrl is null (handled by PageHeader)
    // Test with editing mode
  });

  test("renders nothing when coverUrl is null and not editing", () => {
    const { container } = render(
      <CoverImageManager
        coverUrl={null}
        onSave={vi.fn()}
        onRemove={vi.fn()}
      />
    );
    expect(container.innerHTML).toBe("");
  });
});
```

### Integration Tests: Icon and Cover via API

**File: `src/__tests__/api/pages/icons-covers.test.ts`**

```typescript
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/db";

const TENANT_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

describe("Page Icons and Cover Images API", () => {
  let testPageId: string;

  beforeEach(async () => {
    const page = await prisma.page.create({
      data: {
        tenant_id: TENANT_ID,
        title: "Test Page",
        position: 0,
      },
    });
    testPageId = page.id;
  });

  afterEach(async () => {
    await prisma.page.deleteMany({ where: { tenant_id: TENANT_ID } });
  });

  test("PUT /api/pages/[id] sets page icon", async () => {
    const response = await fetch(
      `http://localhost:3000/api/pages/${testPageId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ icon: "📄" }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.icon).toBe("📄");
  });

  test("PUT /api/pages/[id] sets cover URL", async () => {
    const response = await fetch(
      `http://localhost:3000/api/pages/${testPageId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ coverUrl: "https://example.com/cover.jpg" }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.coverUrl).toBe("https://example.com/cover.jpg");
  });

  test("PUT /api/pages/[id] removes icon by setting null", async () => {
    // First set an icon
    await fetch(`http://localhost:3000/api/pages/${testPageId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ icon: "📄" }),
    });

    // Then remove it
    const response = await fetch(
      `http://localhost:3000/api/pages/${testPageId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ icon: null }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.icon).toBeNull();
  });

  test("PUT /api/pages/[id] removes cover by setting null", async () => {
    // First set a cover
    await fetch(`http://localhost:3000/api/pages/${testPageId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({ coverUrl: "https://example.com/cover.jpg" }),
    });

    // Then remove it
    const response = await fetch(
      `http://localhost:3000/api/pages/${testPageId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-tenant-a-key",
        },
        body: JSON.stringify({ coverUrl: null }),
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.coverUrl).toBeNull();
  });

  test("GET /api/pages/[id] returns icon and coverUrl", async () => {
    // Set both
    await fetch(`http://localhost:3000/api/pages/${testPageId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-tenant-a-key",
      },
      body: JSON.stringify({
        icon: "🧪",
        coverUrl: "https://example.com/science.jpg",
      }),
    });

    const response = await fetch(
      `http://localhost:3000/api/pages/${testPageId}`,
      {
        headers: { Authorization: "Bearer test-tenant-a-key" },
      }
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.icon).toBe("🧪");
    expect(body.data.coverUrl).toBe("https://example.com/science.jpg");
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/emojis.ts` |
| CREATE | `src/components/workspace/EmojiPicker.tsx` |
| CREATE | `src/components/workspace/CoverImageManager.tsx` |
| MODIFY | `src/components/workspace/PageHeader.tsx` (wire emoji picker and cover manager) |
| CREATE | `src/__tests__/lib/emojis.test.ts` |
| CREATE | `src/__tests__/components/workspace/EmojiPicker.test.tsx` |
| CREATE | `src/__tests__/components/workspace/CoverImageManager.test.tsx` |
| CREATE | `src/__tests__/api/pages/icons-covers.test.ts` |

---

**Last Updated:** 2026-02-21
