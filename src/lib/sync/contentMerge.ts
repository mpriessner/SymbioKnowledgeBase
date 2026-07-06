/**
 * Section-owned merge logic for experiment KB pages (a71-02, content sync).
 *
 * An experiment page body is a single Tiptap document (`Block.type ===
 * "DOCUMENT"`, `Block.content` is the doc's `JSONContent`). Rather than
 * overwriting that whole document on every sync, incoming content updates
 * only ever own a fixed set of `##`-level sections — everything else
 * (including a user's own `## KB Notes`) must survive byte-identical.
 *
 * Fixed section order (see story 2026-07-04-a71-02, §2):
 *   # <Experiment Title>      — owned by lifecycle sync (title), untouched here
 *   ## Executive Summary      — owned by: notebook (section key "notebook_wiki", exec_summary)
 *   ## Notebook Narrative     — owned by: notebook (section key "notebook_wiki", markdown)
 *   ## ExpTube Analysis       — owned by: exptube (section key "exptube_analysis")
 *   ## KB Notes               — owned by: SKB user edits, never touched by sync
 */

import type { JSONContent } from "@tiptap/core";
import { markdownToTiptap } from "@/lib/markdown/deserializer";

/** Fixed, ordered section headings a content_update may own or append. */
export const FIXED_SECTION_HEADINGS = [
  "Executive Summary",
  "Notebook Narrative",
  "ExpTube Analysis",
  "KB Notes",
] as const;

export type FixedSectionHeading = (typeof FIXED_SECTION_HEADINGS)[number];

/** All owned sections are `##` (level 2) headings under the page title (`#`). */
const SECTION_LEVEL = 2;

export interface SectionUpdate {
  /** One of the fixed, ordered section headings this update owns. */
  heading: FixedSectionHeading;
  /**
   * Markdown body for the section. May optionally include its own leading
   * `## <heading>` line (some callers/curl examples include it); a leading
   * line that matches the target heading is stripped defensively so the
   * canonical heading text is always the one written, never whatever the
   * caller happened to send.
   */
  markdown: string;
}

