import type { JSONContent } from "@tiptap/core";

/**
 * Page metadata for YAML frontmatter.
 */
export interface PageMetadata {
  id?: string; // Page UUID (set by sync, read-only in frontmatter)
  title: string;
  icon?: string | null;
  parent?: string | null; // Parent page ID
  position?: number; // Sort position among siblings
  spaceType?: string; // PRIVATE | TEAMSPACE
  created: string; // ISO 8601
  updated: string; // ISO 8601
  tags?: string[];
}

/**
 * Serialization context passed through recursive conversion.
 */
export interface SerializationContext {
  /** Current indentation level (for nested lists) */
  indent: number;
  /** Whether we're inside a list */
  inList: boolean;
  /** List type (bullet, ordered, todo) */
  listType?: "bullet" | "ordered" | "todo";
  /** Current list item index (for ordered lists) */
  listIndex?: number;
}

/**
 * Options for tiptapToMarkdown function.
 */
export interface SerializerOptions {
  /** Include YAML frontmatter */
  includeFrontmatter?: boolean;
  /** Page metadata for frontmatter */
  metadata?: PageMetadata;
  /** Escape special markdown characters (default true) */
  escapeText?: boolean;
}

/**
 * Result from markdown deserialization.
 */
export interface DeserializeResult {
  content: JSONContent;
  metadata: Partial<PageMetadata>;
}
