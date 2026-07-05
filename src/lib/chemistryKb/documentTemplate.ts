/**
 * Standard body template for `kind='DOCUMENT'` pages (a71-08 document
 * intake). Renders the markdown body that gets converted to TipTap via
 * `markdownToTiptap` at page-creation time — the same conversion path
 * `POST /api/agent/pages` already uses for its `markdown` field.
 */

export type DocSource = "upload" | "url" | "drive";

export interface DocumentTemplateInput {
  title: string;
  source: DocSource;
  /** Filename for `source: "upload"`; the URL for `"url"` / `"drive"`. */
  sourceDetail: string;
  addedBy: string;
  addedAt?: Date;
  tags?: string[];
  /** Best-effort fetched snapshot text for `source: "url"` (non-fatal if absent). */
  snapshot?: string | null;
}

function sourceLine(source: DocSource, detail: string): string {
  switch (source) {
    case "upload":
      return `upload: ${detail}`;
    case "drive":
      return `drive: ${detail}`;
    case "url":
    default:
      return `link: ${detail}`;
  }
}

/**
 * Render the standard document page body as markdown:
 *
 * # <Title>
 *
 * **Source:** <upload | link: URL | drive: fileId>
 * **Added by:** <user>
 * **Added:** <ISO date>
 * **Tags:** <comma list>
 *
 * ## Summary
 * <empty until filled in>
 *
 * ## Notes
 * <free text>
 *
 * A `## Snapshot` section is appended only when a snapshot was fetched.
 */
export function renderDocumentTemplate(input: DocumentTemplateInput): string {
  const addedAt = input.addedAt ?? new Date();
  const tags = input.tags && input.tags.length > 0 ? input.tags.join(", ") : "";

  const lines: string[] = [
    `# ${input.title}`,
    `**Source:** ${sourceLine(input.source, input.sourceDetail)}`,
    `**Added by:** ${input.addedBy}`,
    `**Added:** ${addedAt.toISOString()}`,
    `**Tags:** ${tags}`,
    `## Summary`,
    ``,
    `## Notes`,
    ``,
  ];

  if (input.snapshot) {
    lines.push(`## Snapshot`, input.snapshot);
  }

  return lines.join("\n");
}
