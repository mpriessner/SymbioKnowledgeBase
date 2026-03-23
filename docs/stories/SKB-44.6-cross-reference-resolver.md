# Story SKB-44.6: Cross-Reference Resolver & Stub Page Creator

**Epic:** Epic 44 - SKB Ingestion Pipeline
**Story ID:** SKB-44.6
**Story Points:** 2 | **Priority:** Medium | **Status:** Planned
**Depends On:** SKB-42.2 (Wikilink Naming Conventions)

---

## User Story

As an ingestion pipeline, I want to build a lookup map of all page names and resolve wikilinks before writing pages, creating stub pages for any unresolved references, So that every wikilink in the knowledge base points to a real page and no broken links exist.

---

## Acceptance Criteria

- [ ] TypeScript module `src/lib/chemeln/sync/resolver.ts` exports `CrossReferenceResolver` class
- [ ] `buildLookupMap()` creates `Map<normalizedName, PageInfo>` for all chemicals, reaction types, researchers
- [ ] Lookup normalizes names to Title Case (matching EPIC-42 conventions)
- [ ] `resolveWikilink(name)` returns page info or null
- [ ] `findUnresolvedLinks(markdown)` parses `[[...]]` syntax and finds unresolved references
- [ ] `createStubPage(name, type)` generates a minimal stub page with `needs-enrichment` tag
- [ ] Handles special characters in chemical names (e.g., "N,N-Dimethylformamide")
- [ ] Handles very long names (truncate to 255 chars, append hash for uniqueness)
- [ ] Handles duplicate names (append CAS number to disambiguate chemicals)
- [ ] Tracks chemical usages for aggregation (which experiments use which chemicals)
- [ ] Unit tests for name normalization, lookup resolution, stub generation, edge cases

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  CrossReferenceResolver                                     │
│                                                             │
│  lookupMap: Map<string, PageInfo>                           │
│    "palladium acetate" -> { name: "Palladium Acetate",      │
│                            id: "cas:3375-31-3", type: ... } │
│    "suzuki coupling"   -> { name: "Suzuki Coupling", ... }  │
│    "jane doe"          -> { name: "Jane Doe", ... }         │
│                                                             │
│  chemicalUsages: Map<chemicalId, ChemicalUsage[]>           │
│    "c1" -> [{ expId: "EXP-001", role: "catalyst", ... }]    │
│                                                             │
│  Methods:                                                   │
│    buildLookupMap(data) -> void                              │
│    resolveWikilink(name) -> PageInfo | null                  │
│    findUnresolvedLinks(markdown) -> string[]                 │
│    createStubPage(name, type) -> string                      │
│    resolveResearcher(userId) -> string                       │
│    getChemicalUsages(chemicalId) -> ChemicalUsage[]          │
│    registerUsage(chemicalId, usage) -> void                  │
└─────────────────────────────────────────────────────────────┘
         │
         │  Used by generators + orchestrator
         ▼
┌─────────────────────────────────────────────────────────────┐
│  Wikilink Resolution Flow                                   │
│                                                             │
│  Input: [[Palladium acetate]]                               │
│    1. Normalize: "palladium acetate"                        │
│    2. Lookup: map.get("palladium acetate")                  │
│    3. Found -> valid wikilink (page exists or will exist)   │
│    4. Not found -> create stub page, add to map             │
│                                                             │
│  Input: [[N,N-Dimethylformamide]]                           │
│    1. Normalize: "n,n-dimethylformamide"                    │
│    2. Lookup: map.get("n,n-dimethylformamide")              │
│    3. Not found in chemicals? -> check aliases/synonyms     │
│    4. Still not found -> create stub with needs-enrichment  │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Define PageInfo Type

**File: `src/lib/chemeln/sync/resolver.ts`**

```typescript
import { ChemicalData, ReactionTypeAggregation, ResearcherProfile, SubstrateClassAggregation, ChemicalUsage } from '../types';
import { buildFrontmatter, toTitleCase } from '../generators/utils';

export interface PageInfo {
  name: string; // Display name (Title Case)
  normalizedName: string; // Lowercase for lookups
  type: 'chemical' | 'reaction-type' | 'researcher' | 'substrate-class' | 'experiment';
  matchTag: string; // Tag for upsert matching (cas:XXX, reaction:XXX, etc.)
  id?: string; // DB ID if already created
}

export interface LookupData {
  chemicals: ChemicalData[];
  reactionTypes: ReactionTypeAggregation[];
  researchers: ResearcherProfile[];
  substrateClasses: SubstrateClassAggregation[];
}
```

### Step 2: Implement CrossReferenceResolver

