"use client";

import { useState, useCallback } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useAIPageGeneration } from "@/hooks/useAIPageGeneration";
import { StreamingPreview } from "./StreamingPreview";

interface AskAIDialogProps {
  pageId: string;
  onComplete: (markdown: string) => void;
  onCancel: () => void;
}

const SUGGESTIONS = [
  "Project plan for...",
  "Meeting notes template",
  "Technical design doc for...",
  "Weekly status report",
];

export function AskAIDialog({
  pageId,
  onComplete,
  onCancel,
}: AskAIDialogProps) {
  const [prompt, setPrompt] = useState("");
  const { generate, content, isGenerating, error, cancel, reset } =
    useAIPageGeneration();

  const handleGenerate = useCallback(() => {
    if (prompt.trim().length < 3) return;
    generate(prompt.trim());
  }, [prompt, generate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleGenerate();
      }
    },
    [handleGenerate]
  );

  const handleStop = useCallback(() => {
    cancel();
  }, [cancel]);

  // When generation is done and we have content
  const handleApply = useCallback(() => {
    if (content.trim()) {
      onComplete(content);
    }
  }, [content, onComplete]);

  const handleRetry = useCallback(() => {
    reset();
  }, [reset]);

  // State: generating or has content
  const hasContent = content.trim().length > 0;
  const isDone = !isGenerating && hasContent;

  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)] p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-medium text-[var(--text-primary)]">
          Ask AI
        </span>
      </div>

      {!isGenerating && !hasContent && (
        <>
          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe the page you want to create..."
              autoFocus
              className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-secondary)]
                px-3 py-2 text-sm text-[var(--text-primary)]
                placeholder:text-[var(--text-tertiary)]
                focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
            />
            <button
              onClick={handleGenerate}
              disabled={prompt.trim().length < 3}
              className="px-4 py-2 text-sm font-medium rounded-md
                bg-[var(--accent-primary)] text-white
                hover:opacity-90 transition-opacity
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Generate
            </button>
          </div>

          {/* Suggestions */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setPrompt(s)}
                className="px-2.5 py-1 text-xs rounded-full
                  border border-[var(--border-default)]
                  text-[var(--text-secondary)]
                  hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
                  transition-colors"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Cancel */}
          <div className="mt-3 text-right">
            <button
              onClick={onCancel}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Streaming / result */}
      {(isGenerating || hasContent) && (
        <div className="mt-2">
          <StreamingPreview
            content={content}
            isStreaming={isGenerating}
            onStop={handleStop}
          />

          {isDone && (
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                onClick={handleRetry}
                className="px-3 py-1.5 text-xs rounded
                  border border-[var(--border-default)]
                  text-[var(--text-secondary)]
                  hover:bg-[var(--bg-hover)] transition-colors"
              >
                Try again
              </button>
              <button
                onClick={handleApply}
                className="px-3 py-1.5 text-xs font-medium rounded
                  bg-[var(--accent-primary)] text-white
                  hover:opacity-90 transition-opacity"
              >
                Use this content
              </button>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 p-3 rounded bg-red-500/10 border border-red-500/20">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={handleRetry}
            className="mt-2 text-xs font-medium text-red-600 dark:text-red-400
              hover:underline"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
