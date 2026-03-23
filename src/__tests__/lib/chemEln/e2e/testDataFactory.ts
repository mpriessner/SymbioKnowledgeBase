import type { ScaleCategory } from "@/lib/chemistryKb/types";
import type {
  ExpertiseProfile,
  ExpertiseExperimentInput,
  ResearcherWithExperiments,
  ExperimentRef,
  PracticalNotesResult,
  ActivityStatus,
} from "@/lib/chemEln/enrichment/types";
import type {
  ExperimentEntry,
  ExperimentRef as FindSimilarExperimentRef,
} from "@/lib/chemEln/retrieval/findSimilar";
import type { ExperimentWithNotes } from "@/lib/chemEln/enrichment/keyLearnings";
import type { PageWithTags } from "@/lib/chemEln/retrieval/tagFilter";
import type { AggregatorInput } from "@/lib/chemEln/retrieval/statsAggregator";
import type { ChemicalUsage } from "@/lib/chemEln/types";

// ---------------------------------------------------------------------------
// Reference date: 2026-03-21 (so "active" = within 90 days)
// ---------------------------------------------------------------------------
export const REFERENCE_DATE = new Date("2026-03-21");

// ---------------------------------------------------------------------------
// Researchers
// ---------------------------------------------------------------------------
export interface TestResearcher {
  id: string;
  name: string;
  email: string;
}

export const RESEARCHERS: TestResearcher[] = [
  { id: "R001", name: "Dr. Anna Mueller", email: "mueller@lab.org" },
  { id: "R002", name: "Dr. Wei Chen", email: "chen@lab.org" },
  { id: "R003", name: "Dr. Anika Patel", email: "patel@lab.org" },
  { id: "R004", name: "Dr. Kenji Tanaka", email: "tanaka@lab.org" },
];

// ---------------------------------------------------------------------------
// Chemicals
// ---------------------------------------------------------------------------
export interface TestChemical {
  name: string;
  casNumber: string;
}

export const CHEMICALS: TestChemical[] = [
  { name: "Pd(PPh3)4", casNumber: "14221-01-3" },
  { name: "THF", casNumber: "109-99-9" },
  { name: "4-Bromopyridine", casNumber: "1120-87-2" },
  { name: "Phenylboronic acid", casNumber: "98-80-6" },
  { name: "K2CO3", casNumber: "584-08-7" },
  { name: "Magnesium turnings", casNumber: "7439-95-4" },
  { name: "Bromobenzene", casNumber: "108-86-1" },
  { name: "Diethyl ether", casNumber: "60-29-7" },
  { name: "Pd2(dba)3", casNumber: "51364-51-3" },
  { name: "XPhos", casNumber: "564483-18-7" },
  { name: "NaOtBu", casNumber: "865-48-5" },
  { name: "Toluene", casNumber: "108-88-3" },
  { name: "Morpholine", casNumber: "110-91-8" },
];

// ---------------------------------------------------------------------------
// Experiment definitions — the single source of truth
// ---------------------------------------------------------------------------
export interface TestExperiment {
  id: string;
  title: string;
  researcher: string;
  date: Date;
  dateStr: string;
  reactionType: string;
  substrateClasses: string[];
  chemicals: string[];
  scaleCategory: ScaleCategory;
  qualityScore: number;
  yieldPercent: number | null;
  practicalNotes: PracticalNotesResult;
  conditions?: {
    temperature?: string;
    solvent?: string;
    catalyst?: string;
  };
  tags: string[];
  challenges: string[];
}

function makePracticalNotes(overrides: Partial<PracticalNotesResult> = {}): PracticalNotesResult {
  return {
    hasData: true,
    whatWorked: [],
    challenges: [],
    recommendations: [],
    timingTips: [],
    safetyNotes: [],
    deviations: [],
    tips: [],
    ...overrides,
  };
}

function makeNote(text: string, importance: "critical" | "important" | "informational" = "important") {
  return { text, importance };
}

