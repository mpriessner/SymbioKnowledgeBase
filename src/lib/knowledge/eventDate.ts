/**
 * W81-B1 — derive a Source's world event-date + precision from its filename / doc
 * metadata (mirrors `llm-wiki-builder`'s timeline convention). Distinct from
 * ingest time: this is WHEN the artifact's content is dated in the world, which
 * seeds `Claim.tValid`.
 *
 * Precision matters for temporal safety: only an EXACT/APPROX date participates
 * in auto-supersession; an unparseable date is UNKNOWN and never auto-supersedes.
 * A month/year-only date is APPROX (day-of-month unknown), so the supersession
 * rule can treat it conservatively.
 */

export type DatePrecision = "EXACT" | "APPROX" | "UNKNOWN";

export interface ParsedEventDate {
  eventDate: Date | null;
  precision: DatePrecision;
}

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8,
  sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

const UNKNOWN: ParsedEventDate = { eventDate: null, precision: "UNKNOWN" };

/** Build a UTC date at midnight, guarding against invalid day/month rollover. */
function utc(y: number, m: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, m, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m || dt.getUTCDate() !== d) {
    return null;
  }
  return dt;
}

/**
 * Parse the first recognizable date out of a free-form string (typically a
 * source title / filename). Returns UNKNOWN when nothing parses.
 */
export function parseEventDate(text: string | null | undefined): ParsedEventDate {
  if (!text) return UNKNOWN;
  const s = text.trim();

  // 1. Full ISO / ymd — 2026-06-14, 2026/06/14, 20260614 → EXACT.
  const iso = s.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) {
    const dt = utc(+iso[1], +iso[2] - 1, +iso[3]);
    if (dt) return { eventDate: dt, precision: "EXACT" };
  }
  const compact = s.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (compact) {
    const dt = utc(+compact[1], +compact[2] - 1, +compact[3]);
    if (dt) return { eventDate: dt, precision: "EXACT" };
  }

  // 2. "14 June 2026" / "June 14, 2026" → EXACT.
  const dmy = s.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (dmy && MONTHS[dmy[2].toLowerCase()] !== undefined) {
    const dt = utc(+dmy[3], MONTHS[dmy[2].toLowerCase()], +dmy[1]);
    if (dt) return { eventDate: dt, precision: "EXACT" };
  }
  const mdy = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/);
  if (mdy && MONTHS[mdy[1].toLowerCase()] !== undefined) {
    const dt = utc(+mdy[3], MONTHS[mdy[1].toLowerCase()], +mdy[2]);
    if (dt) return { eventDate: dt, precision: "EXACT" };
  }

  // 3. Month + year only ("June 2026", "2026-06") → APPROX (first of the month).
  const my = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{4})\b/);
  if (my && MONTHS[my[1].toLowerCase()] !== undefined) {
    const dt = utc(+my[2], MONTHS[my[1].toLowerCase()], 1);
    if (dt) return { eventDate: dt, precision: "APPROX" };
  }
  const ym = s.match(/\b(\d{4})[-/](\d{1,2})\b/);
  if (ym) {
    const mo = +ym[2] - 1;
    if (mo >= 0 && mo <= 11) {
      const dt = utc(+ym[1], mo, 1);
      if (dt) return { eventDate: dt, precision: "APPROX" };
    }
  }

  // 4. Bare year → APPROX (first of the year).
  const y = s.match(/\b(19|20)\d{2}\b/);
  if (y) {
    const dt = utc(+y[0], 0, 1);
    if (dt) return { eventDate: dt, precision: "APPROX" };
  }

  return UNKNOWN;
}
