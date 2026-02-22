"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/**
 * Export section for settings modal.
 * Allows exporting all pages as a zip of markdown files.
 */
export function ExportSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleExportAll = async () => {
    setIsExporting(true);
    setStatus(null);
    try {
      const res = await fetch("/api/pages/export?format=zip");
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        setStatus(
          `Export failed: ${err?.error?.message || res.statusText}`
        );
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, "knowledge-base-export.zip");
      setStatus("Export complete!");
    } catch (err) {
      setStatus("Export failed. Please try again.");
      console.error("Export error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-[var(--text-primary)] mb-1">
          Export All Pages
        </h3>
        <p className="text-xs text-[var(--text-secondary)] mb-3">
          Download all pages as a zip file containing markdown files
          with frontmatter metadata.
        </p>
        <button
          onClick={handleExportAll}
          disabled={isExporting}
          className="inline-flex items-center gap-2 rounded-md border border-[var(--border-default)]
                     bg-[var(--bg-primary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]
                     hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Exporting..." : "Export All Pages"}
        </button>
      </div>

      {status && (
        <p
          className={`text-xs ${
            status.startsWith("Export failed")
              ? "text-red-500"
              : "text-green-600"
          }`}
        >
          {status}
        </p>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