export const EXPERIMENTS: TestExperiment[] = [
  // --- Suzuki Coupling experiments ---
  {
    id: "EXP-2026-0042",
    title: "Suzuki coupling of 4-bromopyridine with phenylboronic acid",
    researcher: "Dr. Anna Mueller",
    date: new Date("2026-02-15"),
    dateStr: "2026-02-15",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["heteroaryl"],
    chemicals: ["Pd(PPh3)4", "THF", "4-Bromopyridine", "Phenylboronic acid", "K2CO3"],
    scaleCategory: "medium",
    qualityScore: 5,
    yieldPercent: 82,
    practicalNotes: makePracticalNotes({
      tips: [
        "Degassing the THF/H2O mixture improved yield from 65% to 82%",
        "Use fresh Pd(PPh3)4 (<6 months) for heteroaryl substrates",
      ],
      whatWorked: [
        makeNote("THF/H2O 3:1 solvent system gave best results"),
        makeNote("Slow addition of boronic acid over 30 min reduces protodeboronation"),
      ],
      challenges: [
        makeNote("Protodeboronation is a major side reaction with heteroaryl boronic acids"),
      ],
      recommendations: [
        makeNote("Use 1.5 equiv boronic acid to compensate for protodeboronation losses"),
      ],
      overallNotes: "Optimized Suzuki coupling conditions for heteroaryl substrates achieving 82% yield with careful temperature control at 60°C",
    }),
    conditions: { temperature: "60°C", solvent: "THF/H2O 3:1", catalyst: "Pd(PPh3)4" },
    tags: ["reaction:suzuki-coupling", "substrate-class:heteroaryl", "challenge:protodeboronation", "scale:medium", "quality:5"],
    challenges: ["protodeboronation"],
  },
  {
    id: "EXP-2026-0043",
    title: "Suzuki coupling solvent optimization",
    researcher: "Dr. Anna Mueller",
    date: new Date("2026-01-20"),
    dateStr: "2026-01-20",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["aryl"],
    chemicals: ["Pd(PPh3)4", "THF", "Phenylboronic acid", "K2CO3", "Bromobenzene"],
    scaleCategory: "small",
    qualityScore: 4,
    yieldPercent: 75,
    practicalNotes: makePracticalNotes({
      tips: ["THF/H2O 3:1 outperforms dioxane/H2O for aryl bromides"],
      whatWorked: [makeNote("K2CO3 (2 equiv) as base gave clean conversion")],
      challenges: [makeNote("Dioxane gave lower yields due to poor mixing")],
    }),
    conditions: { temperature: "80°C", solvent: "THF/H2O 3:1", catalyst: "Pd(PPh3)4" },
    tags: ["reaction:suzuki-coupling", "substrate-class:aryl", "scale:small", "quality:4"],
    challenges: [],
  },
  {
    id: "EXP-2026-0044",
    title: "Suzuki coupling scale-up to 10 mmol",
    researcher: "Dr. Anna Mueller",
    date: new Date("2025-12-10"),
    dateStr: "2025-12-10",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["aryl"],
    chemicals: ["Pd(PPh3)4", "THF", "Phenylboronic acid", "K2CO3", "Bromobenzene"],
    scaleCategory: "large",
    qualityScore: 5,
    yieldPercent: 91,
    practicalNotes: makePracticalNotes({
      tips: [
        "At large scale, addition rate of boronic acid is critical",
        "Mechanical stirring required above 5 mmol",
      ],
      whatWorked: [makeNote("Scale-up from 1 mmol to 10 mmol maintained 91% yield")],
      recommendations: [makeNote("Use overhead stirrer for scales > 5 mmol")],
      overallNotes: "Successful 10x scale-up of Suzuki coupling with 91% yield using mechanical stirring and controlled addition",
    }),
    conditions: { temperature: "80°C", solvent: "THF/H2O 3:1", catalyst: "Pd(PPh3)4" },
    tags: ["reaction:suzuki-coupling", "substrate-class:aryl", "scale:large", "quality:5"],
    challenges: [],
  },
  {
    id: "EXP-2025-0312",
    title: "Suzuki coupling on 2-bromothiophene",
    researcher: "Dr. Wei Chen",
    date: new Date("2025-10-05"),
    dateStr: "2025-10-05",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["heteroaryl"],
    chemicals: ["Pd(PPh3)4", "THF", "Phenylboronic acid", "K2CO3"],
    scaleCategory: "small",
    qualityScore: 4,
    yieldPercent: 78,
    practicalNotes: makePracticalNotes({
      tips: ["Lower temperature (50°C) reduces homocoupling with thiophene substrates"],
      whatWorked: [makeNote("Slow addition of boronic acid minimizes protodeboronation")],
      challenges: [
        makeNote("Protodeboronation with 2-thienylboronic acid at high temperature"),
        makeNote("Homocoupling side product at >70°C"),
      ],
    }),
    conditions: { temperature: "50°C", solvent: "THF/H2O 3:1", catalyst: "Pd(PPh3)4" },
    tags: ["reaction:suzuki-coupling", "substrate-class:heteroaryl", "challenge:protodeboronation", "scale:small", "quality:4"],
    challenges: ["protodeboronation"],
  },
  {
    id: "EXP-2025-0289",
    title: "Suzuki coupling of 3-bromoquinoline",
    researcher: "Dr. Anika Patel",
    date: new Date("2025-09-18"),
    dateStr: "2025-09-18",
    reactionType: "Suzuki Coupling",
    substrateClasses: ["heteroaryl"],
    chemicals: ["Pd(PPh3)4", "THF", "Phenylboronic acid", "K2CO3"],
    scaleCategory: "small",
    qualityScore: 3,
    yieldPercent: 68,
    practicalNotes: makePracticalNotes({
      tips: ["Quinoline substrates need longer reaction times (24h vs 12h)"],
      challenges: [
        makeNote("Protodeboronation significant at 80°C, lowered to 60°C"),
        makeNote("Yield limited by competing reduction of aryl halide"),
      ],
    }),
    conditions: { temperature: "60°C", solvent: "THF/H2O 3:1", catalyst: "Pd(PPh3)4" },
    tags: ["reaction:suzuki-coupling", "substrate-class:heteroaryl", "challenge:protodeboronation", "scale:small", "quality:3"],
    challenges: ["protodeboronation"],
  },

  // --- Grignard Reaction experiments ---
  {
    id: "EXP-2026-0050",
    title: "Grignard reaction of bromobenzene at 50 mmol scale",
    researcher: "Dr. Wei Chen",
    date: new Date("2026-03-01"),
    dateStr: "2026-03-01",
    reactionType: "Grignard Reaction",
    substrateClasses: ["aryl"],
    chemicals: ["Magnesium turnings", "Bromobenzene", "Diethyl ether"],
    scaleCategory: "large",
    qualityScore: 5,
    yieldPercent: 88,
    practicalNotes: makePracticalNotes({
      tips: [
        "Activate Mg with I2 crystal before addition",
        "Maintain gentle reflux throughout — avoid runaway exotherm",
      ],
      whatWorked: [makeNote("Dropwise addition over 2h gave controlled initiation")],
      challenges: [makeNote("Caution: exotherm on initiation can be vigorous at scale")],
      recommendations: [makeNote("Use ice bath for large-scale Grignard initiation")],
      overallNotes: "Successful 50 mmol scale Grignard with careful temperature control and activated magnesium",
    }),
    conditions: { temperature: "reflux", solvent: "Diethyl ether", catalyst: "none" },
    tags: ["reaction:grignard-reaction", "substrate-class:aryl", "scale:large", "quality:5"],
    challenges: [],
  },
  {
    id: "EXP-2026-0051",
    title: "Grignard reaction pilot scale 200 mmol",
    researcher: "Dr. Wei Chen",
    date: new Date("2026-02-01"),
    dateStr: "2026-02-01",
    reactionType: "Grignard Reaction",
    substrateClasses: ["aryl"],
    chemicals: ["Magnesium turnings", "Bromobenzene", "Diethyl ether"],
    scaleCategory: "pilot",
    qualityScore: 4,
    yieldPercent: 85,
    practicalNotes: makePracticalNotes({
      tips: ["At pilot scale, use overhead stirrer and reflux condenser"],
      whatWorked: [makeNote("Slow addition (3h) prevented runaway exotherm")],
      challenges: [makeNote("Caution: 200 mmol scale requires blast shield")],
    }),
    conditions: { temperature: "reflux", solvent: "Diethyl ether", catalyst: "none" },
    tags: ["reaction:grignard-reaction", "substrate-class:aryl", "scale:pilot", "quality:4"],
    challenges: [],
  },
  {
    id: "EXP-2025-0400",
    title: "Grignard reaction with 4-bromoanisole",
    researcher: "Dr. Anika Patel",
    date: new Date("2025-11-20"),
    dateStr: "2025-11-20",
    reactionType: "Grignard Reaction",
    substrateClasses: ["aryl"],
    chemicals: ["Magnesium turnings", "Diethyl ether"],
    scaleCategory: "small",
    qualityScore: 3,
    yieldPercent: 72,
    practicalNotes: makePracticalNotes({
      tips: ["Electron-rich aryl bromides initiate more slowly"],
      challenges: [makeNote("Slow initiation with 4-bromoanisole, needed sonication")],
    }),
    conditions: { temperature: "reflux", solvent: "Diethyl ether", catalyst: "none" },
    tags: ["reaction:grignard-reaction", "substrate-class:aryl", "scale:small", "quality:3"],
    challenges: [],
  },

  // --- Buchwald-Hartwig Amination experiments ---
  {
    id: "EXP-2026-0060",
    title: "Buchwald-Hartwig amination of 2-chloropyridine with morpholine",
    researcher: "Dr. Kenji Tanaka",
    date: new Date("2026-03-10"),
    dateStr: "2026-03-10",
    reactionType: "Buchwald-Hartwig Amination",
    substrateClasses: ["heteroaryl"],
    chemicals: ["Pd2(dba)3", "XPhos", "NaOtBu", "Toluene", "Morpholine"],
    scaleCategory: "small",
    qualityScore: 5,
    yieldPercent: 90,
    practicalNotes: makePracticalNotes({
      tips: [
        "XPhos ligand essential for pyridine substrates",
        "Degassing solvent improved yield from 72% to 90%",
      ],
      whatWorked: [
        makeNote("Pd2(dba)3/XPhos catalyst system is optimal for heteroaryl amination"),
        makeNote("NaOtBu base in toluene at 100°C"),
      ],
      challenges: [makeNote("Yield dropped to 45% without degassing — O2 poisons catalyst")],
      recommendations: [makeNote("Always degas toluene by freeze-pump-thaw for Buchwald-Hartwig")],
    }),
    conditions: { temperature: "100°C", solvent: "Toluene", catalyst: "Pd2(dba)3/XPhos" },
    tags: ["reaction:buchwald-hartwig-amination", "substrate-class:heteroaryl", "challenge:yield", "scale:small", "quality:5"],
    challenges: ["yield"],
  },
  {
    id: "EXP-2026-0061",
    title: "Buchwald-Hartwig amination of 3-bromopyridine",
    researcher: "Dr. Kenji Tanaka",
    date: new Date("2026-01-15"),
    dateStr: "2026-01-15",
    reactionType: "Buchwald-Hartwig Amination",
    substrateClasses: ["heteroaryl"],
    chemicals: ["Pd2(dba)3", "XPhos", "NaOtBu", "Toluene", "Morpholine"],
    scaleCategory: "small",
    qualityScore: 4,
    yieldPercent: 79,
    practicalNotes: makePracticalNotes({
      tips: [
        "3-Bromopyridine reacts faster than 2-chloropyridine",
        "Use 2 mol% Pd loading for bromide substrates",
      ],
      whatWorked: [makeNote("Lower catalyst loading (2 mol%) sufficient for C-Br activation")],
      challenges: [
        makeNote("Yield improved from 55% to 79% by switching from Cs2CO3 to NaOtBu"),
      ],
    }),
    conditions: { temperature: "100°C", solvent: "Toluene", catalyst: "Pd2(dba)3/XPhos" },
    tags: ["reaction:buchwald-hartwig-amination", "substrate-class:heteroaryl", "challenge:yield", "scale:small", "quality:4"],
    challenges: ["yield"],
  },
  {
    id: "EXP-2025-0500",
    title: "Buchwald-Hartwig amination troubleshooting low yield",
    researcher: "Dr. Anna Mueller",
    date: new Date("2025-08-25"),
    dateStr: "2025-08-25",
    reactionType: "Buchwald-Hartwig Amination",
    substrateClasses: ["aryl"],
    chemicals: ["Pd2(dba)3", "XPhos", "NaOtBu", "Toluene", "Morpholine"],
    scaleCategory: "small",
    qualityScore: 4,
    yieldPercent: 65,
    practicalNotes: makePracticalNotes({
      tips: [
        "Degassing solvent is critical — yield improved from 40% to 65%",
        "Pre-mix Pd and ligand for 15 min before adding substrate",
      ],
      whatWorked: [makeNote("Pre-activation of catalyst improved yield from 40% to 65%")],
      challenges: [
        makeNote("Low yield traced to oxygen contamination"),
        makeNote("Yield dropped when using old Pd2(dba)3 batch"),
      ],
      recommendations: [makeNote("Use fresh catalyst and rigorous degassing for amination reactions")],
    }),
    conditions: { temperature: "100°C", solvent: "Toluene", catalyst: "Pd2(dba)3/XPhos" },
    tags: ["reaction:buchwald-hartwig-amination", "substrate-class:aryl", "challenge:yield", "scale:small", "quality:4"],
    challenges: ["yield"],
  },
];

