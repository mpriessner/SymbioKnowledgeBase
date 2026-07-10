/**
 * Deterministic, paragraph-aware chunker for the immutable Source store (W81-A1).
 *
 * Guarantees (Codex R1):
 *  - **Code-point offsets.** `charStart`/`charEnd` are half-open Unicode
 *    CODE-POINT offsets into `rawText`. JS string indexing is UTF-16, so astral
 *    characters (emoji, rare CJK) would corrupt naive offsets — we operate on a
 *    code-point array (`Array.from`) throughout and never on UTF-16 indices.
 *  - **Exact recoverability.** `chunk.text === codePointSlice(rawText, charStart,
 *    charEnd)` for every chunk. "Trimming" only moves the outer boundaries inward
 *    past whitespace; it never mutates the text, so the invariant always holds.
 *  - **Determinism.** Same `rawText` + same `chunkerVersion` → byte-identical
 *    `chunkIndex`, `charStart/charEnd`, `textSha256` across runs. The token
 *    estimate is a pinned word-count heuristic (no external tokenizer dependency);
 *    changing it requires bumping `CHUNKER_VERSION`.
 *  - **Fingerprint, not identity.** `textSha256` fingerprints content; repeated
 *    paragraphs and overlap legitimately collide. Identity is (sourceId,
 *    chunkIndex).
 *
 * Segmentation: split on blank lines into paragraphs; a paragraph larger than
 * MAX_TOKENS is hard-split at word boundaries into ≤MAX_TOKENS windows. Segments
 * are greedily packed up to TARGET_TOKENS per chunk. Chunks OVERLAP by their
 * final segment (one paragraph or one hard-split window) so a claim spanning a
 * segment boundary appears whole in at least one chunk.
 */

import { computeContentHash } from "@/lib/agent/enrichment/ingestLedger";

/** Pinned chunker identity. Bump on ANY boundary-affecting change. */
export const CHUNKER_VERSION = "v1";

/** Target size to pack a chunk to, in pinned word-tokens. */
const TARGET_TOKENS = 500;
/** Hard cap; a single paragraph above this is hard-split. */
const MAX_TOKENS = 800;

export interface Chunk {
  chunkIndex: number;
  /** Half-open Unicode code-point offsets into rawText. */
  charStart: number;
  charEnd: number;
  text: string;
  textSha256: string;
}

/** A trimmed, non-empty segment: a paragraph or a hard-split window. */
interface Segment {
  start: number; // code-point offset (inclusive)
  end: number; // code-point offset (exclusive)
  tokens: number;
}

/** True for whitespace code points (space, tab, CR, LF, form feed, vtab, NBSP…). */
function isWhitespace(cp: string): boolean {
  return /\s/.test(cp);
}

/**
 * Pinned token estimate: number of whitespace-delimited words in a code-point
 * slice. Deterministic and dependency-free; part of the chunker contract.
 */
function countTokens(cps: string[], start: number, end: number): number {
  let count = 0;
  let inWord = false;
  for (let i = start; i < end; i++) {
    const ws = isWhitespace(cps[i]);
    if (!ws && !inWord) {
      count++;
      inWord = true;
    } else if (ws) {
      inWord = false;
    }
  }
  return count;
}

/** Move [start,end) inward past leading/trailing whitespace (code-point space). */
function trimRange(
  cps: string[],
  start: number,
  end: number
): { start: number; end: number } {
  let s = start;
  let e = end;
  while (s < e && isWhitespace(cps[s])) s++;
  while (e > s && isWhitespace(cps[e - 1])) e--;
  return { start: s, end: e };
}

/**
 * Split rawText's code-point array into blank-line-delimited paragraphs. A blank
 * line = a run of whitespace containing ≥2 line feeds. Returns trimmed,
 * non-empty [start,end) ranges in code-point space.
 */
