"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Table2,
  KanbanSquare,
  List,
  Calendar,
  LayoutGrid,
  GanttChart,
  Sparkles,
  Mic,
  Database,
  FileUp,
} from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { AskAIDialog } from "@/components/ai/AskAIDialog";
import { MeetingNotesGenerator } from "@/components/ai/MeetingNotesGenerator";
import { DEFAULT_COLUMNS } from "@/types/database";
import type { DatabaseViewType, DatabaseSchema, RowProperties } from "@/types/database";
import { parseCSVToDatabase } from "@/lib/import/csv-import";

interface PageCreationMenuProps {
  pageId: string;
  onAction: () => void;
}

const VIEW_OPTIONS: {
  type: DatabaseViewType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { type: "table", label: "Table", icon: Table2 },
  { type: "board", label: "Board", icon: KanbanSquare },
  { type: "list", label: "List", icon: List },
  { type: "timeline", label: "Timeline", icon: GanttChart },
  { type: "calendar", label: "Calendar", icon: Calendar },
  { type: "gallery", label: "Gallery", icon: LayoutGrid },
];

export function PageCreationMenu({ pageId, onAction }: PageCreationMenuProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [showAskAI, setShowAskAI] = useState(false);
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateDatabaseView = useCallback(
    async (viewType: DatabaseViewType) => {
      if (isCreating) return;
      setIsCreating(true);

      try {
        const schema: DatabaseSchema = { columns: DEFAULT_COLUMNS };

        const res = await fetch("/api/databases", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId,
            schema,
            defaultView: viewType,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error?.message || "Failed to create database");
        }

        addToast(`Database created with ${viewType} view`, "success");
        onAction();
      } catch (error) {
        addToast(
          error instanceof Error ? error.message : "Failed to create database",
          "error"
        );
      } finally {
        setIsCreating(false);
      }
    },
    [pageId, isCreating, addToast, onAction]
  );

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsCreating(true);

      try {
        const text = await file.text();
        const ext = file.name.split(".").pop()?.toLowerCase();

        if (ext === "csv") {
          const { schema, rows } = parseCSVToDatabase(text);

          // Add SELECT options to inferred SELECT columns
          for (const col of schema.columns) {
            if (col.type === "SELECT") {
              const values = new Set(
                rows
                  .map((r) => {
                    const v = r[col.id];
                    return v?.type === "SELECT" ? v.value : null;
                  })
                  .filter(Boolean) as string[]
              );
              col.options = [...values];
            }
          }

          // Create database
          const dbRes = await fetch("/api/databases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pageId, schema, defaultView: "table" }),
          });

          if (!dbRes.ok) throw new Error("Failed to create database from CSV");

          const dbData = await dbRes.json();
          const databaseId = dbData.data.id;

          // Create rows
          for (const properties of rows) {
            await fetch(`/api/databases/${databaseId}/rows`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ properties }),
            });
          }

          addToast(
            `Imported ${rows.length} rows from CSV`,
            "success"
          );
          onAction();
        } else if (ext === "md") {
          // Save markdown as page content via the blocks API
          const res = await fetch(`/api/pages/${pageId}/blocks`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: text }],
                  },
                ],
              },
            }),
          });
          if (!res.ok) throw new Error("Failed to import markdown");

          addToast("Markdown imported", "success");
          onAction();
        } else if (ext === "json") {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            // Array of objects -> create database
            if (parsed.length === 0) throw new Error("JSON array is empty");
            const headers = Object.keys(parsed[0]);
            const columns = headers.map((h, i) => ({
              id: `col-${i}`,
              name: h,
              type: (i === 0 ? "TITLE" : "TEXT") as "TITLE" | "TEXT",
            }));
            const schema: DatabaseSchema = { columns };
            const rows: RowProperties[] = parsed.map((obj) => {
              const props: RowProperties = {};
              columns.forEach((col, i) => {
                const val = String(obj[headers[i]] ?? "");
                props[col.id] = { type: col.type, value: val };
              });
              return props;
            });

            const dbRes = await fetch("/api/databases", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pageId, schema, defaultView: "table" }),
            });
            if (!dbRes.ok) throw new Error("Failed to create database from JSON");
            const dbData = await dbRes.json();

            for (const properties of rows) {
              await fetch(`/api/databases/${dbData.data.id}/rows`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ properties }),
              });
            }

            addToast(`Imported ${rows.length} rows from JSON`, "success");
            onAction();
          } else if (parsed.type === "doc") {
            // TipTap JSON -> import as page content
            const res = await fetch(`/api/pages/${pageId}/blocks`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ content: parsed }),
            });
            if (!res.ok) throw new Error("Failed to import JSON content");

            addToast("Content imported", "success");
            onAction();
          } else {
            throw new Error("Unrecognized JSON format");
          }
        } else {
          throw new Error(`Unsupported file type: .${ext}`);
        }
      } catch (error) {
        addToast(
          error instanceof Error ? error.message : "Import failed",
          "error"
        );
      } finally {
        setIsCreating(false);
        // Reset file input so the same file can be re-selected
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [pageId, addToast, onAction]
  );

  const handleAskAI = useCallback(() => {
    setShowAskAI(true);
  }, []);

  const handleAIComplete = useCallback(
    async (markdown: string) => {
      try {
        // Extract title from first "# heading"
        const titleMatch = markdown.match(/^#\s+(.+)/m);
        const title = titleMatch?.[1]?.trim();

        // Update page title if found
        if (title) {
          await fetch(`/api/pages/${pageId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title }),
          });
        }

        // Save content as a single paragraph block (markdown as text)
        // The BlockEditor will pick it up and render it
        await fetch(`/api/pages/${pageId}/blocks`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: {
              type: "doc",
              content: markdownToSimpleDoc(markdown),
            },
          }),
        });

        setShowAskAI(false);
        onAction();
      } catch (error) {
        addToast("Failed to save generated content", "error");
      }
    },
    [pageId, addToast, onAction]
  );

  const handleMeetingNotes = useCallback(() => {
    setShowMeetingNotes(true);
  }, []);

  const handleDatabase = useCallback(() => {
    handleCreateDatabaseView("table");
  }, [handleCreateDatabaseView]);

  // If Meeting Notes is open, show only that
  if (showMeetingNotes) {
    return (
      <div className="content-pad py-8">
        <div className="max-w-2xl mx-auto">
          <MeetingNotesGenerator
            pageId={pageId}
            onComplete={handleAIComplete}
            onCancel={() => setShowMeetingNotes(false)}
          />
        </div>
      </div>
    );
  }

  // If Ask AI dialog is open, show only that
  if (showAskAI) {
    return (
      <div className="content-pad py-8">
        <div className="max-w-2xl mx-auto">
          <AskAIDialog
            pageId={pageId}
            onComplete={handleAIComplete}
            onCancel={() => setShowAskAI(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="content-pad py-8">
      <div className="max-w-2xl mx-auto">
        <p className="text-sm font-medium text-[var(--text-secondary)] mb-4">
          Get started with
        </p>

        {/* Database view options */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-6">
          {VIEW_OPTIONS.map(({ type, label, icon: Icon }) => (
            <button
              key={type}
              onClick={() => handleCreateDatabaseView(type)}
              disabled={isCreating}
              className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border-default)]
                px-3 py-4 text-xs font-medium text-[var(--text-secondary)]
                hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
                hover:border-[var(--border-strong)]
                transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleAskAI}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)]
              px-4 py-2.5 text-sm text-[var(--text-secondary)]
              hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
              transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-purple-500" />
            Ask AI
          </button>

          <button
            onClick={handleMeetingNotes}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)]
              px-4 py-2.5 text-sm text-[var(--text-secondary)]
              hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
              transition-colors disabled:opacity-50"
          >
            <Mic className="w-4 h-4 text-red-500" />
            AI Meeting Notes
          </button>

          <button
            onClick={handleDatabase}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)]
              px-4 py-2.5 text-sm text-[var(--text-secondary)]
              hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
              transition-colors disabled:opacity-50"
          >
            <Database className="w-4 h-4 text-orange-500" />
            Database
          </button>

          <button
            onClick={handleImportClick}
            disabled={isCreating}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)]
              px-4 py-2.5 text-sm text-[var(--text-secondary)]
              hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]
              transition-colors disabled:opacity-50"
          >
            <FileUp className="w-4 h-4 text-blue-500" />
            Import
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.csv,.json"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

/**
 * Convert markdown text to a simple TipTap doc structure.
 * Splits by lines and wraps each non-empty line in a paragraph.
 */
function markdownToSimpleDoc(
  markdown: string
): Array<{ type: string; content?: Array<{ type: string; text: string }> }> {
  const lines = markdown.split("\n");
  const nodes: Array<{
    type: string;
    content?: Array<{ type: string; text: string }>;
  }> = [];

  for (const line of lines) {
    if (line.trim() === "") {
      nodes.push({ type: "paragraph" });
    } else {
      nodes.push({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      });
    }
  }

  return nodes.length > 0
    ? nodes
    : [{ type: "paragraph" }];
}
