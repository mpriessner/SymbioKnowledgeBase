"use client";

import { useRef, useState, useCallback } from "react";

interface TimelineBarProps {
  rowId: string;
  title: string;
  left: number;
  width: number;
  color: string;
  pixelsPerDay: number;
  onMove: (daysDelta: number) => void;
  onResizeStart: (daysDelta: number) => void;
  onResizeEnd: (daysDelta: number) => void;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function TimelineBar({
  rowId,
  title,
  left,
  width,
  color,
  pixelsPerDay,
  onMove,
  onResizeStart,
  onResizeEnd,
  onClick,
  onContextMenu,
}: TimelineBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"move" | "resize-left" | "resize-right" | null>(null);
  const startXRef = useRef(0);

  const handlePointerDown = useCallback(
    (mode: "move" | "resize-left" | "resize-right", e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(mode);
      startXRef.current = e.clientX;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      // Visual feedback is handled by CSS transform during drag,
      // but we keep it simple — finalize on pointer up.
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const delta = e.clientX - startXRef.current;
      const daysDelta = Math.round(delta / pixelsPerDay);

      if (daysDelta !== 0) {
        if (dragging === "move") onMove(daysDelta);
        else if (dragging === "resize-left") onResizeStart(daysDelta);
        else if (dragging === "resize-right") onResizeEnd(daysDelta);
      }

      setDragging(null);
    },
    [dragging, pixelsPerDay, onMove, onResizeStart, onResizeEnd]
  );

  const barWidth = Math.max(width, pixelsPerDay); // At least 1 day wide

  return (
    <div
      ref={barRef}
      className="absolute top-1 flex items-center rounded h-6 select-none group"
      style={{
        left,
        width: barWidth,
        backgroundColor: color,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onContextMenu={onContextMenu}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      data-testid={`timeline-bar-${rowId}`}
    >
      {/* Left resize handle */}
      <div
        className="absolute left-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-black/20 rounded-l"
        onPointerDown={(e) => handlePointerDown("resize-left", e)}
      />

      {/* Move area */}
      <div
        className="flex-1 cursor-grab active:cursor-grabbing px-2 truncate text-[10px] font-medium text-white"
        onPointerDown={(e) => handlePointerDown("move", e)}
      >
        {title || "Untitled"}
      </div>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-0 w-1.5 h-full cursor-ew-resize hover:bg-black/20 rounded-r"
        onPointerDown={(e) => handlePointerDown("resize-right", e)}
      />
    </div>
  );
}
