import { describe, test, expect } from "vitest";
import {
  chunkText,
  CHUNKER_VERSION,
  type Chunk,
} from "@/lib/sources/chunker";
import { computeContentHash } from "@/lib/agent/enrichment/ingestLedger";

/** Recover a chunk's text as the raw code-point slice — the core invariant. */
function codePointSlice(rawText: string, start: number, end: number): string {
  return Array.from(rawText).slice(start, end).join("");
}

function assertExactSlices(rawText: string, chunks: Chunk[]) {
  for (const c of chunks) {
    expect(c.text).toBe(codePointSlice(rawText, c.charStart, c.charEnd));
    expect(c.textSha256).toBe(computeContentHash(c.text));
    // No leading/trailing whitespace after boundary trimming.
    expect(c.text).toBe(c.text.trim());
    expect(c.charStart).toBeLessThanOrEqual(c.charEnd);
    expect(c.charStart).toBeGreaterThanOrEqual(0);
  }
}

describe("chunkText determinism (AC3)", () => {
  test("same rawText → identical index/offsets/hash across runs", () => {
    const raw = "First paragraph here.\n\nSecond paragraph.\n\nThird one.";
    const a = chunkText(raw);
    const b = chunkText(raw);
    expect(a).toEqual(b);
    expect(a.map((c) => c.chunkIndex)).toEqual(
      a.map((_, i) => i)
    );
  });

  test("rejects an unknown chunkerVersion instead of silently using v1", () => {
    expect(() => chunkText("x", "v999")).toThrow(/Unknown chunkerVersion/);
    expect(CHUNKER_VERSION).toBe("v1");
  });
});

describe("code-point offset correctness (A1.12)", () => {
  test("astral characters / emoji do not corrupt offsets", () => {
    const raw =
      "Intro paragraph with emoji 😀 and 𝄞 clef.\n\nSecond 👨‍👩‍👧‍👦 family paragraph.";
    const chunks = chunkText(raw);
    assertExactSlices(raw, chunks);
    // Offsets are code points: total code-point length matches Array.from length.
    const last = chunks[chunks.length - 1];
    expect(last.charEnd).toBeLessThanOrEqual(Array.from(raw).length);
  });

  test("CRLF and LF inputs each recover exactly (verbatim, not normalized)", () => {
    const lf = "Line one.\nLine two.\n\nPara two line.";
    const crlf = "Line one.\r\nLine two.\r\n\r\nPara two line.";
    assertExactSlices(lf, chunkText(lf));
    assertExactSlices(crlf, chunkText(crlf));
    // Different bytes → different content; chunker stays exact for both.
    expect(chunkText(lf)[0].text).not.toContain("\r");
    expect(chunkText(crlf)[0].text).toContain("\r"); // CR preserved mid-paragraph
  });

  test("leading/trailing whitespace is trimmed via offsets, text still equals slice", () => {
    const raw = "   \n\n  Hello world.  \n\n   ";
    const chunks = chunkText(raw);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe("Hello world.");
    assertExactSlices(raw, chunks);
  });
});

describe("segmentation + repeated paragraphs (A1.12)", () => {
  test("repeated identical paragraphs get distinct chunkIndex despite equal textSha256", () => {
    const para = "The reaction was refluxed for two hours.";
    // Force each paragraph into its own chunk by making them big enough is hard;
    // instead give many identical small paragraphs and confirm any duplicate
    // texts still carry distinct (chunkIndex).
    const raw = Array(40).fill(para).join("\n\n");
    const chunks = chunkText(raw);
    assertExactSlices(raw, chunks);
    const indices = chunks.map((c) => c.chunkIndex);
    expect(new Set(indices).size).toBe(indices.length); // all distinct
  });

  test("an oversized single paragraph is hard-split into multiple chunks", () => {
    const big = Array(2000).fill("word").join(" ");
    const chunks = chunkText(big);
    expect(chunks.length).toBeGreaterThan(1);
    assertExactSlices(big, chunks);
  });

  test("empty / whitespace-only input yields zero chunks", () => {
    expect(chunkText("")).toEqual([]);
    expect(chunkText("   \n\n\t  ")).toEqual([]);
  });

  test("chunks overlap by their final segment when a chunk spans multiple segments", () => {
    // Many medium paragraphs so a chunk packs several segments and overlaps.
    const paras = Array.from({ length: 30 }, (_, i) =>
      `Paragraph number ${i} ${Array(30).fill("filler").join(" ")}`
    );
    const raw = paras.join("\n\n");
    const chunks = chunkText(raw);
    expect(chunks.length).toBeGreaterThan(1);
    assertExactSlices(raw, chunks);
    // Overlap ⇒ some chunk starts before the previous chunk ended.
    let overlaps = 0;
    for (let i = 1; i < chunks.length; i++) {
      if (chunks[i].charStart < chunks[i - 1].charEnd) overlaps++;
    }
    expect(overlaps).toBeGreaterThan(0);
  });
});
