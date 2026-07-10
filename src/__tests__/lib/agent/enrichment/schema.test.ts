import { describe, test, expect } from "vitest";
import {
  slugify,
  conceptActionSchema,
  enrichmentPlanSchema,
} from "@/lib/agent/enrichment/schema";

describe("slugify", () => {
  test("kebab-cases arbitrary titles", () => {
    expect(slugify("Suzuki Coupling!")).toBe("suzuki-coupling");
    expect(slugify("  Pd/C Catalyst  ")).toBe("pd-c-catalyst");
    expect(slugify("")).toBe("untitled");
  });
});

describe("conceptActionSchema", () => {
  const valid = {
    action: "create",
    slug: "Palladium Catalyst",
    title: "Palladium Catalyst",
    description: "A one-sentence summary.",
    body_markdown: "## Body\n\ncontent",
  };

  test("accepts a minimal valid action and normalizes slug", () => {
    const parsed = conceptActionSchema.parse(valid);
    expect(parsed.slug).toBe("palladium-catalyst");
    expect(parsed.type).toBe("concept");
    expect(parsed.tags).toEqual([]);
    expect(parsed.related_slugs).toEqual([]);
  });

  test("normalizes related_slugs", () => {
    const parsed = conceptActionSchema.parse({
      ...valid,
      related_slugs: ["Acme Chem", "lead-time"],
    });
    expect(parsed.related_slugs).toEqual(["acme-chem", "lead-time"]);
  });

  test("rejects an unknown action verb", () => {
    expect(() =>
      conceptActionSchema.parse({ ...valid, action: "delete" })
    ).toThrow();
  });

  test("rejects missing required fields", () => {
    expect(() =>
      conceptActionSchema.parse({ action: "create", slug: "x" })
    ).toThrow();
    expect(() =>
      conceptActionSchema.parse({ ...valid, body_markdown: "" })
    ).toThrow();
  });
});

describe("enrichmentPlanSchema", () => {
  test("accepts an empty-actions plan (nothing worth storing)", () => {
    const parsed = enrichmentPlanSchema.parse({
      reasoning: "nothing to store",
    });
    expect(parsed.actions).toEqual([]);
  });

  test("rejects a plan missing reasoning", () => {
    expect(() => enrichmentPlanSchema.parse({ actions: [] })).toThrow();
  });
});
