"use client";

import { useState } from "react";

interface ImageBlockProps {
  src: string;
  alt?: string;
  title?: string;
}

/**
 * Standalone image block component.
 * Used when a more complex image rendering is needed
 * (e.g., with caption, resize handles).
 *
 * For MVP, the base Image extension handles rendering.
 * This component is provided for future enhancement.
 */
export function ImageBlock({ src, alt, title }: ImageBlockProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className="my-4 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 dark:border-gray-600 dark:bg-gray-800"
        data-testid="image-block-error"
      >
        <p className="text-sm text-gray-500">
          Failed to load image
        </p>
      </div>
    );
  }

  return (
    <figure className="my-4" data-testid="image-block">
      <div className="relative">
        {/* Blur placeholder while loading */}
        {!isLoaded && (
          <div className="absolute inset-0 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
        )}
        <img
          src={src}
          alt={alt ?? ""}
          title={title ?? undefined}
          loading="lazy"
          className={`mx-auto max-w-full rounded-lg transition-opacity duration-300 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      </div>
      {alt && (
        <figcaption className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">
          {alt}
        </figcaption>
      )}
    </figure>
  );
}
