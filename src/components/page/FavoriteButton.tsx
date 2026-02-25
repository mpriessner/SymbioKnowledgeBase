"use client";

import { Star } from "lucide-react";
import { useIsFavorite, useToggleFavorite } from "@/hooks/useFavorites";

interface FavoriteButtonProps {
  pageId: string;
}

export function FavoriteButton({ pageId }: FavoriteButtonProps) {
  const isFavorite = useIsFavorite(pageId);
  const toggleFavorite = useToggleFavorite();

  const handleClick = () => {
    toggleFavorite.mutate({ pageId, isFavorite: !isFavorite });
  };

  return (
    <button
      onClick={handleClick}
      className={`
        rounded p-1.5 transition-all duration-200
        ${
          isFavorite
            ? "text-[#f5c518]"
            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
        }
        active:scale-125
      `}
      title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      aria-pressed={isFavorite}
    >
      <Star
        className={`h-4 w-4 ${isFavorite ? "fill-current" : ""}`}
      />
    </button>
  );
}
