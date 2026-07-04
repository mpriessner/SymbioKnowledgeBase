"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { isSafeUrl } from "@/lib/editor/sanitizeTiptap";

interface ImageInsertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Primary action: open a native file picker to upload an image. */
  onUploadClick: () => void;
  /** Secondary action: embed an image by URL. */
  onEmbedUrl: (url: string) => void;
}

/**
 * Slash-menu "Image" dialog. Replaces the old `window.prompt` flow: the
 * primary action uploads a file; embedding by URL remains available as a
 * secondary path.
 */
export function ImageInsertDialog({
  isOpen,
  onClose,
  onUploadClick,
  onEmbedUrl,
}: ImageInsertDialogProps) {
  const [url, setUrl] = useState("");
  const trimmed = url.trim();
  const urlValid = trimmed.length > 0 && isSafeUrl(trimmed);

  const handleUpload = () => {
    onClose();
    onUploadClick();
  };

  const handleEmbed = () => {
    if (!urlValid) return;
    onEmbedUrl(trimmed);
    setUrl("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add an image">
      <div className="flex flex-col gap-4">
        <Button variant="primary" fullWidth onClick={handleUpload}>
          Upload from computer
        </Button>

        <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
          <span className="h-px flex-1 bg-[var(--border-default)]" />
          or embed from URL
          <span className="h-px flex-1 bg-[var(--border-default)]" />
        </div>

        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEmbed();
            }}
            placeholder="https://example.com/image.png"
            className="flex-1 rounded-md border border-[var(--border-default)] bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            data-testid="image-url-input"
          />
          <Button
            variant="secondary"
            onClick={handleEmbed}
            disabled={!urlValid}
          >
            Embed
          </Button>
        </div>
      </div>
    </Modal>
  );
}
