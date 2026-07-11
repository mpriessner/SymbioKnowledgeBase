/**
 * W81-B1 — deterministic `(subject, relation, object, scope)` extraction from a
 * claim's text, for the INLINE (no-LLM) supersession collision check.
 *
 * The inline path is high-precision-or-nothing: it must NEVER auto-supersede a
 * correct claim on a fuzzy guess. So this extractor recognizes only a small,
 * unambiguous family of assertions — a subject, a copula/measurement relation,
 * and a value (optionally unit-bearing) — and returns `null` for anything it
 * cannot resolve with confidence (negation, modality, ranges, multi-clause,
 * unparseable). Those become W81-C1 `CONTRADICTION_CANDIDATE`s, not auto-applied
 * supersessions.
 *
 * COLLISION KEY = `(subject, relation, scope{experimentId, runId, method, units})`.
 * `validPeriod`/`tValid` are deliberately NOT in the key (GLM R2): putting a
 * period in the key makes the future-effective path unreachable. A "collision" is
 * SAME key + DIFFERENT object; the object and the valid-times are compared
 * SEPARATELY by the temporal rule in `supersession.ts`.
 */

/** The part of the triple that participates in collision detection. */
export interface ScopedKey {
  subject: string;
  relation: string;
  scope: {
    experimentId?: string;
    runId?: string;
    method?: string;
    units?: string;
  };
}

export interface ExtractedTriple {
  key: ScopedKey;
  /** The normalized asserted value; a collision is same key + different object. */
  object: string;
  /** Detected unit token (also folded into scope.units), or null. */
  units: string | null;
  /** 0..1 — the caller treats anything below its threshold as "ambiguous → defer". */
  confidence: number;
}

/** Recognized copula / measurement relations, normalized to a canonical verb. */
const RELATION_CANON: Array<{ re: RegExp; canon: string }> = [
  { re: /\b(?:is|are|was|were|be|equals?|=)\b/i, canon: "be" },
  { re: /\b(?:measured|determined|found|observed|recorded)\s+(?:to\s+be|at|as)\b/i, canon: "measure" },
  { re: /\b(?:yielded|gave|afforded|produced)\b/i, canon: "yield" },
];

/**
 * Markers that make a deterministic verdict unsafe — hedging, negation, ranges,
 * comparison, or multi-clause structure. Their presence forces `null` (defer to
 * C1) so the inline path never auto-supersedes on an uncertain reading.
 */
const HEDGE_MARKERS: RegExp[] = [
  /\b(?:may|might|could|should|likely|possibly|probably|perhaps|estimated|expected|assumed|suggests?|appears?|seems?)\b/i,
  /\b(?:not|no|never|without|unless|except)\b/i,
  /\b(?:up to|at least|at most|more than|less than|greater than|between|roughly|around|approximately|about|~|≈|±|\+\/-)\b/i,
  /\b(?:and|or|but|whereas|while|because|although|however|if|when)\b/i,
  /[-–—]\s*\d/, // numeric range like "70-75%"
];

/** Known unit tokens (case-insensitive), longest-first so "mmol" beats "mol". */
const UNIT_TOKENS = [
  "percent", "%",
  "mmol", "mol", "mm", "μm", "um", "nm", "cm",
  "kg", "mg", "µg", "ug", "g",
  "ml", "µl", "ul", "l",
  "°c", "°f", "k",
  "equiv", "eq",
  "hours", "hour", "h", "min", "minutes", "s", "sec",
  "kj/mol", "kcal/mol", "ppm", "hz", "mhz", "ghz", "v", "ma", "a",
];