export interface ApplySectionUpdatesResult {
  /** The full page doc with the requested sections replaced/appended. */
  doc: JSONContent;
  /**
   * Headings that had to be appended rather than replaced in place, because
   * no matching `##` heading was found. This is the expected path for a
   * fresh scaffold's first content sync (AC3) as well as the fallback path
   * when a user has renamed/deleted an owned heading (regression risk
   * mitigation — callers should flag "unsynced structure" when non-empty).
   */
  appended: FixedSectionHeading[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function headingText(node: JSONContent): string {
  if (node.type !== "heading" || !Array.isArray(node.content)) return "";
  return node.content
    .map((child) => (child.type === "text" ? child.text || "" : ""))
    .join("")
    .trim();
}

function headingLevel(node: JSONContent): number {
  const level = node.attrs?.level;
  return typeof level === "number" ? level : 1;
}

function findHeadingIndex(
  content: JSONContent[],
  heading: string,
  level: number
): number {
  return content.findIndex(
    (node) =>
      node.type === "heading" &&
      headingLevel(node) === level &&
      headingText(node).toLowerCase() === heading.toLowerCase()
  );
}

/**
 * Exclusive end index of the section starting at `headingIdx` (a heading at
 * `level`): everything up to (but not including) the next heading whose
 * level is <= `level`, or the end of the document.
 */
function findSectionEnd(
  content: JSONContent[],
  headingIdx: number,
  level: number
): number {
  for (let i = headingIdx + 1; i < content.length; i++) {
    const node = content[i];
    if (node.type === "heading" && headingLevel(node) <= level) {
      return i;
    }
  }
  return content.length;
}

/** Strip a leading line that redundantly repeats the target `## heading`. */
function stripLeadingHeadingLine(
  markdown: string,
  heading: string,
  level: number
): string {
  const newlineIdx = markdown.indexOf("\n");
  const firstLine = (
    newlineIdx === -1 ? markdown : markdown.slice(0, newlineIdx)
  ).trim();
  const pattern = new RegExp(
    `^#{${level}}\\s+${escapeRegExp(heading)}\\s*$`,
    "i"
  );
  if (pattern.test(firstLine)) {
    return (newlineIdx === -1 ? "" : markdown.slice(newlineIdx + 1)).replace(
      /^\n+/,
      ""
    );
  }
  return markdown;
}

/** Build the Tiptap nodes for one section: the canonical heading + its body. */
function buildSectionNodes(
  heading: string,
  bodyMarkdown: string
): JSONContent[] {
  const cleanedBody = stripLeadingHeadingLine(
    bodyMarkdown,
    heading,
    SECTION_LEVEL
  );
  const sectionMarkdown = `${"#".repeat(SECTION_LEVEL)} ${heading}\n\n${cleanedBody}`.trimEnd();
  const { content } = markdownToTiptap(sectionMarkdown);
  return Array.isArray(content.content) ? (content.content as JSONContent[]) : [];
}

/**
 * Find where to insert a missing fixed-order heading: immediately before the
 * next fixed-order heading that already exists, else immediately after the
 * closest earlier fixed-order heading's section, else at the very end.
 */
function findInsertionPoint(
  content: JSONContent[],
  heading: FixedSectionHeading
): number {
  const orderIdx = FIXED_SECTION_HEADINGS.indexOf(heading);
  if (orderIdx === -1) return content.length;

  for (let j = orderIdx + 1; j < FIXED_SECTION_HEADINGS.length; j++) {
    const idx = findHeadingIndex(content, FIXED_SECTION_HEADINGS[j], SECTION_LEVEL);
    if (idx !== -1) return idx;
  }

  for (let j = orderIdx - 1; j >= 0; j--) {
    const idx = findHeadingIndex(content, FIXED_SECTION_HEADINGS[j], SECTION_LEVEL);
    if (idx !== -1) return findSectionEnd(content, idx, SECTION_LEVEL);
  }

  return content.length;
}

/**
 * Apply one or more section-owned updates to a page's Tiptap doc.
 *
 * Every node outside the targeted sections is carried over by reference
 * (never cloned/rewritten), so untouched regions — including a
 * user-authored `## KB Notes` — stay byte-identical.
 */
export function applySectionUpdates(
  doc: JSONContent,
  updates: SectionUpdate[]
): ApplySectionUpdatesResult {
  let content: JSONContent[] = Array.isArray(doc.content) ? [...doc.content] : [];
  const appended: FixedSectionHeading[] = [];

  for (const update of updates) {
    const sectionNodes = buildSectionNodes(update.heading, update.markdown);
    const idx = findHeadingIndex(content, update.heading, SECTION_LEVEL);

    if (idx !== -1) {
      const end = findSectionEnd(content, idx, SECTION_LEVEL);
      content = [...content.slice(0, idx), ...sectionNodes, ...content.slice(end)];
    } else {
      const insertAt = findInsertionPoint(content, update.heading);
      content = [...content.slice(0, insertAt), ...sectionNodes, ...content.slice(insertAt)];
      appended.push(update.heading);
    }
  }

  return { doc: { ...doc, content }, appended };
}

/**
 * Staleness guard (AC4): an incoming update is stale — and must be rejected
 * without mutating the page — if its `generatedAt` is older than OR EQUAL TO
 * the section's last-applied timestamp. Equality is treated as stale too, so
 * an exact-duplicate retry (e.g. from the a71-01 DLQ) is a safe no-op rather
 * than a redundant re-write.
 */
export function isStaleUpdate(
  generatedAt: string,
  lastAppliedAt: Date | string | null | undefined
): boolean {
  if (!lastAppliedAt) return false;

  const incoming = new Date(generatedAt).getTime();
  const last = new Date(lastAppliedAt).getTime();

  if (Number.isNaN(incoming)) return false;
  if (Number.isNaN(last)) return false;

  return incoming <= last;
}