// ---------------------------------------------------------------------------
// Helper: build ExperimentEntry[] for findSimilar
// ---------------------------------------------------------------------------
export function buildExperimentEntries(): ExperimentEntry[] {
  return EXPERIMENTS.map((exp) => ({
    experimentTitle: exp.id,
    reactionType: exp.reactionType,
    substrateClass: exp.substrateClasses[0],
    chemicals: exp.chemicals,
    researcher: exp.researcher,
    scaleCategory: exp.scaleCategory,
    qualityScore: exp.qualityScore,
    yield: exp.yieldPercent ?? undefined,
    date: exp.dateStr,
  }));
}

// ---------------------------------------------------------------------------
// Helper: build ExperimentRef[] for whoHasExperience / whoToAsk
// ---------------------------------------------------------------------------
export function buildExperimentRefs(): ExperimentRef[] {
  return EXPERIMENTS.map((exp) => ({
    experimentId: exp.id,
    researcherName: exp.researcher,
    reactionType: exp.reactionType,
    substrateClasses: exp.substrateClasses,
    date: exp.date,
    qualityScore: exp.qualityScore,
    yieldPercent: exp.yieldPercent,
  }));
}

// ---------------------------------------------------------------------------
// Helper: build ExpertiseExperimentInput[] for expertiseComputation
// ---------------------------------------------------------------------------
export function buildExpertiseExperimentInputs(): ExpertiseExperimentInput[] {
  return EXPERIMENTS.map((exp) => ({
    id: exp.id,
    title: exp.title,
    reactionType: exp.reactionType,
    qualityScore: exp.qualityScore,
    yieldPercent: exp.yieldPercent,
    date: exp.date,
    practicalNotesCount: exp.practicalNotes.tips.length + exp.practicalNotes.whatWorked.length,
    practicalNotes: exp.practicalNotes.overallNotes,
  }));
}

