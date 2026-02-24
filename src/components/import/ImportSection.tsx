"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X } from "lucide-react";

/**
 * Import section for settings modal.
 * Allows importing .md files to create new pages.
 */
export function ImportSection() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<
    Array<{ name: string; success: boolean; error?: string }>
  >([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback((fileList: FileList | File[]) => {
    const mdFiles = Array.from(fileList).filter((f) =>
      f.name.endsWith(".md")
    );
    setFiles((prev) => [...prev, ...mdFiles]);
    setResults([]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImport = async () => {
    if (files.length === 0) return;

    setIsImporting(true);
    setProgress({ current: 0, total: files.length });
    const importResults: typeof results = [];

    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      const file = files[i];

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/pages/import", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          importResults.push({ name: file.name, success: true });

          // If single file import, navigate to the new page
          if (files.length === 1 && data.data?.id) {
            router.push(`/pages/${data.data.id}`);
          }
        } else {
          const err = await res.json().catch(() => null);
          importResults.push({
            name: file.name,
            success: false,
            error: err?.error?.message || "Import failed",
          });
        }
      } catch {
        importResults.push({
          name: file.name,
          success: false,
          error: "Network error",
        });
      }
    }

    setResults(importResults);
    setFiles([]);
    setIsImporting(false);
  };

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
          Import Markdown Files
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Upload .md files to create new pages. Frontmatter metadata
          (title, icon) will be parsed automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-[var(--accent-primary)] bg-[var(--bg-hover)]"
            : "border-[var(--border-default)] hover:border-[var(--text-tertiary)]"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md"
          multiple
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = "";
          }}
          className="hidden"
        />
        <Upload className="mx-auto mb-2 h-8 w-8 text-[var(--text-secondary)]" />
        <p className="text-sm text-[var(--text-secondary)]">
          Drag and drop .md files here, or click to browse
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, i) => (
            <div
              key={`${file.name}-${i}`}
              className="flex items-center justify-between rounded-md border border-[var(--border-default)] px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--text-secondary)]" />
                <span className="text-sm text-[var(--text-primary)]">
                  {file.name}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(i);
                }}
                className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}

          <button
            onClick={handleImport}
            disabled={isImporting}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--accent-primary)] px-4 py-2
                       text-sm font-medium text-white hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Upload className="h-4 w-4" />
            {isImporting
              ? `Importing ${progress.current} of ${progress.total}...`
              : `Import ${files.length} file${files.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="rounded-md border border-[var(--border-default)] p-3">
          <p className="text-sm font-medium text-[var(--text-primary)] mb-2">
            Import Results
          </p>
          {successCount > 0 && (
            <p className="text-xs text-green-600">
              {successCount} page{successCount > 1 ? "s" : ""} imported
              successfully
            </p>
          )}
          {failCount > 0 && (
            <div className="mt-1">
              <p className="text-xs text-red-500">
                {failCount} file{failCount > 1 ? "s" : ""} failed:
              </p>
              {results
                .filter((r) => !r.success)
                .map((r, i) => (
                  <p key={i} className="text-xs text-red-400 ml-2">
                    {r.name}: {r.error}
                  </p>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
