"use client";

import { CardCover } from "./CardCover";
import { PropertyCell } from "./PropertyCell";
import type { Column, RowProperties } from "@/types/database";

interface GalleryCardProps {
  rowId: string;
  title: string;
  properties: RowProperties;
  coverImageUrl: string | null;
  visibleColumns: Column[];
  showCover: boolean;
  onClick: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function GalleryCard({
  rowId,
  title,
  properties,
  coverImageUrl,
  visibleColumns,
  showCover,
  onClick,
  onContextMenu,
}: GalleryCardProps) {
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onClick();
      }}
      className="group rounded-lg border border-[var(--border-default)] bg-[var(--bg-primary)]
        overflow-hidden cursor-pointer shadow-sm
        hover:shadow-md hover:scale-[1.02] transition-all duration-150
        focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
      data-testid={`gallery-card-${rowId}`}
    >
      {/* Cover */}
      {showCover && (
        <CardCover imageUrl={coverImageUrl} title={title} height={160} />
      )}

      {/* Content */}
      <div className="p-3">
        <h3 className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">
          {title || "Untitled"}
        </h3>

        {/* Property badges */}
        {visibleColumns.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {visibleColumns.map((col) => {
              const value = properties[col.id];
              if (!value) return null;
              return (
                <span key={col.id} className="text-xs">
                  <PropertyCell value={value} />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
