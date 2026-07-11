/**
 * W81-C1 — keyset pagination helper. Each pass resumes over `(anchorCol, id)`
 * strictly after its stored watermark, so rows inserted mid-scan are picked up
 * next run and a resume never skips or double-counts (Codex R1). Embedding passes
 * (dedup / contradiction) resume by THIS anchor-entity keyset — never by pgvector
 * similarity order, which has no stable ordering (GLM R2).
 */

import type { Keyset } from "./types";

/**
 * Build the SQL keyset predicate + ordering for `(anchorCol, idCol) > (at, id)`.
 * Returns the predicate/order strings and the two bind params, so a scan reads:
 *   WHERE <base> AND <predicate> ORDER BY <order> LIMIT <n>
 * with params [...baseParams, at, id].
 *
 * `atParam`/`idParam` are the positional placeholders ($N) the caller assigns.
 */
export function keysetClause(
  anchorCol: string,
  idCol: string,
  atParam: string,
  idParam: string
): { predicate: string; order: string } {
  return {
    predicate: `(${anchorCol} > ${atParam} OR (${anchorCol} = ${atParam} AND ${idCol} > ${idParam}))`,
    order: `${anchorCol} ASC, ${idCol} ASC`,
  };
}

/** The next watermark from the last row of a scanned batch. */
export function advanceCursor(
  rows: Array<{ cursorAt: Date; cursorId: string }>
): Keyset | null {
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  return { cursorAt: last.cursorAt, cursorId: last.cursorId };
}
