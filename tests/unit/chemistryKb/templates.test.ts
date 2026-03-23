import { describe, it, expect } from 'vitest';
import {
  generateExperimentPage,
  generateChemicalPage,
  generateReactionTypePage,
  generateResearcherPage,
  generateSubstrateClassPage,
  type ExperimentPageData,
  type ChemicalPageData,
  type ReactionTypePageData,
  type ResearcherPageData,
  type SubstrateClassPageData,
} from '@/lib/chemistryKb/templates';

function extractWikilinks(markdown: string): string[] {
  const matches = markdown.match(/\[\[(.+?)\]\]/g) ?? [];
  return matches.map((m) => m.slice(2, -2));
}

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function makeExperimentData(
  overrides: Partial<ExperimentPageData> = {},
): ExperimentPageData {
  return {
    title: 'Suzuki Coupling of 4-Bromoanisole with Phenylboronic Acid',
    elnId: 'EXP-2024-0042',
    researcher: 'Dr. Alice Chen',
    date: '2024-06-15',
    status: 'completed',
    reactionType: 'Suzuki Coupling',
    substrateClass: 'Aryl Halides',
    scaleCategory: 'small',
    scaleMmol: '2.5 mmol',
    qualityScore: 4,
    tags: [],
    summary: 'High-yielding Suzuki coupling using Pd(PPh3)4 catalyst.',
    conditions: [
      { parameter: 'Temperature', value: '80 C', notes: 'Reflux' },
      { parameter: 'Solvent', value: 'THF/H2O 3:1' },
    ],
    reagents: [
      {
        name: 'Palladium tetrakis(triphenylphosphine)',
        amount: '0.05 mmol',
        equivalents: '0.02 eq',
        cas: '14221-01-3',
      },
      {
        name: 'Phenylboronic Acid',
        amount: '3.0 mmol',
        equivalents: '1.2 eq',
      },
    ],
    procedureSetup: ['Purge flask with argon for 10 min'],
    procedureReaction: ['Heat to 80 C and stir for 12 h'],
    procedureWorkup: ['Dilute with EtOAc and wash with brine'],
    procedurePurification: ['Column chromatography (hex/EtOAc 9:1)'],
    results: { yield: '92%', purity: '>99% by HPLC', characterization: '1H NMR consistent' },
    productAppearance: 'White crystalline solid',
    practicalNotesWorked: ['Argon atmosphere critical for reproducibility'],
    practicalNotesChallenges: ['Boronic acid needs to be fresh'],
    practicalNotesRecommendations: ['Use K2CO3 instead of Cs2CO3 for cost'],
    substrateInsights: ['Electron-rich aryl halides react faster'],
    relatedExperiments: [
      { elnId: 'EXP-2024-0038', description: 'Similar coupling at larger scale', pageTitle: 'Suzuki Coupling Scale-Up' },
      { elnId: 'EXP-2024-0010', description: 'Initial screening run' },
    ],
    relatedChemicals: ['Palladium tetrakis(triphenylphosphine)', 'Phenylboronic Acid'],
    ...overrides,
  };
}

function makeChemicalData(
  overrides: Partial<ChemicalPageData> = {},
): ChemicalPageData {
  return {
    name: 'Palladium tetrakis(triphenylphosphine)',
    casNumber: '14221-01-3',
    molecularFormula: 'C72H60P4Pd',
    molecularWeight: 1155.56,
    commonSynonyms: ['Pd(PPh3)4', 'Tetrakis'],
    summary: 'Air-sensitive Pd(0) catalyst widely used in cross-coupling reactions.',
    appearance: 'Bright yellow crystalline powder',
    meltingPoint: '116-120 C (dec.)',
    storageNotes: ['Store under argon at -20 C', 'Protect from light'],
    handlingNotes: ['Use Schlenk technique', 'Weigh quickly in air'],
    institutionalKnowledge: ['Batch from Sigma lot #ABCD gave best results'],
    usedInExperiments: [
      { elnId: 'EXP-2024-0042', description: 'Suzuki coupling catalyst', pageTitle: 'Suzuki Coupling of 4-Bromoanisole' },
      { elnId: 'EXP-2024-0038', description: 'Scale-up catalyst' },
    ],
    relatedReactionTypes: ['Suzuki Coupling', 'Heck Reaction', 'Stille Coupling'],
    relatedResearchers: ['Dr. Alice Chen', 'Dr. Bob Martinez'],
    ...overrides,
  };
}

