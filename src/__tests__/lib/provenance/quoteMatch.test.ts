import { describe, test, expect } from "vitest";
import {
  matchQuote,
  normalizeText,
  computeClaimKey,
  computeAnchorTextSha,
  unverifiedSentinel,
  quoteShaFor,
  sha256,
  fuzzyThreshold,
  type QuoteMatch,
} from "@/lib/provenance/quoteMatch";

const CHUNK =
  "The Suzuki coupling reaction forms a carbon-carbon bond between an aryl halide and a boronic acid. " +
  "It is catalysed by a palladium(0) complex and requires a base such as potassium carbonate to proceed.";

describe("normalizeText", () => {
  test("NFC + whitespace fold + trim, case-preserving", () => {
    expect(normalizeText("  Hello   World \n\t x ")).toBe("Hello World x");
    // Case is preserved (NOT lowercased).
    expect(normalizeText("PdCl2")).toBe("PdCl2");
  });
  test("NFC-equivalent forms normalize identically", () => {
    // é as composed vs decomposed (e + combining acute).
    const composed = "café";
    const decomposed = "café";
    expect(normalizeText(composed)).toBe(normalizeText(decomposed));
  });
});

describe("matchQuote — EXACT", () => {
  test("verbatim substring is EXACT with canonical source text + offsets", () => {
    const m = matchQuote("forms a carbon-carbon bond", CHUNK);
    expect(m.state).toBe("EXACT");
    expect(m.matchedText).toBe("forms a carbon-carbon bond");
    expect(m.similarity).toBe(1);
    expect(m.chunkCharStart).not.toBeNull();
    expect(m.chunkCharEnd).not.toBeNull();
    // Offsets recover the matched text from the chunk.
    const cps = Array.from(CHUNK.normalize("NFC"));
    expect(cps.slice(m.chunkCharStart!, m.chunkCharEnd!).join("")).toBe(
      m.matchedText
    );
  });

  test("differing whitespace/case-of-spacing still EXACT (normalization)", () => {
    const m = matchQuote("catalysed   by a\npalladium(0) complex", CHUNK);
    expect(m.state).toBe("EXACT");
    // matchedText is the REAL chunk substring (original spacing), not the quote.
    expect(normalizeText(m.matchedText!)).toBe(
      "catalysed by a palladium(0) complex"
    );
  });

  test("case difference is NOT exact (case-preserving normalization)", () => {
    const m = matchQuote("SUZUKI COUPLING", CHUNK);
    // Upper-case is not a verbatim match; short-ish so likely fuzzy or unverified.
    expect(m.state).not.toBe("EXACT");
  });

  test("repeated occurrence flags ambiguity, resolves to first", () => {
    const dup = "alpha beta gamma. alpha beta gamma.";
    const m = matchQuote("alpha beta gamma", dup);
    expect(m.state).toBe("EXACT");
    expect(m.ambiguous).toBe(true);
    expect(m.chunkCharStart).toBe(0);
  });
});

describe("matchQuote — FUZZY", () => {
  test("near-verbatim long quote with a small edit is FUZZY, hashes source", () => {
    // Drop one word + minor change; still highly similar to a long span.
    const m = matchQuote(
      "requires a base such as potassium carbonates to proceed",
      CHUNK
    );
    expect(m.state).toBe("FUZZY");
    expect(m.matchedText).not.toBeNull();
    // Canonical source substring, never the model's paraphrase.
    expect(m.matchedText).toContain("potassium carbonate");
    expect(m.similarity).toBeGreaterThanOrEqual(fuzzyThreshold(m.matchedText!.length));
  });
});

describe("matchQuote — UNVERIFIED (hallucination rejection)", () => {
  test("a fabricated quote not in the chunk is UNVERIFIED, no offsets/text", () => {
    const m = matchQuote(
      "the reaction is performed under high pressure in liquid ammonia",
      CHUNK
    );
    expect(m.state).toBe("UNVERIFIED");
    expect(m.matchedText).toBeNull();
    expect(m.chunkCharStart).toBeNull();
    expect(m.chunkCharEnd).toBeNull();
  });

  test("a too-short non-verbatim quote is UNVERIFIED (not fuzzy)", () => {
    const m = matchQuote("xyzq", CHUNK);
    expect(m.state).toBe("UNVERIFIED");
  });

  test("empty quote is UNVERIFIED", () => {
    expect(matchQuote("", CHUNK).state).toBe("UNVERIFIED");
  });
});

describe("quoteShaFor — sentinel + real hashing", () => {
  test("EXACT/FUZZY hash the canonical matchedText (normalized)", () => {
    const m: QuoteMatch = {
      state: "EXACT",
      matchedText: "forms a carbon-carbon bond",
      chunkCharStart: 0,
      chunkCharEnd: 26,
      similarity: 1,
      ambiguous: false,
    };
    expect(quoteShaFor(m, "claim-1", "chunk-1")).toBe(
      sha256(normalizeText("forms a carbon-carbon bond"))
    );
  });

  test("UNVERIFIED uses the deterministic sentinel (NOT null)", () => {
    const m: QuoteMatch = {
      state: "UNVERIFIED",
      matchedText: null,
      chunkCharStart: null,
      chunkCharEnd: null,
      similarity: 0,
      ambiguous: false,
    };
    const sha = quoteShaFor(m, "claim-1", "chunk-1");
    expect(sha).toBe(unverifiedSentinel("claim-1", "chunk-1"));
    // Deterministic per (claim, chunk) → retries collapse on the unique index.
    expect(sha).toBe(unverifiedSentinel("claim-1", "chunk-1"));
    // Distinct per pair so different chunks don't collide.
    expect(sha).not.toBe(unverifiedSentinel("claim-1", "chunk-2"));
  });

  test("never stores a hash of a fabricated model quote", () => {
    // Even if the model paraphrase differs, UNVERIFIED never hashes it.
    const m = matchQuote("totally fabricated statement here now", CHUNK);
    const sha = quoteShaFor(m, "c", "k");
    expect(sha).toBe(unverifiedSentinel("c", "k"));
    expect(sha).not.toBe(sha256(normalizeText("totally fabricated statement here now")));
  });
});

describe("claimKey idempotency", () => {
  test("same (pageId, text, versionId) → identical key (retries collapse)", () => {
    const a = computeClaimKey("page-1", "Pd(0) catalyses the reaction.", "v-1");
    const b = computeClaimKey("page-1", "Pd(0) catalyses the reaction.", "v-1");
    expect(a).toBe(b);
  });
  test("whitespace-only differences collapse to the same key", () => {
    const a = computeClaimKey("page-1", "Pd(0)  catalyses the   reaction.", "v-1");
    const b = computeClaimKey("page-1", "Pd(0) catalyses the reaction.", "v-1");
    expect(a).toBe(b);
  });
  test("different version mints a different key (per-version snapshot)", () => {
    const a = computeClaimKey("page-1", "same text", "v-1");
    const b = computeClaimKey("page-1", "same text", "v-2");
    expect(a).not.toBe(b);
  });
  test("anchorTextSha is version-independent", () => {
    expect(computeAnchorTextSha("Pd(0)  catalyses.")).toBe(
      computeAnchorTextSha("Pd(0) catalyses.")
    );
  });
});