// ---------------------------------------------------------------------------
// Helper: build ResearcherWithExperiments[] for computeAllExpertise
// ---------------------------------------------------------------------------
export function buildResearchersWithExperiments(): ResearcherWithExperiments[] {
  const inputs = buildExpertiseExperimentInputs();
  return RESEARCHERS.map((r) => ({
    researcherId: r.id,
    researcherName: r.name,
    experiments: inputs.filter((e) => {
      const exp = EXPERIMENTS.find((x) => x.id === e.id)!;
      return exp.researcher === r.name;
    }),
  }));
}

// ---------------------------------------------------------------------------
// Helper: build ExperimentWithNotes[] for keyLearnings
// ---------------------------------------------------------------------------
export function buildExperimentsWithNotes(): ExperimentWithNotes[] {
  return EXPERIMENTS.map((exp) => ({
    id: exp.id,
    title: exp.title,
    researcher: exp.researcher,
    date: exp.dateStr,
    qualityScore: exp.qualityScore,
    yieldPercent: exp.yieldPercent,
    practicalNotes: exp.practicalNotes,
    conditions: exp.conditions,
  }));
}

// ---------------------------------------------------------------------------
// Helper: build PageWithTags[] for tag search
// ---------------------------------------------------------------------------
export function buildPagesWithTags(): PageWithTags[] {
  return EXPERIMENTS.map((exp) => ({
    id: exp.id,
    title: exp.title,
    tags: exp.tags,
    frontmatter: {
      reaction: exp.reactionType.toLowerCase().replace(/\s+/g, "-"),
      "substrate-class": exp.substrateClasses[0],
      scale: exp.scaleCategory,
      quality: exp.qualityScore,
      challenge: exp.challenges.length > 0 ? exp.challenges : undefined,
    },
  }));
}