function makeReactionTypeData(
  overrides: Partial<ReactionTypePageData> = {},
): ReactionTypePageData {
  return {
    name: 'Suzuki Coupling',
    experimentCount: 47,
    avgYield: 78.5,
    successRate: '85%',
    researcherCount: 5,
    summary: 'Pd-catalysed cross-coupling of aryl halides with organoboron reagents.',
    whatWorksWell: ['Pd(PPh3)4 with K2CO3 in THF/H2O'],
    commonPitfalls: ['Moisture-sensitive boronic acids decompose on storage'],
    substrateAdvice: [
      { substrateClass: 'Aryl Halides', advice: 'Iodides react fastest; chlorides need specialised ligands' },
      { substrateClass: 'Heteroaryl Halides', advice: 'Watch for catalyst poisoning by N-heterocycles' },
    ],
    whoToAsk: [
      { researcher: 'Dr. Alice Chen', expertise: 'Scale-up and optimisation' },
      { researcher: 'Dr. Bob Martinez', expertise: 'Heteroaryl substrates' },
    ],
    representativeExperiments: [
      { elnId: 'EXP-2024-0042', description: 'Standard conditions benchmark', pageTitle: 'Suzuki Coupling of 4-Bromoanisole' },
      { elnId: 'EXP-2024-0010', description: 'Initial method development' },
    ],
    relatedReactionTypes: ['Heck Reaction', 'Negishi Coupling'],
    commonCatalysts: ['Palladium tetrakis(triphenylphosphine)', 'Pd2(dba)3'],
    ...overrides,
  };
}

function makeResearcherData(
  overrides: Partial<ResearcherPageData> = {},
): ResearcherPageData {
  return {
    name: 'Dr. Alice Chen',
    email: 'alice.chen@example.com',
    experimentCount: 42,
    primaryExpertise: ['Cross-Coupling', 'Catalysis'],
    summary: 'Senior researcher specialising in Pd-catalysed cross-coupling reactions.',
    expertiseAreas: [
      { area: 'Suzuki Coupling', description: 'Extensive optimisation experience' },
      { area: 'Heck Reaction', description: 'Scale-up expertise' },
    ],
    recentExperiments: [
      { elnId: 'EXP-2024-0042', description: 'Latest Suzuki benchmark', pageTitle: 'Suzuki Coupling of 4-Bromoanisole' },
      { elnId: 'EXP-2024-0038', description: 'Scale-up trial' },
    ],
    notableResults: ['Achieved 95% yield on pilot-scale Suzuki coupling'],
    institutionalKnowledge: ['Knows the quirks of the old rotovap in lab 204'],
    whenToAsk: 'For anything related to Pd-catalysed couplings or scale-up.',
    ...overrides,
  };
}

