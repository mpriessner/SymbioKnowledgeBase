"use client";

import { useState, useCallback } from "react";
import {
  usePublishStatus,
  usePublishPage,
  useUnpublishPage,
  useUpdatePublishOptions,
} from "@/hooks/usePublish";
import { ToggleSwitch } from "./ToggleSwitch";

interface ShareDialogPublishProps {
  pageId: string;
}

export function ShareDialogPublish({ pageId }: ShareDialogPublishProps) {
  const { data, isLoading } = usePublishStatus(pageId);
  const publishPage = usePublishPage(pageId);
  const unpublishPage = useUnpublishPage(pageId);
  const updateOptions = useUpdatePublishOptions(pageId);
  const [copied, setCopied] = useState(false);

  const status = data?.data;
  const isPublished = status?.is_published ?? false;

  const handleTogglePublish = useCallback(() => {
    if (isPublished) {
      unpublishPage.mutate();
    } else {
      publishPage.mutate();
    }
  }, [isPublished, publishPage, unpublishPage]);

  const handleCopyUrl = useCallback(async () => {
    if (status?.url) {
      await navigator.clipboard.writeText(status.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [status?.url]);

  if (isLoading) {
    return (
      <div className="py-4 text-sm text-[var(--text-tertiary)]">Loading...</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Publish toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Publish to web
          </p>
          {!isPublished && (
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              Share this page with anyone on the internet.
            </p>
          )}
        </div>
        <ToggleSwitch
          checked={isPublished}
          onChange={handleTogglePublish}
          disabled={publishPage.isPending || unpublishPage.isPending}
          label="Publish to web"
        />
      </div>

      {/* Published options */}
      {isPublished && status && (
        <>
          {/* URL with Copy button */}
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={status.url || ""}
              className="flex-1 rounded border border-[var(--border-default)] px-3 py-1.5 text-xs font-mono bg-[var(--bg-secondary)] text-[var(--text-secondary)]"
            />
            <button
              onClick={handleCopyUrl}
              className="rounded border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          {/* Options toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-primary)]">
                Allow search engine indexing
              </span>
              <ToggleSwitch
                checked={status.allow_indexing}
                onChange={(v) =>
                  updateOptions.mutate({ allowIndexing: v })
                }
                disabled={updateOptions.isPending}
                label="Allow search engine indexing"
              />
            </div>
            <div className="flex items-center justify-between opacity-50">
              <div>
                <span className="text-sm text-[var(--text-primary)]">
                  Allow duplicate as template
                </span>
                <span className="ml-2 text-[10px] bg-[var(--bg-secondary)] rounded px-1.5 py-0.5 text-[var(--text-tertiary)]">
                  Coming soon
                </span>
              </div>
              <ToggleSwitch
                checked={false}
                disabled
                onChange={() => {}}
                label="Allow duplicate as template"
              />
            </div>
          </div>

          {/* Published timestamp */}
          {status.published_at && (
            <p className="text-xs text-[var(--text-tertiary)]">
              Published on{" "}
              {new Date(status.published_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
