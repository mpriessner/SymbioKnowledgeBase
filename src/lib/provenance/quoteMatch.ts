/**
 * Quote-validation gate + provenance hashing for W81-A2 (anti-hallucination).
 *
 * The gate answers a single question: does the model's `quotedText` actually
 * occur in the referenced `SourceChunk.text`? It NEVER trusts the model's
 * string as a citation anchor — it re-derives the CANONICAL source substring
 * (`matchedText`) from the real chunk and hashes THAT. Three explicit states:
 *
 *  - EXACT       — the quote is present verbatim after deterministic
 *                  normalization. `matchedText` is the real chunk substring.
 *  - FUZZY       — the quote is present above a length-aware similarity bar.
 *                  `matchedText` is still the canonical chunk substring, never
 *                  the model's paraphrase — the hash always anchors real source.
 *  - UNVERIFIED  — not locatable. NO hash of source text; the caller stores a
 *                  deterministic SENTINEL hash so the retry-idempotency unique
 *                  index still dedupes, and marks the row machine-unverified.
 *
 * Normalization contract (specified, not implied): Unicode NFC, whitespace
 * folded (runs of whitespace → a single space, leading/trailing trimmed),
 * CASE-PRESERVING. All offsets are Unicode CODE POINTS in NFC space of the chunk
 * (`chunkCharStart/End` are WITHIN-chunk — a different coordinate space from
 * A1's within-rawText offsets). Offsets are a re-locatable HINT; `matchedText`
 * + `quoteSha256` are the durable anchor.
 */

import crypto from "crypto";

export type ValidationState = "EXACT" | "FUZZY" | "UNVERIFIED";

export interface QuoteMatch {
  state: ValidationState;
  /** Canonical source substring for EXACT/FUZZY; null for UNVERIFIED. */
  matchedText: string | null;
  /** Within-chunk NFC code-point offsets (half-open) for EXACT/FUZZY; null otherwise. */
  chunkCharStart: number | null;
  chunkCharEnd: number | null;
  /** Bigram similarity of the located span (1 for EXACT). */
  similarity: number;
  /** True when the quote occurs more than once (resolved to the FIRST match). */
  ambiguous: boolean;
}

// ─── Hashing primitives ─────────────────────────────────────────────────────

/** sha256 hex of a utf-8 string. */
export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

/** NFC + whitespace-folded + trimmed, case-preserving. */
export function normalizeText(s: string): string {
  return s.normalize("NFC").replace(/\s+/g, " ").trim();
}

/** Body anchor: sha256 of the normalized claim text (re-matched into plainText). */
export function computeAnchorTextSha(text: string): string {
  return sha256(normalizeText(text));
}

/**
 * Deterministic claim identity so retries collapse on @@unique([tenantId,
 * claimKey]) instead of minting a new Claim uuid.
 */
export function computeClaimKey(
  pageId: string,
  text: string,
  documentVersionId: string
): string {
  return sha256(`${pageId}${normalizeText(text)}${documentVersionId}`);
}

/**
 * Deterministic sentinel hash for an UNVERIFIED evidence row so the
 * @@unique([claimId, chunkId, quoteSha256]) retry key still dedupes (a NULL
 * quoteSha256 would be DISTINCT-per-row in Postgres and defeat it).
 */
export function unverifiedSentinel(claimId: string, chunkId: string): string {
  return sha256(`${claimId}:${chunkId}:UNVERIFIED`);
}

/**
 * The `quoteSha256` to store for a gate result: EXACT/FUZZY hash the canonical
 * matched source substring; UNVERIFIED uses the sentinel. Centralizes the
 * NOT-NULL invariant so no caller can store a NULL or a model-paraphrase hash.
 */
export function quoteShaFor(
  match: QuoteMatch,
  claimId: string,
  chunkId: string
): string {
  if (match.state === "UNVERIFIED" || match.matchedText === null) {
    return unverifiedSentinel(claimId, chunkId);
  }
  return sha256(normalizeText(match.matchedText));
}

// ─── Length-aware fuzzy threshold ───────────────────────────────────────────

/** Minimum normalized-quote length that may fuzzy-match at all (too-short is unsafe). */
const MIN_FUZZY_CHARS = 12;

/** A short/common quote needs a higher similarity bar than a long distinctive one. */
export function fuzzyThreshold(normalizedQuoteLen: number): number {
  if (normalizedQuoteLen >= 60) return 0.8;
  if (normalizedQuoteLen >= 30) return 0.86;
  return 0.92;
}

// ─── Normalization with an offset map back to the original chunk ─────────────

interface FoldMap {
  /** Folded code points (each element is a single code point). */
  folded: string[];
  /** map[i] = index of folded[i] in the NFC code-point array of the original. */
  map: number[];
  /** NFC code-point array of the original chunk (the coordinate space of offsets). */
  cps: string[];
}

