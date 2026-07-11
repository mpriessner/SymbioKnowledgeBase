import { describe, test, expect } from "vitest";
import {
  conceptActionSchema,
  citationPlanSchema,
} from "@/lib/agent/enrichment/schema";
import {
  proposeCitations,
  buildCitationPrompt,
} from "@/lib/agent/enrichment/citationAgent";
import type { LlmMessage } from "@/lib/agent/enrichment/enrichmentAgent";

describe("shared schema backward-compat (a71-13 fixtures)", () => {
  test("a ConceptAction WITHOUT claims still validates (optional superset)", () => {
    const parsed = conceptActionSchema.parse({
      action: "create",
      slug: "suzuki-coupling",
      title: "Suzuki Coupling",
      description: "A Pd-catalysed C–C bond formation.",
      body_markdown: "## Body",
    });
    expect(parsed.claims).toBeUndefined();
  });

  test("a ConceptAction WITH claims validates the citation superset", () => {
    const parsed = conceptActionSchema.parse({
      action: "create",
      slug: "s",
      title: "T",
      description: "D",
      body_markdown: "B",
      claims: [
        {
          text: "Pd(0) catalyses the reaction.",
          evidence: [{ chunkIndex: 0, quotedText: "catalysed by a palladium(0) complex" }],
        },
      ],
    });
    expect(parsed.claims).toHaveLength(1);
    // relation/confidence defaulted.
    expect(parsed.claims![0].evidence[0].relation).toBe("SUPPORTS");
    expect(parsed.claims![0].evidence[0].confidence).toBe(0.5);
  });
});

describe("citationPlanSchema", () => {
  test("empty claims default", () => {
    expect(citationPlanSchema.parse({}).claims).toEqual([]);
  });
  test("CONTRADICTS item carries an existing claimId", () => {
    const p = citationPlanSchema.parse({
      claims: [
        {
          text: "X is false",
          evidence: [
            {
              chunkIndex: 1,
              quotedText: "X is actually false",
              relation: "CONTRADICTS",
              claimId: "11111111-1111-4111-8111-111111111111",
            },
          ],
        },
      ],
    });
    expect(p.claims[0].evidence[0].relation).toBe("CONTRADICTS");
    expect(p.claims[0].evidence[0].claimId).toBe(
      "11111111-1111-4111-8111-111111111111"
    );
  });
});

describe("buildCitationPrompt", () => {
  test("includes body, chunkIndex handles, and existing claim ids", () => {
    const prompt = buildCitationPrompt(
      "## Suzuki\nPd(0) catalyses it.",
      [{ chunkIndex: 0, text: "catalysed by a palladium(0) complex" }],
      [{ claimId: "claim-9", text: "Pd(II) catalyses it." }]
    );
    expect(prompt).toContain("chunkIndex 0");
    expect(prompt).toContain("claim-9");
    expect(prompt).toContain("Pd(0) catalyses it.");
  });
});

describe("proposeCitations — self-repair", () => {
  test("parses a valid response on the first attempt", async () => {
    const backend = async () =>
      JSON.stringify({
        claims: [
          {
            text: "Pd(0) catalyses the reaction.",
            evidence: [
              { chunkIndex: 0, quotedText: "palladium(0) complex", relation: "SUPPORTS", confidence: 0.8 },
            ],
          },
        ],
      });
    const plan = await proposeCitations("body", [{ chunkIndex: 0, text: "..." }], [], backend);
    expect(plan.claims).toHaveLength(1);
  });

  test("retries once on invalid JSON, then succeeds", async () => {
    let calls = 0;
    const backend = async (_m: LlmMessage[], _s: string) => {
      calls++;
      return calls === 1 ? "not json" : JSON.stringify({ claims: [] });
    };
    const plan = await proposeCitations("body", [], [], backend);
    expect(calls).toBe(2);
    expect(plan.claims).toEqual([]);
  });

  test("throws after 2 bad attempts (never a silent partial)", async () => {
    const backend = async () => "garbage";
    await expect(proposeCitations("body", [], [], backend)).rejects.toThrow(
      /Citation pass failed/
    );
  });
});
