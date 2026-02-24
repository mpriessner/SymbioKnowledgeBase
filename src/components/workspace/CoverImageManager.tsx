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
        {/* eslint-disable-next-line @next/next/no-img-element */}
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
        <div className="w-full">
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
