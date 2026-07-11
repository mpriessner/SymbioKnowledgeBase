/**
 * W81-C1 — tolerant parsing of the local 7B model's short answers. The cheap
 * model is prompted for a tiny, constrained output; these parsers extract the
 * signal and fail SAFE (relevance 0, verdict "no") on garbage so a malformed
 * response never fabricates a finding.
 */

/** Parse a 0..1 relevance score from the model's reply (pass b). */
export function parseRelevanceScore(raw: string): number {
  const m = raw.match(/(?:^|[^\d.])(0(?:\.\d+)?|1(?:\.0+)?)(?![\d.])/);
  if (!m) return 0;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export type ContradictionVerdict = "yes" | "maybe" | "no";

/** Parse a yes/no/maybe disagreement verdict from the model's reply (pass d). */
export function parseContradictionVerdict(raw: string): ContradictionVerdict {
  const t = raw.toLowerCase();
  if (/\byes\b|\bcontradict|\bdisagree/.test(t)) return "yes";
  if (/\bmaybe\b|\bpossibly\b|\bunclear\b|\buncertain\b/.test(t)) return "maybe";
  return "no";
}

/** Severity mapping for a contradiction verdict. */
export function contradictionSeverity(v: ContradictionVerdict): number {
  if (v === "yes") return 0.85;
  if (v === "maybe") return 0.55;
  return 0;
}