function makeSubstrateClassData(
  overrides: Partial<SubstrateClassPageData> = {},
): SubstrateClassPageData {
  return {
    name: 'Aryl Halides',
    experimentCount: 63,
    summary: 'Aryl halides are the most common electrophilic coupling partners.',
    commonChallenges: ['Chlorides require activated catalysts'],
    successfulStrategies: ['Use Pd-PEPPSI for aryl chlorides'],
    reactionAdvice: [
      { reactionType: 'Suzuki Coupling', advice: 'Iodides and bromides work well with standard Pd(0)' },
      { reactionType: 'Heck Reaction', advice: 'Prefer iodides for terminal olefin selectivity' },
    ],
    whoHasExperience: [
      { researcher: 'Dr. Alice Chen', knowledge: 'Broad scope with bromides and iodides' },
      { researcher: 'Dr. Bob Martinez', knowledge: 'Chloride activation' },
    ],
    representativeExperiments: [
      { elnId: 'EXP-2024-0042', description: 'Suzuki with 4-bromoanisole', pageTitle: 'Suzuki Coupling of 4-Bromoanisole' },
      { elnId: 'EXP-2024-0010', description: 'Screening of aryl chlorides' },
    ],
    relatedSubstrateClasses: ['Heteroaryl Halides', 'Vinyl Halides'],
    commonReactions: ['Suzuki Coupling', 'Heck Reaction', 'Negishi Coupling'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests: generateExperimentPage
// ---------------------------------------------------------------------------

describe('generateExperimentPage', () => {
  it('metadata section uses paragraph format, not table', () => {
    const output = generateExperimentPage(makeExperimentData());
    expect(output).not.toContain('| **Researcher** |');
    expect(output).toContain('**Researcher:** [[');
  });

  it('contains wikilinks for researcher, reaction type, substrate class', () => {
    const output = generateExperimentPage(makeExperimentData());
    const links = extractWikilinks(output);
    expect(links).toContain('Dr. Alice Chen');
    expect(links).toContain('Suzuki Coupling');
    expect(links).toContain('Aryl Halides');
  });

  it('reagent names are wikilinks', () => {
    const output = generateExperimentPage(makeExperimentData());
    expect(output).toContain('[[Palladium tetrakis(triphenylphosphine)]]');
    expect(output).toContain('[[Phenylboronic Acid]]');
  });

  it('related experiments use full page title when available', () => {
    const output = generateExperimentPage(makeExperimentData());
    expect(output).toContain('[[Suzuki Coupling Scale-Up]]');
  });

  it('related experiments fall back to elnId when pageTitle missing', () => {
    const output = generateExperimentPage(makeExperimentData());
    expect(output).toContain('[[EXP-2024-0010]]');
  });

  it('related chemicals are wikilinks', () => {
    const output = generateExperimentPage(makeExperimentData());
    const links = extractWikilinks(output);
    expect(links).toContain('Palladium tetrakis(triphenylphosphine)');
    expect(links).toContain('Phenylboronic Acid');
  });

  it('related pages section has wikilinks', () => {
    const output = generateExperimentPage(makeExperimentData());
    const relatedSection = output.split('## Related Pages')[1] ?? '';
    const links = extractWikilinks(relatedSection);
    expect(links).toContain('Suzuki Coupling');
    expect(links).toContain('Aryl Halides');
    expect(links).toContain('Dr. Alice Chen');
  });
});

// ---------------------------------------------------------------------------
// Tests: generateChemicalPage
// ---------------------------------------------------------------------------

describe('generateChemicalPage', () => {
  it('used in experiments are wikilinks with full title', () => {
    const output = generateChemicalPage(makeChemicalData());
    expect(output).toContain('[[Suzuki Coupling of 4-Bromoanisole]]');
    expect(output).toContain('[[EXP-2024-0038]]');
  });

  it('related reaction types are wikilinks', () => {
    const output = generateChemicalPage(makeChemicalData());
    const links = extractWikilinks(output);
    expect(links).toContain('Suzuki Coupling');
    expect(links).toContain('Heck Reaction');
    expect(links).toContain('Stille Coupling');
  });

  it('related researchers are wikilinks', () => {
    const output = generateChemicalPage(makeChemicalData());
    const links = extractWikilinks(output);
    expect(links).toContain('Dr. Alice Chen');
    expect(links).toContain('Dr. Bob Martinez');
  });
});

// ---------------------------------------------------------------------------
// Tests: generateReactionTypePage
// ---------------------------------------------------------------------------

describe('generateReactionTypePage', () => {
  it('substrate advice has wikilinks', () => {
    const output = generateReactionTypePage(makeReactionTypeData());
    const links = extractWikilinks(output);
    expect(links).toContain('Aryl Halides');
    expect(links).toContain('Heteroaryl Halides');
  });

  it('who to ask has researcher wikilinks', () => {
    const output = generateReactionTypePage(makeReactionTypeData());
    const links = extractWikilinks(output);
    expect(links).toContain('Dr. Alice Chen');
    expect(links).toContain('Dr. Bob Martinez');
  });

  it('representative experiments use full title', () => {
    const output = generateReactionTypePage(makeReactionTypeData());
    expect(output).toContain('[[Suzuki Coupling of 4-Bromoanisole]]');
    expect(output).toContain('[[EXP-2024-0010]]');
  });

  it('common catalysts are wikilinks', () => {
    const output = generateReactionTypePage(makeReactionTypeData());
    const links = extractWikilinks(output);
    expect(links).toContain('Palladium tetrakis(triphenylphosphine)');
    expect(links).toContain('Pd2(dba)3');
  });
});

// ---------------------------------------------------------------------------
// Tests: generateResearcherPage
// ---------------------------------------------------------------------------

describe('generateResearcherPage', () => {
  it('expertise areas have wikilinks', () => {
    const output = generateResearcherPage(makeResearcherData());
    const links = extractWikilinks(output);
    expect(links).toContain('Suzuki Coupling');
    expect(links).toContain('Heck Reaction');
  });

  it('recent experiments use full title', () => {
    const output = generateResearcherPage(makeResearcherData());
    expect(output).toContain('[[Suzuki Coupling of 4-Bromoanisole]]');
    expect(output).toContain('[[EXP-2024-0038]]');
  });
});

// ---------------------------------------------------------------------------
// Tests: generateSubstrateClassPage
// ---------------------------------------------------------------------------

describe('generateSubstrateClassPage', () => {
  it('reaction advice has wikilinks', () => {
    const output = generateSubstrateClassPage(makeSubstrateClassData());
    const links = extractWikilinks(output);
    expect(links).toContain('Suzuki Coupling');
    expect(links).toContain('Heck Reaction');
  });

  it('who has experience has researcher wikilinks', () => {
    const output = generateSubstrateClassPage(makeSubstrateClassData());
    const links = extractWikilinks(output);
    expect(links).toContain('Dr. Alice Chen');
    expect(links).toContain('Dr. Bob Martinez');
  });

  it('representative experiments use full title', () => {
    const output = generateSubstrateClassPage(makeSubstrateClassData());
    expect(output).toContain('[[Suzuki Coupling of 4-Bromoanisole]]');
    expect(output).toContain('[[EXP-2024-0010]]');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting tests
// ---------------------------------------------------------------------------

describe('cross-cutting template tests', () => {
  it('all templates produce output starting with frontmatter', () => {
    const outputs = [
      generateExperimentPage(makeExperimentData()),
      generateChemicalPage(makeChemicalData()),
      generateReactionTypePage(makeReactionTypeData()),
      generateResearcherPage(makeResearcherData()),
      generateSubstrateClassPage(makeSubstrateClassData()),
    ];
    for (const output of outputs) {
      expect(output.startsWith('---')).toBe(true);
    }
  });

  it('no unmatched wikilink brackets', () => {
    const outputs = [
      generateExperimentPage(makeExperimentData()),
      generateChemicalPage(makeChemicalData()),
      generateReactionTypePage(makeReactionTypeData()),
      generateResearcherPage(makeResearcherData()),
      generateSubstrateClassPage(makeSubstrateClassData()),
    ];
    for (const output of outputs) {
      const openCount = (output.match(/\[\[/g) ?? []).length;
      const closeCount = (output.match(/\]\]/g) ?? []).length;
      expect(openCount).toBe(closeCount);
      expect(openCount).toBeGreaterThan(0);
    }
  });
});