// ---------------------------------------------------------------------------
// Helper: build FindSimilar ExperimentRef
// ---------------------------------------------------------------------------
export function buildFindSimilarRef(expId: string): FindSimilarExperimentRef {
  const exp = EXPERIMENTS.find((e) => e.id === expId);
  if (!exp) throw new Error(`Experiment ${expId} not found`);
  return {
    experimentTitle: exp.id,
    reactionType: exp.reactionType,
    substrateClass: exp.substrateClasses[0],
    chemicals: exp.chemicals,
    researcher: exp.researcher,
    scaleCategory: exp.scaleCategory,
    qualityScore: exp.qualityScore,
    yield: exp.yieldPercent ?? undefined,
    date: exp.dateStr,
  };
}

// ---------------------------------------------------------------------------
// Helper: build AggregatorInput for statsAggregator
// ---------------------------------------------------------------------------
export function buildAggregatorInput(): AggregatorInput {
  const reactionTypeNames = [...new Set(EXPERIMENTS.map((e) => e.reactionType))];
  return {
    experiments: EXPERIMENTS.map((exp) => ({
      id: exp.id,
      title: exp.title,
      date: exp.dateStr,
      reactionType: exp.reactionType,
      researcher: exp.researcher,
    })),
    chemicals: CHEMICALS.map((c) => ({ name: c.name })),
    reactionTypes: reactionTypeNames.map((name) => ({ name })),
    researchers: RESEARCHERS.map((r) => ({ name: r.name })),
  };
}