function foldWithMap(nfcText: string): FoldMap {
  const cps = Array.from(nfcText);
  const folded: string[] = [];
  const map: number[] = [];
  let i = 0;
  const n = cps.length;
  // Skip leading whitespace.
  while (i < n && /\s/.test(cps[i])) i++;
  while (i < n) {
    if (/\s/.test(cps[i])) {
      // Collapse a whitespace run to a single space, mapped to its first cp.
      const runStart = i;
      while (i < n && /\s/.test(cps[i])) i++;
      if (i < n) {
        // Only emit the collapsed space if non-whitespace follows (trailing trim).
        folded.push(" ");
        map.push(runStart);
      }
    } else {
      folded.push(cps[i]);
      map.push(i);
      i++;
    }
  }
  return { folded, map, cps };
}

/** Find ALL start indices of `needle` (cp array) in `hay` (cp array). */
function findAll(hay: string[], needle: string[]): number[] {
  const out: number[] = [];
  if (needle.length === 0 || needle.length > hay.length) return out;
  for (let i = 0; i + needle.length <= hay.length; i++) {
    let ok = true;
    for (let j = 0; j < needle.length; j++) {
      if (hay[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

// ─── Bigram (Dice) similarity ───────────────────────────────────────────────

function bigrams(s: string): Map<string, number> {
  const m = new Map<string, number>();
  const cps = Array.from(s);
  for (let i = 0; i + 1 < cps.length; i++) {
    const bg = cps[i] + cps[i + 1];
    m.set(bg, (m.get(bg) ?? 0) + 1);
  }
  return m;
}

export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const A = bigrams(a);
  const B = bigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  let totalA = 0;
  for (const v of A.values()) totalA += v;
  let totalB = 0;
  for (const v of B.values()) totalB += v;
  for (const [bg, ca] of A) {
    const cb = B.get(bg);
    if (cb) overlap += Math.min(ca, cb);
  }
  return (2 * overlap) / (totalA + totalB);
}

// ─── The gate ───────────────────────────────────────────────────────────────

/** Original-chunk substring spanning folded[foldStart..foldEnd) (half-open). */
function originalSpan(
  fm: FoldMap,
  foldStart: number,
  foldEnd: number
): { text: string; start: number; end: number } {
  const start = fm.map[foldStart];
  const lastCp = fm.map[foldEnd - 1];
  const end = lastCp + 1;
  return { text: fm.cps.slice(start, end).join(""), start, end };
}

/**
 * Locate `quotedText` inside `chunkText`. Deterministic; case-preserving.
 * Returns the gate verdict + the canonical source substring + within-chunk
 * NFC code-point offsets.
 */
export function matchQuote(quotedText: string, chunkText: string): QuoteMatch {
  const normQuote = normalizeText(quotedText);
  const chunkNfc = chunkText.normalize("NFC");
  const fm = foldWithMap(chunkNfc);
  const foldedQuote = Array.from(normQuote);

  const UNVERIFIED: QuoteMatch = {
    state: "UNVERIFIED",
    matchedText: null,
    chunkCharStart: null,
    chunkCharEnd: null,
    similarity: 0,
    ambiguous: false,
  };

  if (foldedQuote.length === 0) return UNVERIFIED;

  // EXACT: the normalized quote is a verbatim substring of the folded chunk.
  const hits = findAll(fm.folded, foldedQuote);
  if (hits.length > 0) {
    const span = originalSpan(fm, hits[0], hits[0] + foldedQuote.length);
    return {
      state: "EXACT",
      matchedText: span.text,
      chunkCharStart: span.start,
      chunkCharEnd: span.end,
      similarity: 1,
      ambiguous: hits.length > 1,
    };
  }

  // Too short to fuzzy-match safely → UNVERIFIED.
  if (normQuote.length < MIN_FUZZY_CHARS) return UNVERIFIED;

  // FUZZY: slide word-count-sized windows over the folded chunk, score each.
  const threshold = fuzzyThreshold(normQuote.length);
  const quoteWordCount = normQuote.split(" ").filter(Boolean).length;

  // Word boundaries in the folded array (folded uses single spaces as separators).
  const wordStarts: number[] = [];
  const wordEnds: number[] = [];
  {
    let k = 0;
    const F = fm.folded.length;
    while (k < F) {
      while (k < F && fm.folded[k] === " ") k++;
      if (k >= F) break;
      const ws = k;
      while (k < F && fm.folded[k] !== " ") k++;
      wordStarts.push(ws);
      wordEnds.push(k);
    }
  }
  const W = wordStarts.length;

  let best: QuoteMatch = UNVERIFIED;
  const spans = [
    Math.max(1, quoteWordCount - 2),
    Math.max(1, quoteWordCount - 1),
    Math.max(1, quoteWordCount),
    quoteWordCount + 1,
    quoteWordCount + 2,
  ];
  const seen = new Set<string>();
  for (const span of spans) {
    for (let start = 0; start + span <= W; start++) {
      const key = `${start}:${span}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const foldStart = wordStarts[start];
      const foldEnd = wordEnds[start + span - 1];
      const candidate = fm.folded.slice(foldStart, foldEnd).join("");
      const sim = diceSimilarity(normQuote, candidate);
      if (sim >= threshold && sim > best.similarity) {
        const orig = originalSpan(fm, foldStart, foldEnd);
        best = {
          state: "FUZZY",
          matchedText: orig.text,
          chunkCharStart: orig.start,
          chunkCharEnd: orig.end,
          similarity: sim,
          ambiguous: false,
        };
      }
    }
  }

  return best;
}
