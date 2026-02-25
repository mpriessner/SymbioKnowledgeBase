"use client";

import { useState } from "react";

interface TranscriptPreviewProps {
  transcript: string;
  onEdit: (edited: string) => void;
  onGenerate: () => void;
  onBack: () => void;
}

export function TranscriptPreview({
  transcript,
  onEdit,
  onGenerate,
  onBack,
}: TranscriptPreviewProps) {
  const [text, setText] = useState(transcript);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--text-primary)]">
          Review transcript
        </h3>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {wordCount} words
        </span>
      </div>

      <p className="text-[10px] text-[var(--text-tertiary)]">
        Edit the transcript to fix any errors before generating notes.
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onEdit(e.target.value);
        }}
        rows={10}
        className="w-full rounded-lg border border-[var(--border-default)]
          bg-[var(--bg-secondary)] p-3 text-sm text-[var(--text-primary)]
          placeholder:text-[var(--text-tertiary)]
          focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]
          resize-y"
      />

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          Re-record
        </button>
        <button
          onClick={onGenerate}
          disabled={text.trim().length < 10}
          className="px-4 py-2 text-sm font-medium rounded-md
            bg-[var(--accent-primary)] text-white
            hover:opacity-90 transition-opacity
            disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Generate Notes
        </button>
      </div>
    </div>
  );
}
