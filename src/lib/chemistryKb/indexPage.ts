/**
 * Generates the markdown content for the "Chemistry KB Index" page.
 * This page provides explicit navigation guidance for AI agents.
 */

export function generateIndexPageContent(): string {
  return `# Chemistry KB Index

> AI agent navigation guide for the chemistry knowledge base

## For Agents: How to Use This KB

### 1. Understanding the Structure

The chemistry KB has 5 page types:
- **Experiment**: Individual chemistry experiments (from ChemELN)
- **Chemical**: Practical info about chemicals we use
- **ReactionType**: Aggregated learnings about reaction types
- **Researcher**: Who has expertise in what areas
- **SubstrateClass**: Cross-experiment patterns for substrate classes

### 2. Tag-Based Filtering

Use these tag patterns to find relevant pages:

**Finding Experiments:**
- \`reaction:suzuki-coupling\` — All Suzuki coupling experiments
- \`researcher:mueller\` — All experiments by Dr. Mueller
- \`substrate-class:heteroaryl\` — All experiments with heteroaryl substrates
- \`scale:medium\` — Medium-scale experiments (1-10 mmol)
- \`challenge:protodeboronation\` — Experiments that faced protodeboronation issues
- \`quality:4\` OR \`quality:5\` — High-quality experiments only

**Finding Chemicals:**
- \`cas:14221-01-3\` — Find chemical by CAS number

**Finding Expertise:**
- \`researcher\` tag — All researcher pages
- Cross-reference with \`reaction:*\` tags to find who works on what

### 3. Wikilink Navigation

Pages are interconnected via wikilinks:
- Experiments link to chemicals, reaction types, researchers, substrate classes
- Chemical pages link back to experiments that used them
- Reaction type pages aggregate experiments by type
- Researcher pages show all their experiments

### 4. Graph Traversal

Use the graph API to:
- Find related experiments (via shared chemicals or substrate classes)
- Find who else worked on similar problems (via reaction type or substrate class)
- Find alternative approaches (via backlinks from chemicals)

### 5. Contextual Retrieval Example

**User asks: "How do we handle heteroaryl substrates in Suzuki couplings?"**

Agent strategy:
1. Search for pages with tags: \`reaction:suzuki-coupling\` AND \`substrate-class:heteroaryl\`
2. Find the [[Heteroaryl Halides]] substrate class page for aggregated insights
3. Read "Practical Notes" sections from top-quality experiments (quality:4+)
4. Check [[Suzuki Coupling]] reaction type page for "Substrate-Specific Advice"
5. Identify expert: Find researcher with most experiments in this area

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

## Entry Points

- **[[Chemistry KB]]**: Root page
- **[[Experiments]]**: Browse all experiments
- **[[Reaction Types]]**: Browse by reaction type
- **[[Chemicals]]**: Browse chemicals
- **[[Researchers]]**: Find expertise
- **[[Substrate Classes]]**: Browse by substrate class`;
}