```typescript
export class CrossReferenceResolver {
  private lookupMap: Map<string, PageInfo> = new Map();
  private chemicalUsages: Map<string, ChemicalUsage[]> = new Map();
  private researcherMap: Map<string, string> = new Map(); // userId -> name

  buildLookupMap(data: LookupData): void {
    // Chemicals
    for (const chemical of data.chemicals) {
      const normalized = this.normalize(chemical.name);
      this.lookupMap.set(normalized, {
        name: toTitleCase(chemical.name),
        normalizedName: normalized,
        type: 'chemical',
        matchTag: chemical.casNumber ? `cas:${chemical.casNumber}` : `chemical:${chemical.id}`,
      });

      // Also index by CAS number
      if (chemical.casNumber) {
        this.lookupMap.set(chemical.casNumber, this.lookupMap.get(normalized)!);
      }
    }

    // Reaction Types
    for (const rt of data.reactionTypes) {
      const normalized = this.normalize(rt.name);
      this.lookupMap.set(normalized, {
        name: toTitleCase(rt.name),
        normalizedName: normalized,
        type: 'reaction-type',
        matchTag: `reaction:${rt.name.toLowerCase().replace(/\s+/g, '-')}`,
      });
    }

    // Researchers
    for (const researcher of data.researchers) {
      const normalized = this.normalize(researcher.name);
      this.lookupMap.set(normalized, {
        name: toTitleCase(researcher.name),
        normalizedName: normalized,
        type: 'researcher',
        matchTag: `researcher:${researcher.name.toLowerCase().replace(/\s+/g, '-')}`,
      });
    }

    // Substrate Classes
    for (const sc of data.substrateClasses) {
      const normalized = this.normalize(sc.name);
      this.lookupMap.set(normalized, {
        name: toTitleCase(sc.name),
        normalizedName: normalized,
        type: 'substrate-class',
        matchTag: `substrate-class:${sc.name.toLowerCase().replace(/\s+/g, '-')}`,
      });
    }
  }

  resolveWikilink(name: string): PageInfo | null {
    return this.lookupMap.get(this.normalize(name)) ?? null;
  }

  findUnresolvedLinks(markdown: string): string[] {
    const wikilinkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const unresolved: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = wikilinkRegex.exec(markdown)) !== null) {
      const linkTarget = match[1].trim();
      if (!this.resolveWikilink(linkTarget)) {
        unresolved.push(linkTarget);
      }
    }

    return [...new Set(unresolved)]; // deduplicate
  }

  createStubPage(name: string, type: string): string {
    const truncatedName = name.length > 255
      ? `${name.slice(0, 245)}...${this.shortHash(name)}`
      : name;

    const titleCaseName = toTitleCase(truncatedName);

    const frontmatter = buildFrontmatter({
      title: titleCaseName,
      icon: type === 'chemical' ? '⚗️' : '📄',
      'page-type': type,
      tags: ['needs-enrichment', type],
      'one-liner': 'Auto-generated stub -- needs enrichment',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    });

    return [
      frontmatter,
      '',
      `# ${titleCaseName}`,
      '',
      '> This page was auto-generated and needs enrichment.',
      '> It was referenced in experiment pages but has no corresponding entry in ChemELN.',
      '',
      '## Used In',
      '',
      '*Referenced in experiment pages -- see backlinks.*',
      '',
    ].join('\n');
  }

  resolveResearcher(userId: string): string {
    return this.researcherMap.get(userId) ?? 'Unknown Researcher';
  }

  setResearcherMapping(userId: string, name: string): void {
    this.researcherMap.set(userId, name);
  }

  registerUsage(chemicalId: string, usage: ChemicalUsage): void {
    const existing = this.chemicalUsages.get(chemicalId) ?? [];
    existing.push(usage);
    this.chemicalUsages.set(chemicalId, existing);
  }

  getChemicalUsages(chemicalId: string): ChemicalUsage[] {
    return this.chemicalUsages.get(chemicalId) ?? [];
  }

  private normalize(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  private shortHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36).slice(0, 6);
  }
}
```

---

## Testing Requirements

### Unit Test: `src/__tests__/lib/chemeln/sync/resolver.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { CrossReferenceResolver } from '@/lib/chemeln/sync/resolver';

