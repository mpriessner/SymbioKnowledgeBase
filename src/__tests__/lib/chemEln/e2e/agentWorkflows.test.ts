import { describe, it, expect, beforeAll } from "vitest";

import {
  createTestDataset,
  REFERENCE_DATE,
  EXPERIMENTS,
  RESEARCHERS,
  buildFindSimilarRef,
} from "./testDataFactory";

import {
  findSimilarExperiments,
  buildSimilarityContext,
  formatSimilarExperimentsForAgent,
} from "@/lib/chemEln/retrieval/findSimilar";
import type { SimilarityQuery } from "@/lib/chemEln/retrieval/findSimilar";

import {
  findWhoHasExperience,
  formatExperienceResultsForAgent,
} from "@/lib/chemEln/retrieval/whoHasExperience";
import type { ExperienceQuery, ExperienceDataSources } from "@/lib/chemEln/retrieval/whoHasExperience";

import {
  searchByTags,
  parseTagQuery,
} from "@/lib/chemEln/retrieval/tagSearch";

import { aggregateKbStats } from "@/lib/chemEln/retrieval/statsAggregator";
import { generateEnhancedIndexPage } from "@/lib/chemEln/retrieval/indexPage";

import {
  extractKeyLearnings,
  aggregateLearningsForReactionType,
} from "@/lib/chemEln/enrichment/keyLearnings";

import {
  computeAllExpertise,
} from "@/lib/chemEln/enrichment/expertiseComputation";

import { getWhoToAsk, generateWhoToAskSection } from "@/lib/chemEln/enrichment/whoToAsk";

// ---------------------------------------------------------------------------
// Shared dataset — built once
// ---------------------------------------------------------------------------
let dataset: ReturnType<typeof createTestDataset>;

beforeAll(() => {
  dataset = createTestDataset();
});

// ===========================================================================
// Scenario 1: "How do I run a Suzuki coupling?"
//
// Flow: tag search by reaction type -> find similar experiments -> key learnings
// ===========================================================================
describe("Scenario 1: How do I run a Suzuki coupling?", () => {
  it("should find Suzuki coupling experiments via tag search", () => {
    const query = parseTagQuery("reaction:suzuki-coupling");
    const results = searchByTags(query, dataset.pagesWithTags);

    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const r of results) {
      expect(r.matchedTags).toContain("reaction:suzuki-coupling");
    }
  });

  it("should find similar experiments when searching by reaction type", () => {
    const query: SimilarityQuery = {
      reactionType: "Suzuki Coupling",
      limit: 10,
    };
    const results = findSimilarExperiments(query, dataset.experimentEntries);

    expect(results.length).toBeGreaterThanOrEqual(3);

    // Top results should be Suzuki Coupling (highest score from reaction type match)
    const suzukiResults = results.filter((r) => r.reactionType === "Suzuki Coupling");
    expect(suzukiResults.length).toBeGreaterThanOrEqual(3);

    // All Suzuki results should have a match reason about reaction type
    for (const r of suzukiResults) {
      expect(r.score).toBeGreaterThan(0);
      expect(r.matchReasons.some((m) => m.includes("Same reaction type"))).toBe(true);
    }

    // Suzuki results should rank above non-Suzuki results
    const topSuzukiScore = suzukiResults[0].score;
    const nonSuzuki = results.filter((r) => r.reactionType !== "Suzuki Coupling");
    if (nonSuzuki.length > 0) {
      expect(topSuzukiScore).toBeGreaterThan(nonSuzuki[0].score);
    }
  });

  it("should extract key learnings from Suzuki coupling experiments", () => {
    const suzukiExps = dataset.experimentsWithNotes.filter(
      (e) => e.id.startsWith("EXP-") && dataset.experiments.find((x) => x.id === e.id)?.reactionType === "Suzuki Coupling"
    );

    const learnings = extractKeyLearnings(suzukiExps, "Suzuki Coupling");

    expect(learnings.length).toBeGreaterThan(0);

    const allText = learnings.map((l) => l.text).join(" ").toLowerCase();
    expect(allText).toMatch(/degass|thf|boronic|yield|protodeboronation/i);
  });

  it("should produce aggregated learnings with best conditions", () => {
    const suzukiExps = dataset.experimentsWithNotes.filter(
      (e) => dataset.experiments.find((x) => x.id === e.id)?.reactionType === "Suzuki Coupling"
    );

    const aggregated = aggregateLearningsForReactionType("Suzuki Coupling", suzukiExps);

    expect(aggregated.keyLearnings.length).toBeGreaterThan(0);
    expect(aggregated.bestConditions.solvent).toBeTruthy();
    expect(aggregated.bestConditions.catalyst).toBeTruthy();

    // Verify practical tips and conditions are surfaced
    const tipTexts = aggregated.keyLearnings.map((l) => l.text).join(" ");
    expect(tipTexts.length).toBeGreaterThan(50);
  });

  it("should format similar experiments with wikilinks and citations", () => {
    const query: SimilarityQuery = { reactionType: "Suzuki Coupling", limit: 5 };
    const results = findSimilarExperiments(query, dataset.experimentEntries);
    const formatted = formatSimilarExperimentsForAgent(results);

    expect(formatted).toContain("## Similar Experiments");
    expect(formatted).toContain("[[EXP-2026-0042]]");
    expect(formatted).toContain("[[Dr. Anna Mueller]]");
    expect(formatted).toContain("Yield:");
    expect(formatted).toContain("Quality:");
  });
});

