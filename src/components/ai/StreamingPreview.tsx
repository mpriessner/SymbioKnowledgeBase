"use client";

import { useRef, useEffect } from "react";
import { Square } from "lucide-react";

interface StreamingPreviewProps {
  content: string;
  isStreaming: boolean;
  onStop: () => void;
}

/**
 * Renders accumulated markdown content in a scrollable preview area.
 * Auto-scrolls to bottom while streaming. Shows a blinking cursor at end.
 */
export function StreamingPreview({
  content,
  isStreaming,
  onStop,
}: StreamingPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom during streaming
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  return (
    <div className="relative">
      {/* Stop button */}
      {isStreaming && (
        <button
          onClick={onStop}
          className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 px-2 py-1
            text-xs rounded bg-[var(--bg-secondary)] border border-[var(--border-default)]
            text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
        >
          <Square className="w-3 h-3" />
          Stop
        </button>
      )}

      {/* Content area */}
      <div
        ref={containerRef}
        className="max-h-[400px] overflow-y-auto rounded-lg border border-[var(--border-default)]
          bg-[var(--bg-secondary)] p-4 text-sm text-[var(--text-primary)]
          whitespace-pre-wrap font-mono leading-relaxed"
      >
        {content || (
          <span className="text-[var(--text-tertiary)]">Generating...</span>
        )}
        {isStreaming && (
          <span className="inline-block w-0.5 h-4 ml-0.5 bg-[var(--text-primary)] animate-pulse align-text-bottom" />
        )}
      </div>
    </div>
  );
}
