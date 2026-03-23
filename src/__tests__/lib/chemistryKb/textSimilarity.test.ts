import { describe, test, expect } from "vitest";
import {
  cosineSimilarity,
  extractStatements,
  findSimilarPairs,
} from "@/lib/chemistryKb/textSimilarity";

describe("cosineSimilarity", () => {
  test("identical strings return 1.0", () => {
    const sim = cosineSimilarity(
      "Always degas solvents before use",
      "Always degas solvents before use"
    );
    expect(sim).toBeCloseTo(1.0, 1);
  });

  test("completely different strings return low similarity", () => {
    const sim = cosineSimilarity(
      "Always degas solvents before use",
      "The weather today is sunny and warm"
    );
    expect(sim).toBeLessThan(0.3);
  });

  test("similar statements return high similarity", () => {
    const sim = cosineSimilarity(
      "Always degas solvents before running the reaction",
      "Degas all solvents prior to starting the reaction"
    );
    expect(sim).toBeGreaterThan(0.3);
  });

  test("empty strings return 0", () => {
    expect(cosineSimilarity("", "some text")).toBe(0);
    expect(cosineSimilarity("some text", "")).toBe(0);
    expect(cosineSimilarity("", "")).toBe(0);
  });

  test("single-word strings work correctly", () => {
    const sim = cosineSimilarity("catalyst", "catalyst");
    expect(sim).toBeCloseTo(1.0, 1);
  });

  test("handles chemistry-specific terms", () => {
    const sim = cosineSimilarity(
      "Use Pd(PPh3)4 catalyst at 80C",
      "Pd(PPh3)4 catalyst works best at 80C"
    );
    expect(sim).toBeGreaterThan(0.4);
  });
});

describe("extractStatements", () => {
  test("extracts bullet points from Best Practices section", () => {
    const markdown = `# Page Title

## Best Practices

- Always degas solvents
- Use fresh catalyst
- Monitor temperature carefully

## Other Section

- This should not be extracted
`;

    const statements = extractStatements(markdown);
    expect(statements).toContain("Always degas solvents");
    expect(statements).toContain("Use fresh catalyst");
    expect(statements).toContain("Monitor temperature carefully");
    expect(statements).not.toContain("This should not be extracted");
  });

  test("extracts from Common Pitfalls section", () => {
    const markdown = `## Common Pitfalls

- Old THF gives 10-15% yield drop
- Moisture kills the catalyst
`;

    const statements = extractStatements(markdown);
    expect(statements).toContain("Old THF gives 10-15% yield drop");
    expect(statements).toContain("Moisture kills the catalyst");
  });

  test("extracts from multiple knowledge sections", () => {
    const markdown = `## Best Practices

- Degas solvents

## Tips

- Dr. Mueller recommends 80°C

## Optimizations

- Use microwave heating for faster conversion
`;

    const statements = extractStatements(markdown);
    expect(statements).toHaveLength(3);
  });

  test("strips confidence/attribution tags", () => {
    const markdown = `## Recent Learnings

- Always use fresh catalyst *(from EXP-2026-0042, Dr. Smith)*
- Degas thoroughly *(high confidence)*
`;

    const statements = extractStatements(markdown);
    expect(statements[0]).toBe("Always use fresh catalyst");
    expect(statements[1]).toBe("Degas thoroughly");
  });

  test("returns empty array for content without knowledge sections", () => {
    const markdown = `# Just a Title

Some paragraph text.

## Procedures

1. Step one
2. Step two
`;

    const statements = extractStatements(markdown);
    expect(statements).toEqual([]);
  });

  test("stops at next heading of same or higher level", () => {
    const markdown = `## Best Practices

- Practice one
- Practice two

## Results

- Result one
`;

    const statements = extractStatements(markdown);
    expect(statements).toHaveLength(2);
    expect(statements).not.toContain("Result one");
  });

  test("ignores very short bullet points", () => {
    const markdown = `## Tips

- OK
- This is a valid tip
`;

    const statements = extractStatements(markdown);
    expect(statements).toHaveLength(1);
    expect(statements[0]).toBe("This is a valid tip");
  });
});

describe("findSimilarPairs", () => {
  test("finds similar statement pairs above threshold", () => {
    const statementsA = [
      "Always degas solvents before use",
      "Store catalyst under nitrogen",
    ];
    const statementsB = [
      "Degas all solvents prior to starting",
      "The weather is nice today",
    ];

    const pairs = findSimilarPairs(statementsA, statementsB, 0.3);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
    expect(pairs[0].statementA).toContain("degas");
    expect(pairs[0].statementB).toContain("Degas");
  });

  test("returns empty array when nothing is similar", () => {
    const statementsA = ["Catalyst handling procedures"];
    const statementsB = ["Sunny weather forecast"];

    const pairs = findSimilarPairs(statementsA, statementsB, 0.7);
    expect(pairs).toEqual([]);
  });

  test("returns pairs sorted by similarity descending", () => {
    const statementsA = [
      "Always degas solvents",
      "Use fresh catalyst",
    ];
    const statementsB = [
      "Degas solvents always",
      "Fresh catalyst recommended",
    ];

    const pairs = findSimilarPairs(statementsA, statementsB, 0.3);
    if (pairs.length >= 2) {
      expect(pairs[0].similarity).toBeGreaterThanOrEqual(pairs[1].similarity);
    }
  });

  test("respects custom threshold", () => {
    const a = ["degas solvents before use"];
    const b = ["degas solvents before starting"];

    const lowThreshold = findSimilarPairs(a, b, 0.1);
    const highThreshold = findSimilarPairs(a, b, 0.99);

    expect(lowThreshold.length).toBeGreaterThanOrEqual(highThreshold.length);
  });
});