// ===========================================================================
// Scenario 2: "Who is the expert on Grignard reactions?"
//
// Flow: whoHasExperience with reaction topic -> verify ranking
// ===========================================================================
describe("Scenario 2: Who is the expert on Grignard reactions?", () => {
  let profiles: ReturnType<typeof computeAllExpertise>;

  beforeAll(() => {
    profiles = computeAllExpertise(
      dataset.researchersWithExperiments,
      REFERENCE_DATE
    );
  });

  it("should find researchers with Grignard experience", () => {
    const query: ExperienceQuery = {
      topic: "Grignard Reaction",
      topicType: "reaction",
      includeInactive: true,
    };

    const dataSources: ExperienceDataSources = {
      profiles,
      experiments: dataset.experimentRefs,
      researcherEmails: dataset.researcherEmails,
      referenceDate: REFERENCE_DATE,
    };

    const results = findWhoHasExperience(query, dataSources);

    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("should rank Dr. Wei Chen first for Grignard reactions", () => {
    const query: ExperienceQuery = {
      topic: "Grignard Reaction",
      topicType: "reaction",
      includeInactive: true,
    };

    const dataSources: ExperienceDataSources = {
      profiles,
      experiments: dataset.experimentRefs,
      researcherEmails: dataset.researcherEmails,
      referenceDate: REFERENCE_DATE,
    };

    const results = findWhoHasExperience(query, dataSources);

    expect(results[0].researcherName).toBe("Dr. Wei Chen");
    expect(results[0].experimentCount).toBe(2);
    expect(results[0].expertiseScore).toBeGreaterThan(0);
  });

  it("should reflect experiment count and quality in expertise score", () => {
    const query: ExperienceQuery = {
      topic: "Grignard Reaction",
      topicType: "reaction",
      includeInactive: true,
    };

    const dataSources: ExperienceDataSources = {
      profiles,
      experiments: dataset.experimentRefs,
      researcherEmails: dataset.researcherEmails,
      referenceDate: REFERENCE_DATE,
    };

    const results = findWhoHasExperience(query, dataSources);
    const chen = results.find((r) => r.researcherName === "Dr. Wei Chen")!;
    const patel = results.find((r) => r.researcherName === "Dr. Anika Patel")!;

    // Chen has 2 Grignard experiments (quality 5 and 4), Patel has 1 (quality 3)
    expect(chen.expertiseScore).toBeGreaterThan(patel.expertiseScore);
    expect(chen.experimentCount).toBeGreaterThan(patel.experimentCount);
  });

  it("should format experience results with researcher wikilinks", () => {
    const query: ExperienceQuery = {
      topic: "Grignard Reaction",
      topicType: "reaction",
      includeInactive: true,
    };

    const dataSources: ExperienceDataSources = {
      profiles,
      experiments: dataset.experimentRefs,
      researcherEmails: dataset.researcherEmails,
      referenceDate: REFERENCE_DATE,
    };

    const results = findWhoHasExperience(query, dataSources);
    const formatted = formatExperienceResultsForAgent(results, query);

    expect(formatted).toContain("## Who Has Experience: Grignard Reaction");
    expect(formatted).toContain("[[Dr. Wei Chen]]");
    expect(formatted).toContain("Experiments:");
    expect(formatted).toContain("Recommendation:");
  });

  it("should also surface via whoToAsk for reaction context", () => {
    const result = getWhoToAsk({
      type: "reaction",
      reactionType: "Grignard Reaction",
      expertiseProfiles: profiles,
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].researcherName).toBe("Dr. Wei Chen");
    expect(result.context).toContain("Grignard Reaction");

    const section = generateWhoToAskSection(result);
    expect(section).toContain("## Who To Ask");
    expect(section).toContain("[[Dr. Wei Chen]]");
  });
});

// ===========================================================================
// Scenario 3: "Find experiments similar to EXP-2026-0042"
//
// Flow: build similarity context from reference -> findSimilar -> rank
// ===========================================================================
describe("Scenario 3: Find experiments similar to EXP-2026-0042", () => {
  it("should build a similarity context from the reference experiment", () => {
    const ref = buildFindSimilarRef("EXP-2026-0042");
    const context = buildSimilarityContext(ref);

    expect(context.reactionType).toBe("Suzuki Coupling");
    expect(context.substrateClass).toBe("heteroaryl");
    expect(context.chemicals).toContain("Pd(PPh3)4");
    expect(context.researcher).toBe("Dr. Anna Mueller");
    expect(context.scaleCategory).toBe("medium");
  });

  it("should find similar experiments scored and ranked", () => {
    const ref = buildFindSimilarRef("EXP-2026-0042");
    const context = buildSimilarityContext(ref);
    const results = findSimilarExperiments(context, dataset.experimentEntries);

    expect(results.length).toBeGreaterThanOrEqual(3);

    // Should be sorted by score descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }

    // The reference experiment itself should rank high (same reaction, substrate, chemicals)
    const selfMatch = results.find((r) => r.experimentTitle === "EXP-2026-0042");
    expect(selfMatch).toBeDefined();
    expect(selfMatch!.score).toBeGreaterThan(5);
  });

  it("should provide meaningful match reasons", () => {
    const ref = buildFindSimilarRef("EXP-2026-0042");
    const context = buildSimilarityContext(ref);
    const results = findSimilarExperiments(context, dataset.experimentEntries);

    // Top results for Suzuki heteroaryl should mention reaction type and substrate
    const topResult = results[0];
    const allReasons = topResult.matchReasons.join(" ");
    expect(allReasons).toContain("Same reaction type");
  });

  it("should rank other heteroaryl Suzuki experiments higher than aryl ones", () => {
    const ref = buildFindSimilarRef("EXP-2026-0042");
    const context = buildSimilarityContext(ref);
    const results = findSimilarExperiments(context, dataset.experimentEntries);

    // Find a heteroaryl result and an aryl-only result
    const heteroarylResults = results.filter((r) => {
      const exp = EXPERIMENTS.find((e) => e.id === r.experimentTitle);
      return exp?.substrateClasses.includes("heteroaryl") && r.experimentTitle !== "EXP-2026-0042";
    });
    const arylOnlyResults = results.filter((r) => {
      const exp = EXPERIMENTS.find((e) => e.id === r.experimentTitle);
      return exp?.substrateClasses.includes("aryl") && !exp?.substrateClasses.includes("heteroaryl");
    });

    if (heteroarylResults.length > 0 && arylOnlyResults.length > 0) {
      // Best heteroaryl should score higher than best aryl-only
      expect(heteroarylResults[0].score).toBeGreaterThan(arylOnlyResults[0].score);
    }
  });
});

// ===========================================================================
// Scenario 4: "What challenges do people face with heteroaryl substrates?"
//
// Flow: tag search by substrate class -> extract practical notes/challenges
// ===========================================================================
describe("Scenario 4: What challenges do people face with heteroaryl substrates?", () => {
  it("should find experiments tagged with heteroaryl substrate class", () => {
    const query = parseTagQuery("substrate-class:heteroaryl");
    const results = searchByTags(query, dataset.pagesWithTags);

    expect(results.length).toBeGreaterThanOrEqual(3);
    for (const r of results) {
      expect(r.matchedTags).toContain("substrate-class:heteroaryl");
    }
  });

  it("should surface protodeboronation challenges from matching experiments", () => {
    // Filter experiments with heteroaryl substrate class
    const heteroarylExps = dataset.experimentsWithNotes.filter((e) => {
      const exp = EXPERIMENTS.find((x) => x.id === e.id);
      return exp?.substrateClasses.includes("heteroaryl");
    });

    const learnings = extractKeyLearnings(heteroarylExps, "heteroaryl substrates");

    expect(learnings.length).toBeGreaterThan(0);

    // Should contain warnings/challenges about protodeboronation
    const warnings = learnings.filter((l) => l.category === "warning");
    expect(warnings.length).toBeGreaterThan(0);

    const allChallengeText = warnings.map((w) => w.text).join(" ").toLowerCase();
    expect(allChallengeText).toMatch(/protodeboronation|yield|oxygen|catalyst/i);
  });

  it("should find heteroaryl experiments with protodeboronation challenge tag", () => {
    const query = parseTagQuery("substrate-class:heteroaryl AND challenge:protodeboronation");
    const results = searchByTags(query, dataset.pagesWithTags);

    expect(results.length).toBeGreaterThanOrEqual(2);
    for (const r of results) {
      expect(r.matchedTags).toContain("substrate-class:heteroaryl");
      expect(r.matchedTags).toContain("challenge:protodeboronation");
    }
  });
});

// ===========================================================================
// Scenario 5: "Show me high-quality large-scale experiments"
//
// Flow: tag search with "scale:large AND quality:4+"
// ===========================================================================
describe("Scenario 5: Show me high-quality large-scale experiments", () => {
  it("should parse combined tag query correctly", () => {
    const query = parseTagQuery("scale:large AND quality:4+");
    expect(query.tags).toEqual(["scale:large", "quality:4+"]);
    expect(query.operator).toBe("AND");
  });

  it("should filter experiments matching both scale and quality criteria", () => {
    const query = parseTagQuery("scale:large AND quality:4+");
    const results = searchByTags(query, dataset.pagesWithTags);

    expect(results.length).toBeGreaterThanOrEqual(1);

    for (const r of results) {
      // Verify each result has the correct tags
      expect(r.matchedTags).toContain("scale:large");
      expect(r.matchedTags).toContain("quality:4+");

      // Verify the underlying experiment data
      const exp = EXPERIMENTS.find((e) => e.id === r.page.id);
      expect(exp).toBeDefined();
      expect(exp!.scaleCategory).toBe("large");
      expect(exp!.qualityScore).toBeGreaterThanOrEqual(4);
    }
  });

  it("should include EXP-2026-0044 (Suzuki scale-up) and EXP-2026-0050 (Grignard large)", () => {
    const query = parseTagQuery("scale:large AND quality:4+");
    const results = searchByTags(query, dataset.pagesWithTags);

    const resultIds = results.map((r) => r.page.id);
    expect(resultIds).toContain("EXP-2026-0044");
    expect(resultIds).toContain("EXP-2026-0050");
  });

  it("should not include small-scale or low-quality experiments", () => {
    const query = parseTagQuery("scale:large AND quality:4+");
    const results = searchByTags(query, dataset.pagesWithTags);

    const resultIds = results.map((r) => r.page.id);
    // EXP-2025-0289 is small scale quality 3 — should not appear
    expect(resultIds).not.toContain("EXP-2025-0289");
    // EXP-2025-0400 is small scale quality 3 — should not appear
    expect(resultIds).not.toContain("EXP-2025-0400");
  });

  it("should also support pilot scale queries", () => {
    const query = parseTagQuery("scale:pilot");
    const results = searchByTags(query, dataset.pagesWithTags);

    expect(results.length).toBe(1);
    expect(results[0].page.id).toBe("EXP-2026-0051");
  });
});

// ===========================================================================
// Scenario 6: "Generate the KB index page"
//
// Flow: aggregate stats -> generate index page -> validate sections
// ===========================================================================
describe("Scenario 6: Generate the KB index page", () => {
  it("should aggregate stats from test data", () => {
    const stats = aggregateKbStats(dataset.aggregatorInput);

    expect(stats.totalExperiments).toBe(EXPERIMENTS.length);
    expect(stats.totalChemicals).toBe(dataset.chemicals.length);
    expect(stats.totalResearchers).toBe(RESEARCHERS.length);
  });

  it("should count experiments per reaction type correctly", () => {
    const stats = aggregateKbStats(dataset.aggregatorInput);

    const suzuki = stats.reactionTypes.find((rt) => rt.name === "Suzuki Coupling");
    const grignard = stats.reactionTypes.find((rt) => rt.name === "Grignard Reaction");
    const buchwald = stats.reactionTypes.find((rt) => rt.name === "Buchwald-Hartwig Amination");

    expect(suzuki).toBeDefined();
    expect(suzuki!.experimentCount).toBe(5);

    expect(grignard).toBeDefined();
    expect(grignard!.experimentCount).toBe(3);

    expect(buchwald).toBeDefined();
    expect(buchwald!.experimentCount).toBe(3);
  });

  it("should rank researchers by experiment count", () => {
    const stats = aggregateKbStats(dataset.aggregatorInput);

    expect(stats.topResearchers.length).toBeGreaterThanOrEqual(3);
    // Dr. Anna Mueller has 4 experiments (3 Suzuki + 1 Buchwald)
    expect(stats.topResearchers[0].name).toBe("Dr. Anna Mueller");
    expect(stats.topResearchers[0].experimentCount).toBe(4);
  });

  it("should generate enhanced index page with all sections", () => {
    const stats = aggregateKbStats(dataset.aggregatorInput);
    const indexPage = generateEnhancedIndexPage(stats);

    // Header and frontmatter
    expect(indexPage).toContain("# Chemistry KB Index");
    expect(indexPage).toContain("type: index");

    // Quick Stats
    expect(indexPage).toContain(`**Total Experiments:** ${EXPERIMENTS.length}`);
    expect(indexPage).toContain(`**Total Chemicals:** ${dataset.chemicals.length}`);
    expect(indexPage).toContain(`**Total Researchers:** ${RESEARCHERS.length}`);

    // Reaction Types with wikilinks
    expect(indexPage).toContain("## Reaction Types");
    expect(indexPage).toContain("[[Suzuki Coupling]]");
    expect(indexPage).toContain("[[Grignard Reaction]]");
    expect(indexPage).toContain("[[Buchwald-Hartwig Amination]]");

    // Recent Experiments
    expect(indexPage).toContain("## Recent Experiments");

    // Researcher Directory
    expect(indexPage).toContain("## Researcher Directory");
    expect(indexPage).toContain("[[Dr. Anna Mueller]]");

    // Agent instructions
    expect(indexPage).toContain("## How Agents Should Use This KB");

    // Tag taxonomy
    expect(indexPage).toContain("## Tag Taxonomy Quick Reference");
  });

  it("should include valid wikilinks throughout", () => {
    const stats = aggregateKbStats(dataset.aggregatorInput);
    const indexPage = generateEnhancedIndexPage(stats);

    // Extract all wikilinks
    const wikilinks = indexPage.match(/\[\[[^\]]+\]\]/g) || [];
    expect(wikilinks.length).toBeGreaterThan(5);

    // Each wikilink should be non-empty
    for (const link of wikilinks) {
      const content = link.slice(2, -2);
      expect(content.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// Cross-cutting: End-to-end multi-step workflow
// ===========================================================================
describe("Cross-cutting: full retrieval pipeline", () => {
  it("should chain tag search -> findSimilar -> keyLearnings for Suzuki heteroaryl", () => {
    // Step 1: Tag search to find relevant experiments
    const tagQuery = parseTagQuery("reaction:suzuki-coupling AND substrate-class:heteroaryl");
    const tagResults = searchByTags(tagQuery, dataset.pagesWithTags);
    expect(tagResults.length).toBeGreaterThanOrEqual(3);

    // Step 2: Use top result to find similar experiments
    const topExpId = tagResults[0].page.id;
    const ref = buildFindSimilarRef(topExpId);
    const context = buildSimilarityContext(ref);
    const similar = findSimilarExperiments(context, dataset.experimentEntries);
    expect(similar.length).toBeGreaterThanOrEqual(3);

    // Step 3: Extract key learnings from the similar experiments
    const similarIds = similar.map((s) => s.experimentTitle);
    const relevantExps = dataset.experimentsWithNotes.filter((e) => similarIds.includes(e.id));
    const learnings = extractKeyLearnings(relevantExps, "Suzuki Coupling");
    expect(learnings.length).toBeGreaterThan(0);

    // Step 4: Verify pipeline produces actionable output
    const allLearningText = learnings.map((l) => l.text).join("\n");
    expect(allLearningText.length).toBeGreaterThan(100);
  });

  it("should chain expertise computation -> whoHasExperience -> whoToAsk for Buchwald-Hartwig", () => {
    // Step 1: Compute expertise profiles
    const profiles = computeAllExpertise(
      dataset.researchersWithExperiments,
      REFERENCE_DATE
    );
    expect(profiles.length).toBeGreaterThanOrEqual(3);

    // Step 2: Find who has experience with Buchwald-Hartwig
    const query: ExperienceQuery = {
      topic: "Buchwald-Hartwig Amination",
      topicType: "reaction",
      includeInactive: true,
    };
    const dataSources: ExperienceDataSources = {
      profiles,
      experiments: dataset.experimentRefs,
      researcherEmails: dataset.researcherEmails,
      referenceDate: REFERENCE_DATE,
    };
    const experienceResults = findWhoHasExperience(query, dataSources);
    expect(experienceResults.length).toBeGreaterThanOrEqual(2);

    // Step 3: Dr. Kenji Tanaka should rank first (2 recent high-quality experiments)
    expect(experienceResults[0].researcherName).toBe("Dr. Kenji Tanaka");

    // Step 4: Verify whoToAsk also produces correct ranking
    const whoToAskResult = getWhoToAsk({
      type: "reaction",
      reactionType: "Buchwald-Hartwig Amination",
      expertiseProfiles: profiles,
    });
    expect(whoToAskResult.recommendations[0].researcherName).toBe("Dr. Kenji Tanaka");

    // Step 5: Format results
    const formatted = formatExperienceResultsForAgent(experienceResults, query);
    expect(formatted).toContain("[[Dr. Kenji Tanaka]]");
    expect(formatted).toContain("Buchwald-Hartwig Amination");
  });

  it("should support substrate-based whoToAsk queries", () => {
    const profiles = computeAllExpertise(
      dataset.researchersWithExperiments,
      REFERENCE_DATE
    );

    const result = getWhoToAsk({
      type: "substrate",
      substrateClass: "heteroaryl",
      experiments: dataset.experimentRefs,
      expertiseProfiles: profiles,
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.context).toContain("heteroaryl");

    const section = generateWhoToAskSection(result);
    expect(section).toContain("## Who To Ask");
  });
});
