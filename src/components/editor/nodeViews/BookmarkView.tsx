"use client";

import { useEffect, useState } from "react";
import { NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

interface OgMetadata {
  title: string;
  description: string;
  favicon: string;
  image: string;
}

export function BookmarkView({ node, updateAttributes }: NodeViewProps) {
  const url = node.attrs.url as string;
  const title = node.attrs.title as string;
  const description = node.attrs.description as string;
  const favicon = node.attrs.favicon as string;
  const image = node.attrs.image as string;

  const [isLoading, setIsLoading] = useState(!title && !!url);
  const [_hasError, setHasError] = useState(false);

  // Fetch OG metadata if not already present
  useEffect(() => {
    if (!url || title) return;

    let cancelled = false;

    async function fetchMetadata() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/og-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });

        if (!res.ok) throw new Error("Failed to fetch metadata");

        const data = (await res.json()) as { data: OgMetadata };
        if (!cancelled) {
          updateAttributes({
            title: data.data.title || new URL(url).hostname,
            description: data.data.description || "",
            favicon: data.data.favicon || "",
            image: data.data.image || "",
          });
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setHasError(true);
          setIsLoading(false);
          try {
            updateAttributes({
              title: new URL(url).hostname,
            });
          } catch {
            // invalid URL, ignore
          }
        }
      }
    }

    fetchMetadata();
    return () => {
      cancelled = true;
    };
  }, [url, title, updateAttributes]);

  // Extract domain from URL for display
  let domain = "";
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = url;
  }

  // Loading state
  if (isLoading) {
    return (
      <NodeViewWrapper data-testid="bookmark-block">
        <div className="my-3 animate-pulse rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-full rounded bg-gray-200 dark:bg-gray-700" />
              <div className="mt-2 h-3 w-1/4 rounded bg-gray-200 dark:bg-gray-700" />
            </div>
            <div className="h-16 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-testid="bookmark-block" contentEditable={false}>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="my-3 flex cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/50"
        data-testid="bookmark-link"
      >
        {/* Text content */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {title || domain}
          </p>
          {description && (
            <p className="line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}
          <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            {favicon && (
              <img
                src={favicon}
                alt=""
                className="h-4 w-4"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className="truncate">{domain}</span>
          </div>
        </div>

        {/* Preview image */}
        {image && (
          <div className="hidden w-[200px] shrink-0 sm:block">
            <img
              src={image}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display =
                  "none";
              }}
            />
          </div>
        )}
      </a>
    </NodeViewWrapper>
  );
}
