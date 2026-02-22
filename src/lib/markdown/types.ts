import type { JSONContent } from "@tiptap/core";

/**
 * Page metadata for YAML frontmatter.
 */
export interface PageMetadata {
  title: string;
  icon?: string | null;
  created: string; // ISO 8601
  updated: string; // ISO 8601
  parent?: string | null; // Parent page ID
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