function splitParagraphs(cps: string[]): Array<{ start: number; end: number }> {
  const paras: Array<{ start: number; end: number }> = [];
  const n = cps.length;
  let i = 0;
  let segStart = 0;
  while (i < n) {
    if (cps[i] === "\n") {
      // Scan the maximal whitespace run starting here; count line feeds.
      let j = i;
      let newlines = 0;
      while (j < n && isWhitespace(cps[j])) {
        if (cps[j] === "\n") newlines++;
        j++;
      }
      if (newlines >= 2) {
        // Paragraph boundary: close the current paragraph, skip the separator.
        const t = trimRange(cps, segStart, i);
        if (t.end > t.start) paras.push(t);
        segStart = j;
        i = j;
        continue;
      }
      i = j; // single newline — stays inside the paragraph
    } else {
      i++;
    }
  }
  const t = trimRange(cps, segStart, n);
  if (t.end > t.start) paras.push(t);
  return paras;
}

/**
 * Hard-split an oversized paragraph into ≤MAX_TOKENS windows at word boundaries.
 * Each window is a trimmed [start,end) range. Deterministic.
 */
function hardSplitParagraph(
  cps: string[],
  pStart: number,
  pEnd: number
): Segment[] {
  // Collect word ranges within the paragraph.
  const words: Array<{ start: number; end: number }> = [];
  let i = pStart;
  while (i < pEnd) {
    while (i < pEnd && isWhitespace(cps[i])) i++;
    if (i >= pEnd) break;
    const ws = i;
    while (i < pEnd && !isWhitespace(cps[i])) i++;
    words.push({ start: ws, end: i });
  }
  const segments: Segment[] = [];
  let w = 0;
  while (w < words.length) {
    const first = words[w];
    let last = w;
    // Pack up to TARGET_TOKENS words per window (never exceeding MAX_TOKENS).
    let count = 0;
    while (last < words.length && count < TARGET_TOKENS) {
      last++;
      count++;
    }
    const segStart = first.start;
    const segEnd = words[last - 1].end;
    segments.push({
      start: segStart,
      end: segEnd,
      tokens: countTokens(cps, segStart, segEnd),
    });
    w = last;
  }
  return segments;
}

/** Build the flat, trimmed segment list from paragraphs (hard-splitting big ones). */
function buildSegments(cps: string[]): Segment[] {
  const segments: Segment[] = [];
  for (const p of splitParagraphs(cps)) {
    const tokens = countTokens(cps, p.start, p.end);
    if (tokens > MAX_TOKENS) {
      segments.push(...hardSplitParagraph(cps, p.start, p.end));
    } else if (tokens > 0) {
      segments.push({ start: p.start, end: p.end, tokens });
    }
  }
  return segments;
}

/**
 * Deterministically chunk `rawText`. `chunkerVersion` is accepted so callers can
 * pin/record it; only CHUNKER_VERSION is currently implemented (a mismatch throws
 * so an unknown version can never silently produce v1 boundaries).
 */
export function chunkText(
  rawText: string,
  chunkerVersion: string = CHUNKER_VERSION
): Chunk[] {
  if (chunkerVersion !== CHUNKER_VERSION) {
    throw new Error(
      `Unknown chunkerVersion "${chunkerVersion}" (this build implements "${CHUNKER_VERSION}")`
    );
  }
  const cps = Array.from(rawText); // code-point array; length = code-point count
  const segments = buildSegments(cps);

  const chunks: Chunk[] = [];
  let cursor = 0;
  let chunkIndex = 0;
  while (cursor < segments.length) {
    // Greedily pack segments from `cursor` up to TARGET_TOKENS (always ≥1).
    let end = cursor;
    let tok = 0;
    while (
      end < segments.length &&
      (end === cursor || tok + segments[end].tokens <= TARGET_TOKENS)
    ) {
      tok += segments[end].tokens;
      end++;
    }
    const lastSeg = end - 1;
    const charStart = segments[cursor].start;
    const charEnd = segments[lastSeg].end;
    const text = cps.slice(charStart, charEnd).join("");
    chunks.push({
      chunkIndex: chunkIndex++,
      charStart,
      charEnd,
      text,
      textSha256: computeContentHash(text),
    });

    if (end >= segments.length) break;
    // Overlap: re-include the final segment of this chunk when the chunk spanned
    // ≥2 segments (guarantees forward progress). A single-segment chunk advances
    // by one with no overlap.
    cursor = lastSeg > cursor ? lastSeg : cursor + 1;
  }
  return chunks;
}