describe('CrossReferenceResolver', () => {
  let resolver: CrossReferenceResolver;

  beforeEach(() => {
    resolver = new CrossReferenceResolver();
    resolver.buildLookupMap({
      chemicals: [
        { id: 'c1', name: 'Palladium Acetate', casNumber: '3375-31-3', molecularFormula: 'C4H6O4Pd' },
        { id: 'c2', name: 'N,N-Dimethylformamide', casNumber: '68-12-2', molecularFormula: 'C3H7NO' },
      ],
      reactionTypes: [{
        name: 'Suzuki Coupling',
        experimentCount: 25,
        avgYield: 78,
        researcherCount: 3,
        experiments: [],
        keyLearnings: [],
        commonPitfalls: [],
        topResearchers: [],
      }],
      researchers: [{
        name: 'Jane Doe',
        totalExperiments: 45,
        topReactionTypes: [],
        recentExperiments: [],
        keyContributions: [],
      }],
      substrateClasses: [],
    });
  });

  it('should resolve chemical by name (case insensitive)', () => {
    const result = resolver.resolveWikilink('palladium acetate');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Palladium Acetate');
    expect(result?.type).toBe('chemical');
  });

  it('should resolve chemical by CAS number', () => {
    const result = resolver.resolveWikilink('3375-31-3');
    expect(result).not.toBeNull();
    expect(result?.name).toBe('Palladium Acetate');
  });

  it('should handle special characters in names', () => {
    const result = resolver.resolveWikilink('N,N-Dimethylformamide');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('chemical');
  });

  it('should resolve reaction type by name', () => {
    const result = resolver.resolveWikilink('Suzuki Coupling');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('reaction-type');
  });

  it('should resolve researcher by name', () => {
    const result = resolver.resolveWikilink('Jane Doe');
    expect(result).not.toBeNull();
    expect(result?.type).toBe('researcher');
  });

  it('should return null for unknown references', () => {
    const result = resolver.resolveWikilink('Unknown Chemical XYZ');
    expect(result).toBeNull();
  });

  it('should find unresolved links in markdown', () => {
    const markdown = '- [[Palladium Acetate]] -- catalyst\n- [[Unknown Chemical]] -- reagent\n- [[Suzuki Coupling]]';
    const unresolved = resolver.findUnresolvedLinks(markdown);
    expect(unresolved).toEqual(['Unknown Chemical']);
  });

  it('should deduplicate unresolved links', () => {
    const markdown = '- [[Unknown A]]\n- [[Unknown A]]\n- [[Unknown B]]';
    const unresolved = resolver.findUnresolvedLinks(markdown);
    expect(unresolved).toHaveLength(2);
  });

  it('should generate stub page with needs-enrichment tag', () => {
    const stub = resolver.createStubPage('Mystery Reagent', 'chemical');
    expect(stub).toContain('needs-enrichment');
    expect(stub).toContain('# Mystery Reagent');
    expect(stub).toContain('auto-generated');
  });

  it('should truncate very long names', () => {
    const longName = 'A'.repeat(300);
    const stub = resolver.createStubPage(longName, 'chemical');
    // Title in stub should be truncated
    expect(stub.length).toBeLessThan(1500);
  });

  it('should track chemical usages', () => {
    resolver.registerUsage('c1', {
      experimentId: 'EXP-001',
      experimentTitle: 'Test',
      role: 'catalyst',
      amount: 5,
      unit: 'mol%',
    });

    const usages = resolver.getChemicalUsages('c1');
    expect(usages).toHaveLength(1);
    expect(usages[0].role).toBe('catalyst');
  });

  it('should return empty array for chemicals with no usages', () => {
    expect(resolver.getChemicalUsages('nonexistent')).toEqual([]);
  });

  it('should resolve researcher by userId', () => {
    resolver.setResearcherMapping('user-123', 'Alice Smith');
    expect(resolver.resolveResearcher('user-123')).toBe('Alice Smith');
    expect(resolver.resolveResearcher('unknown-user')).toBe('Unknown Researcher');
  });
});
```

---

## Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `src/lib/chemeln/sync/resolver.ts` |
| CREATE | `src/__tests__/lib/chemeln/sync/resolver.test.ts` |

---

## Dev Notes

**Name normalization:** All lookups use lowercase, trimmed names. This ensures `[[palladium acetate]]`, `[[Palladium Acetate]]`, and `[[PALLADIUM ACETATE]]` all resolve to the same page. The display name is always Title Case per EPIC-42 conventions.

**Synonym handling:** For MVP, synonyms are not supported. A chemical like "THF" would need to be looked up as "Tetrahydrofuran" (its full name in ChemELN). Synonym support (from SKB-43.3 chemical deduplication) can be added later by extending the lookup map with aliases.

**Stub pages:** When the generator creates a wikilink to a chemical that doesn't exist in ChemELN's chemicals table (e.g., a reagent name mentioned in procedure text but not in the structured reagents list), a stub page is created with minimal content. The `needs-enrichment` tag marks these for manual review.

**Chemical usages tracking:** The resolver also acts as an accumulator for chemical usages during experiment page generation. As each experiment is processed, its reagents/products are registered via `registerUsage()`. These accumulated usages are then used in Pass 3 to update chemical pages with "Used In" sections.

**Dual-indexing for chemicals:** Chemicals are indexed by both their common name and CAS number. This allows wikilinks to reference either `[[Palladium Acetate]]` or `[[3375-31-3]]` and resolve to the same page.

---

**Last Updated:** 2026-03-21
