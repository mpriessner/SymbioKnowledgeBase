"use client";

import { useState } from "react";
import { titleToGradient, isImageUrl } from "@/lib/database/gallery-utils";

interface CardCoverProps {
  imageUrl: string | null;
  title: string;
  height: number;
}

export function CardCover({ imageUrl, title, height }: CardCoverProps) {
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const showImage = imageUrl && isImageUrl(imageUrl) && !imgError;
  const gradient = titleToGradient(title || "Untitled");

  return (
    <div
      className="relative overflow-hidden"
      style={{ height, background: gradient }}
    >
      {showImage && (
        <>
          {/* Skeleton shimmer while loading */}
          {!imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-[var(--bg-secondary)]" />
          )}
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover transition-opacity duration-200
              ${imgLoaded ? "opacity-100" : "opacity-0"}`}
          />
        </>
      )}
    </div>
  );
}