function normalize(s: string): string {
  return s.normalize("NFC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Strip a leading article and trailing punctuation from a subject phrase. */
function cleanSubject(s: string): string {
  return normalize(s)
    .replace(/^(?:the|a|an|its|their|this|that|these|those)\s+/i, "")
    .replace(/[.,;:]+$/g, "")
    .trim();
}

function cleanObject(s: string): string {
  return normalize(s).replace(/[.,;:]+$/g, "").trim();
}

/** Detect a trailing/embedded unit token in an object value. */
function detectUnits(objectRaw: string): string | null {
  const o = normalize(objectRaw);
  for (const u of UNIT_TOKENS) {
    // unit must be a whole token (bounded by digit/space/edge), not a substring
    const re = new RegExp(`(?:^|[\\d\\s])${u.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|[\\s.,;:])`, "i");
    if (re.test(` ${o} `)) return u;
  }
  return null;
}

/** Pull an explicit scope hint (experiment/run/method) if the text names one. */
function extractScopeHints(text: string): { experimentId?: string; runId?: string; method?: string } {
  const out: { experimentId?: string; runId?: string; method?: string } = {};
  const exp = text.match(/\bexperiment\s+([A-Za-z0-9][A-Za-z0-9._-]{1,40})/i);
  if (exp) out.experimentId = normalize(exp[1]);
  const run = text.match(/\brun\s+([A-Za-z0-9][A-Za-z0-9._-]{0,40})/i);
  if (run) out.runId = normalize(run[1]);
  const method = text.match(/\b(?:via|using|by|method)\s+([A-Za-z0-9][A-Za-z0-9 ._-]{1,40}?)(?:\s+(?:is|was|are|were|gave|yielded)\b|[.,;:]|$)/i);
  if (method) out.method = normalize(method[1]);
  return out;
}

/**
 * Extract a scoped triple from a claim, or `null` when it is not a clean,
 * high-precision single assertion (hedged/negated/ranged/multi-clause/unparsed).
 */
export function extractScopedTriple(text: string): ExtractedTriple | null {
  const raw = text.trim();
  if (raw.length === 0) return null;

  const norm = normalize(raw);

  // Any hedge/negation/range/multi-clause marker → not safe for the inline path.
  for (const m of HEDGE_MARKERS) {
    if (m.test(norm)) return null;
  }

  // Find the FIRST relation verb; everything before is subject, after is object.
  let best: { idx: number; end: number; canon: string } | null = null;
  for (const { re, canon } of RELATION_CANON) {
    const m = norm.match(re);
    if (m && m.index !== undefined) {
      if (best === null || m.index < best.idx) {
        best = { idx: m.index, end: m.index + m[0].length, canon };
      }
    }
  }
  if (!best) return null;

  const subjectRaw = norm.slice(0, best.idx);
  const objectRaw = norm.slice(best.end);
  const subject = cleanSubject(subjectRaw);
  const object = cleanObject(objectRaw);

  // A real assertion needs both a subject and an object; guard against fragments.
  if (subject.length < 2 || object.length === 0) return null;
  // A second relation verb after the first ⇒ multi-clause ⇒ ambiguous.
  for (const { re } of RELATION_CANON) {
    if (re.test(objectRaw)) return null;
  }

  const units = detectUnits(object);
  const scopeHints = extractScopeHints(norm);
  const scope: ScopedKey["scope"] = { ...scopeHints };
  if (units) scope.units = units;

  // Confidence: a numeric, unit-bearing measurement is the most reliable; a
  // bare numeric value is still strong; a non-numeric copula (categorical) is
  // lower and typically below the caller's auto-supersede threshold.
  const hasNumber = /\d/.test(object);
  let confidence: number;
  if (hasNumber && units) confidence = 0.92;
  else if (hasNumber) confidence = 0.85;
  else confidence = 0.6;

  // A long, wordy object is less likely to be a clean atomic value.
  if (object.split(" ").length > 6) confidence = Math.min(confidence, 0.55);

  return {
    key: { subject, relation: best.canon, scope },
    object,
    units,
    confidence,
  };
}

/**
 * Canonical, stable serialization of a scoped key — used both as the collision
 * map key and as the advisory-lock identity (locks are acquired in sorted order
 * of THIS string to avoid cross-key deadlock — GLM R2).
 */
export function scopedKeyString(key: ScopedKey): string {
  const scopeParts = [
    `exp=${key.scope.experimentId ?? ""}`,
    `run=${key.scope.runId ?? ""}`,
    `method=${key.scope.method ?? ""}`,
    `units=${key.scope.units ?? ""}`,
  ].join("|");
  return `${key.subject}${key.relation}${scopeParts}`;
}
