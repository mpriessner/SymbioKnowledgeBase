import type { JSONContent } from "@tiptap/react";
import type { BlockType } from "@/lib/validation/blocks";

// Block record as returned from the API
export interface Block {
  id: string;
  tenantId: string;
  pageId: string;
  type: BlockType;
  content: JSONContent;
  position: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// Save status for the editor
export type SaveStatus = "idle" | "saving" | "saved" | "error";

// Editor configuration options
export interface EditorConfig {
  pageId: string;
  editable?: boolean;
  placeholder?: string;
  onSaveStatusChange?: (status: SaveStatus) => void;
}

// Auto-save hook options
export interface AutoSaveOptions {
  pageId: string;
  debounceMs?: number;
  onStatusChange?: (status: SaveStatus) => void;
}
