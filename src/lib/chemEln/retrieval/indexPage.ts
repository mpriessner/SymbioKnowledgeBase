export interface ReactionTypeSummary {
  name: string;
  experimentCount: number;
}

export interface RecentExperimentSummary {
  title: string;
  date: string;
  reactionType: string;
}

export interface TopResearcherSummary {
  name: string;
  experimentCount: number;
}

export interface KbStats {
  totalExperiments: number;
  totalChemicals: number;
  totalResearchers: number;
  reactionTypes: ReactionTypeSummary[];
  recentExperiments: RecentExperimentSummary[];
  topResearchers: TopResearcherSummary[];
}

export function generateEnhancedIndexPage(stats: KbStats): string {
  const today = new Date().toISOString().split("T")[0];

  const sortedReactionTypes = [...stats.reactionTypes].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const reactionTypesList = sortedReactionTypes
    .map((rt) => `- [[${rt.name}]] (${rt.experimentCount} experiments)`)
    .join("\n");

  const recentExpList =
    stats.recentExperiments.length > 0
      ? stats.recentExperiments
          .slice(0, 5)
          .map(
            (exp) =>
              `- [[${exp.title}]] — ${exp.reactionType} (${exp.date})`
          )
          .join("\n")
      : "- No recent experiments";

  const researcherList =
    stats.topResearchers.length > 0
      ? stats.topResearchers
          .map(
            (r) => `- [[${r.name}]] (${r.experimentCount} experiments)`
          )
          .join("\n")
      : "- No researchers yet";

  return `---
type: index
category: chemistry
title: Chemistry KB Index
updated: ${today}
---

# Chemistry KB Index

Welcome to the Chemistry Knowledge Base. This KB contains experiment data, reaction learnings, chemical information, and researcher expertise from our ChemELN system.

## Quick Stats

- **Total Experiments:** ${stats.totalExperiments}
- **Total Chemicals:** ${stats.totalChemicals}
- **Total Researchers:** ${stats.totalResearchers}
- **Last Updated:** ${today}

---

## Reaction Types

Browse experiments by reaction type:

${reactionTypesList || "- No reaction types yet"}

[View all reaction types ->](/kb/chemistry/reactions/)

---

## Recent Experiments

[[Recent Experiments]] — Experiments added in the last 30 days

Latest:
${recentExpList}

---

## Researcher Directory

[[Researcher Directory]] — Find who has expertise in specific reactions or substrates

Top contributors:
${researcherList}

---

## How Agents Should Use This KB

When answering chemistry questions, follow this navigation pattern:

1. **Start with the reaction type** — Click the relevant reaction link above
2. **Read Key Learnings** — The reaction type page has a "Key Learnings" section with ranked tips
3. **Filter by context** — Use tags to find experiments matching substrate class, scale, or challenge
4. **Read top experiments** — Focus on the 3-5 most relevant experiments (sorted by quality x relevance)
5. **Extract citations** — Always cite: experiment ID, researcher, date, and specific conditions
6. **Check "Who To Ask"** — If more context is needed, the reaction type page lists human experts

**Example workflow:**
- User asks: "What conditions work for Suzuki coupling on heteroaryl substrates?"
- Navigate to [[Suzuki-Coupling]]
- Filter for \`substrate-class: heteroaryl\`
- Read top 3 experiments
- Answer with specific conditions, yields, and researcher attribution

---

## Tag Taxonomy Quick Reference

| Namespace | Pattern | Example | Description |
|-----------|---------|---------|-------------|
| \`eln:\` | \`eln:[id]\` | \`eln:EXP-2026-0042\` | ChemELN experiment ID |
| \`cas:\` | \`cas:[number]\` | \`cas:14221-01-3\` | CAS registry number |
| \`reaction:\` | \`reaction:[type]\` | \`reaction:suzuki-coupling\` | Reaction type |
| \`researcher:\` | \`researcher:[name]\` | \`researcher:mueller\` | Researcher name |
| \`substrate-class:\` | \`substrate-class:[class]\` | \`substrate-class:heteroaryl\` | Substrate class |
| \`scale:\` | \`scale:[category]\` | \`scale:medium\` | Scale category |
| \`challenge:\` | \`challenge:[issue]\` | \`challenge:protodeboronation\` | Challenge type |
| \`quality:\` | \`quality:[1-5]\` | \`quality:4\` | Quality score |

---

## Navigation Tips

- **All reaction types:** Browse \`/kb/chemistry/reactions/\`
- **All chemicals:** Browse \`/kb/chemistry/chemicals/\`
- **All researchers:** Browse \`/kb/chemistry/researchers/\`
- **Search by tag:** Use the tag filter on reaction type pages
- **Recent work:** Check [[Recent Experiments]] for latest learnings

---

*Last updated: ${today} | Data synced from ChemELN*
`;
}
