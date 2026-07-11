import { describe, test, expect } from "vitest";
import { parseEventDate } from "@/lib/knowledge/eventDate";

describe("parseEventDate", () => {
  test("full ISO date → EXACT", () => {
    const r = parseEventDate("2026-06-14 lab notes.txt");
    expect(r.precision).toBe("EXACT");
    expect(r.eventDate?.toISOString().slice(0, 10)).toBe("2026-06-14");
  });

  test("'14 June 2026' → EXACT", () => {
    const r = parseEventDate("Meeting 14 June 2026");
    expect(r.precision).toBe("EXACT");
    expect(r.eventDate?.toISOString().slice(0, 10)).toBe("2026-06-14");
  });

  test("month + year only → APPROX (first of month)", () => {
    const r = parseEventDate("June 2026 summary");
    expect(r.precision).toBe("APPROX");
    expect(r.eventDate?.toISOString().slice(0, 10)).toBe("2026-06-01");
  });

  test("bare year → APPROX (first of year)", () => {
    const r = parseEventDate("notes from 2026");
    expect(r.precision).toBe("APPROX");
    expect(r.eventDate?.toISOString().slice(0, 10)).toBe("2026-01-01");
  });

  test("no date → UNKNOWN / null", () => {
    const r = parseEventDate("random-notes.txt");
    expect(r.precision).toBe("UNKNOWN");
    expect(r.eventDate).toBeNull();
  });

  test("null input → UNKNOWN", () => {
    expect(parseEventDate(null).precision).toBe("UNKNOWN");
  });
});