// ---------------------------------------------------------------------------
// Helper: build researcher email map
// ---------------------------------------------------------------------------
export function buildResearcherEmails(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const r of RESEARCHERS) {
    map[r.name] = r.email;
  }
  return map;
}

// ---------------------------------------------------------------------------
// Helper: build ChemicalUsage[] for chemical-based queries
// ---------------------------------------------------------------------------
export function buildChemicalUsages(): ChemicalUsage[] {
  const usages: ChemicalUsage[] = [];
  for (const exp of EXPERIMENTS) {
    for (const chem of exp.chemicals) {
      usages.push({
        experimentId: exp.id,
        experimentTitle: exp.title,
        role: chem.includes("Pd") ? "catalyst" : "reagent",
        amount: 1,
        unit: "mmol",
        yield: exp.yieldPercent ?? undefined,
      });
    }
  }
  return usages;
}

// ---------------------------------------------------------------------------
// Convenience: create complete test dataset
// ---------------------------------------------------------------------------
export function createTestDataset() {
  return {
    experiments: EXPERIMENTS,
    researchers: RESEARCHERS,
    chemicals: CHEMICALS,
    referenceDate: REFERENCE_DATE,
    experimentEntries: buildExperimentEntries(),
    experimentRefs: buildExperimentRefs(),
    expertiseInputs: buildExpertiseExperimentInputs(),
    researchersWithExperiments: buildResearchersWithExperiments(),
    experimentsWithNotes: buildExperimentsWithNotes(),
    pagesWithTags: buildPagesWithTags(),
    aggregatorInput: buildAggregatorInput(),
    researcherEmails: buildResearcherEmails(),
    chemicalUsages: buildChemicalUsages(),
  };
}
