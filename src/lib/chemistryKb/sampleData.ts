import type {
  ExperimentPageData,
  ChemicalPageData,
  ReactionTypePageData,
  ResearcherPageData,
  SubstrateClassPageData,
} from "./templates";

// ---------------------------------------------------------------------------
// Sample Chemicals (5)
// ---------------------------------------------------------------------------

export const samplePdPPh34: ChemicalPageData = {
  name: "Pd(PPh3)4",
  casNumber: "14221-01-3",
  molecularFormula: "C72H60P4Pd",
  molecularWeight: 1155.56,
  commonSynonyms: [
    "Tetrakis(triphenylphosphine)palladium(0)",
    "Tetrakis",
    "Pd tetrakis",
  ],
  summary:
    "Air-sensitive Pd(0) catalyst widely used for Suzuki, Heck, and Stille couplings.",
  appearance: "Bright yellow crystalline powder",
  meltingPoint: "103-107 °C (dec.)",
  storageNotes: [
    "Store under inert atmosphere (N2 or Ar) at 2-8 °C",
    "Protect from light — decomposes to Pd black on prolonged exposure",
    "Use Schlenk techniques when weighing",
  ],
  handlingNotes: [
    "Weigh quickly in air; prolonged exposure causes darkening",
    "If powder is dark brown/black, catalyst has degraded — discard",
    "3 mol% loading is typical for Suzuki couplings with aryl bromides",
  ],
  institutionalKnowledge: [
    "Batch from Sigma lot #MKCL1234 gave consistently higher yields than TCI material",
    "Fresh catalyst (<6 months old) is critical for heteroaryl substrates",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Suzuki coupling of 4-bromopyridine (82% yield)",
    },
    {
      elnId: "EXP-2026-0043",
      description: "Optimization of Suzuki conditions (75% yield)",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Scale-up to 10 mmol (91% yield)",
    },
  ],
  relatedReactionTypes: ["Suzuki Coupling"],
  relatedResearchers: ["Dr. Anna Mueller"],
};

export const sampleTHF: ChemicalPageData = {
  name: "Tetrahydrofuran",
  casNumber: "109-99-9",
  molecularFormula: "C4H8O",
  molecularWeight: 72.11,
  commonSynonyms: ["THF", "Oxolane", "Tetramethylene oxide"],
  summary:
    "Versatile aprotic solvent miscible with water; commonly used in cross-coupling reactions.",
  appearance: "Colorless liquid with ethereal odor",
  meltingPoint: "-108.4 °C",
  storageNotes: [
    "Store over molecular sieves (4 A) under nitrogen",
    "Peroxide-forming — test with KI/starch strips before use if >3 months old",
    "Use anhydrous grade (inhibitor-free) for Pd-catalyzed reactions",
  ],
  handlingNotes: [
    "Highly flammable — keep away from ignition sources",
    "THF/water mixtures (3:1 to 4:1) are standard for Suzuki couplings",
    "Degassing by sparging with N2 for 15 min improves coupling yields",
  ],
  institutionalKnowledge: [
    "Anhydrous THF from the solvent purification system gives better results than bottled anhydrous",
    "For Suzuki couplings, THF/H2O 3:1 outperforms dioxane/H2O in our hands",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Used as co-solvent in THF/H2O 3:1 mixture",
    },
    {
      elnId: "EXP-2026-0043",
      description: "Solvent screening — compared THF, dioxane, DME",
    },
  ],
  relatedReactionTypes: ["Suzuki Coupling"],
  relatedResearchers: ["Dr. Anna Mueller"],
};

export const sample4Bromopyridine: ChemicalPageData = {
  name: "4-Bromopyridine",
  casNumber: "1120-87-2",
  molecularFormula: "C5H4BrN",
  molecularWeight: 157.99,
  commonSynonyms: ["4-Bromopyridine hydrochloride", "4-Pyridyl bromide"],
  summary:
    "Heteroaryl halide substrate frequently used in Suzuki coupling to form 4-arylpyridines.",
  appearance: "White to off-white crystalline solid (as HCl salt)",
  meltingPoint: "100-103 °C (HCl salt)",
  storageNotes: [
    "Store as the hydrochloride salt for stability",
    "Free base is volatile and light-sensitive — generate in situ",
    "Keep desiccated at room temperature",
  ],
  handlingNotes: [
    "Free-base by treatment with aqueous K2CO3 before use in coupling",
    "The HCl salt requires 2.0 eq base to neutralize + provide coupling base",
    "Heteroaryl bromides are less reactive than aryl bromides — may need higher catalyst loading",
  ],
  institutionalKnowledge: [
    "Protodeboronation is the main side reaction — keep boronic acid in slight excess (1.2 eq)",
    "Using the HCl salt with K2CO3 gives cleaner reactions than free base",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Substrate for Suzuki coupling with PhB(OH)2",
    },
  ],
  relatedReactionTypes: ["Suzuki Coupling"],
  relatedResearchers: ["Dr. Anna Mueller"],
};

export const sampleK2CO3: ChemicalPageData = {
  name: "Potassium carbonate",
  casNumber: "584-08-7",
  molecularFormula: "K2CO3",
  molecularWeight: 138.21,
  commonSynonyms: ["K2CO3", "Potash", "Dipotassium carbonate"],
  summary:
    "Mild inorganic base commonly used in Suzuki and Buchwald-Hartwig couplings.",
  appearance: "White hygroscopic powder",
  meltingPoint: "891 °C",
  storageNotes: [
    "Highly hygroscopic — keep tightly sealed",
    "Store in desiccator if using anhydrous grade",
  ],
  handlingNotes: [
    "2.0 equivalents standard for Suzuki coupling",
    "Dissolves slowly — ensure adequate stirring or pre-dissolve in water portion",
    "Cs2CO3 is a stronger alternative when K2CO3 gives sluggish reactions",
  ],
  institutionalKnowledge: [
    "Finely ground K2CO3 gives faster reactions than granular",
    "For heterocyclic substrates, K3PO4 sometimes outperforms K2CO3",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Base for Suzuki coupling (2.0 eq)",
    },
    {
      elnId: "EXP-2026-0043",
      description: "Base screening — compared K2CO3, Cs2CO3, K3PO4",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Base for scale-up reaction (2.0 eq)",
    },
  ],
  relatedReactionTypes: ["Suzuki Coupling"],
  relatedResearchers: ["Dr. Anna Mueller"],
};

export const samplePhenylboronicAcid: ChemicalPageData = {
  name: "Phenylboronic acid",
  casNumber: "98-80-6",
  molecularFormula: "C6H7BO2",
  molecularWeight: 121.93,
  commonSynonyms: [
    "PhB(OH)2",
    "Benzeneboronic acid",
    "Phenylboronic acid",
  ],
  summary:
    "Prototypical arylboronic acid coupling partner for Suzuki reactions.",
  appearance: "White crystalline powder",
  meltingPoint: "216-219 °C",
  storageNotes: [
    "Store sealed at room temperature — stable for years",
    "Can form boroxine (trimer) on prolonged storage; still reactive",
  ],
  handlingNotes: [
    "Use 1.2 equivalents relative to halide for Suzuki coupling",
    "Boroxine form requires adjusted stoichiometry (0.4 eq boroxine = 1.2 eq boronic acid)",
    "Pre-dissolve in THF before adding to aqueous reaction mixture",
  ],
  institutionalKnowledge: [
    "Fresh material from Sigma performs identically to Combi-Blocks at half the cost",
    "1.5 eq gives higher yield with electron-poor heteroaryl halides but increases protodeboronation byproduct",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Coupling partner for 4-bromopyridine",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Coupling partner in 10 mmol scale-up",
    },
  ],
  relatedReactionTypes: ["Suzuki Coupling"],
  relatedResearchers: ["Dr. Anna Mueller"],
};

// ---------------------------------------------------------------------------
// Sample Researcher (1)
// ---------------------------------------------------------------------------

export const sampleDrMueller: ResearcherPageData = {
  name: "Dr. Anna Mueller",
  email: "a.mueller@institute.edu",
  experimentCount: 3,
  primaryExpertise: ["Suzuki couplings", "Heteroaryl substrates", "Reaction optimization"],
  summary:
    "Specialist in Pd-catalyzed cross-coupling of heteroaromatic substrates with 3 documented experiments.",
  expertiseAreas: [
    {
      area: "Suzuki Coupling",
      description:
        "Extensive experience with heteroaryl bromide substrates, particularly pyridines and pyrimidines",
    },
    {
      area: "Heteroaryl Halides",
      description:
        "Developed optimized conditions addressing protodeboronation and low reactivity challenges",
    },
  ],
  recentExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Suzuki coupling of 4-bromopyridine — 82% yield",
    },
    {
      elnId: "EXP-2026-0043",
      description: "Optimization of Suzuki conditions — 75% yield",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Scale-up to 10 mmol — 91% yield",
    },
  ],
  notableResults: [
    "Achieved 91% isolated yield on 10 mmol scale Suzuki coupling ([[EXP-2026-0044]])",
    "Identified optimal THF/H2O ratio (3:1) for heteroaryl Suzuki couplings",
    "Demonstrated that fresh [[Pd(PPh3)4]] is critical for reproducibility",
  ],
  institutionalKnowledge: [
    "Always degas solvents for Pd-catalyzed reactions — even 'anhydrous' THF from bottles contains dissolved O2",
    "For pyridine substrates, slow addition of boronic acid over 30 min reduces protodeboronation",
    "K2CO3 works well for most substrates; switch to Cs2CO3 only for very hindered systems",
  ],
  whenToAsk:
    "Cross-coupling reactions involving nitrogen heterocycles, scale-up of Suzuki couplings, troubleshooting low yields with heteroaryl substrates",
};

// ---------------------------------------------------------------------------
// Sample Reaction Type (1)
// ---------------------------------------------------------------------------

export const sampleSuzukiCoupling: ReactionTypePageData = {
  name: "Suzuki Coupling",
  experimentCount: 3,
  avgYield: 83,
  successRate: "100% (3/3 experiments gave >50% yield)",
  researcherCount: 1,
  summary:
    "Pd-catalyzed cross-coupling of organoboron compounds with aryl/heteroaryl halides — our most-used C-C bond-forming reaction.",
  whatWorksWell: [
    "[[Pd(PPh3)4]] at 3 mol% loading with [[Potassium carbonate]] (2.0 eq) in THF/H2O 3:1",
    "Reflux temperature (80 °C) for 4 hours gives clean conversion with aryl bromides",
    "Degassing solvents with N2 for 15 min before adding catalyst consistently improves yields by 5-10%",
    "Slow addition of boronic acid (over 30 min) minimizes protodeboronation with heteroaryl substrates",
  ],
  commonPitfalls: [
    "Protodeboronation — major side reaction with electron-poor heteroaryl halides; mitigated by slow boronic acid addition",
    "Catalyst decomposition — old or air-exposed [[Pd(PPh3)4]] gives dark mixtures and low yields",
    "Moisture sensitivity — paradoxically requires water as co-solvent, but excess water causes hydrolysis",
    "Homocoupling of boronic acid — occurs with excess catalyst or O2 contamination",
  ],
  substrateAdvice: [
    {
      substrateClass: "Heteroaryl Halides",
      advice:
        "Use 1.2 eq boronic acid, degas thoroughly, and consider slow addition to suppress protodeboronation",
    },
  ],
  whoToAsk: [
    {
      researcher: "Dr. Anna Mueller",
      expertise:
        "Heteroaryl substrates, scale-up, optimization of reaction conditions",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Standard conditions with 4-bromopyridine — 82% yield",
    },
    {
      elnId: "EXP-2026-0043",
      description: "Solvent/base optimization study — 75% yield",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Successful 10 mmol scale-up — 91% yield",
    },
  ],
  commonCatalysts: ["Pd(PPh3)4"],
};

// ---------------------------------------------------------------------------
// Sample Substrate Class (1)
// ---------------------------------------------------------------------------

export const sampleHeteroarylHalides: SubstrateClassPageData = {
  name: "Heteroaryl Halides",
  experimentCount: 3,
  summary:
    "Halogenated nitrogen heterocycles (pyridines, pyrimidines, etc.) that present unique challenges in cross-coupling due to catalyst poisoning and protodeboronation.",
  commonChallenges: [
    "Protodeboronation — the boronic acid coupling partner decomposes before coupling, especially with electron-poor heterocycles",
    "Catalyst poisoning — nitrogen lone pairs can coordinate to Pd and slow catalytic turnover",
    "Low reactivity — heteroaryl C-X bonds are less reactive than simple aryl C-X bonds toward oxidative addition",
    "Selectivity — polyhalogenated heterocycles can give mixtures of mono- and di-coupled products",
  ],
  successfulStrategies: [
    "Use fresh, high-quality [[Pd(PPh3)4]] — aged catalyst fails with these substrates first",
    "Slow addition of boronic acid over 30 min suppresses protodeboronation",
    "THF/H2O 3:1 solvent system at reflux (80 °C) gives good results",
    "2.0 eq [[Potassium carbonate]] as base; switch to Cs2CO3 for very unreactive substrates",
  ],
  reactionAdvice: [
    {
      reactionType: "Suzuki Coupling",
      advice:
        "Degas solvents, use 1.2 eq boronic acid, 3 mol% fresh Pd(PPh3)4, K2CO3 base in THF/H2O 3:1",
    },
  ],
  whoHasExperience: [
    {
      researcher: "Dr. Anna Mueller",
      knowledge:
        "3 experiments with pyridine substrates; developed optimized slow-addition protocol",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Suzuki coupling of [[4-Bromopyridine]] — baseline conditions",
    },
    {
      elnId: "EXP-2026-0043",
      description: "Optimization study for heteroaryl Suzuki conditions",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Scale-up demonstrating robustness at 10 mmol",
    },
  ],
  commonReactions: ["Suzuki Coupling"],
};

// ---------------------------------------------------------------------------
// Sample Experiments (3)
// ---------------------------------------------------------------------------

export const sampleExp0042: ExperimentPageData = {
  title: "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine",
  elnId: "EXP-2026-0042",
  researcher: "Dr. Anna Mueller",
  date: "2026-03-15",
  status: "completed",
  reactionType: "Suzuki Coupling",
  substrateClass: "Heteroaryl Halides",
  scaleCategory: "medium",
  scaleMmol: "5.0 mmol",
  qualityScore: 4,
  summary:
    "Successful Suzuki coupling of 4-bromopyridine with phenylboronic acid achieving 82% isolated yield under standard conditions.",
  conditions: [
    { parameter: "Temperature", value: "80 °C", notes: "Reflux" },
    { parameter: "Solvent", value: "THF/H2O (3:1)", notes: "20 mL total" },
    { parameter: "Atmosphere", value: "Nitrogen", notes: "Schlenk line" },
    { parameter: "Duration", value: "4 hours" },
  ],
  reagents: [
    {
      name: "4-Bromopyridine",
      amount: "790 mg (5.0 mmol)",
      equivalents: "1.0 eq",
      cas: "1120-87-2",
      notes: "Used as HCl salt",
    },
    {
      name: "Phenylboronic acid",
      amount: "731 mg (6.0 mmol)",
      equivalents: "1.2 eq",
      cas: "98-80-6",
    },
    {
      name: "Pd(PPh3)4",
      amount: "173 mg (0.15 mmol)",
      equivalents: "3 mol%",
      cas: "14221-01-3",
      notes: "Bright yellow — fresh batch",
    },
    {
      name: "Potassium carbonate",
      amount: "1.38 g (10.0 mmol)",
      equivalents: "2.0 eq",
      cas: "584-08-7",
    },
    {
      name: "THF",
      amount: "15 mL",
      equivalents: "solvent",
      cas: "109-99-9",
      notes: "Anhydrous, degassed",
    },
  ],
  procedureSetup: [
    "Oven-dried 100 mL round-bottom flask equipped with magnetic stir bar",
    "Charged with [[4-Bromopyridine]] HCl salt (790 mg, 5.0 mmol) and [[Potassium carbonate]] (1.38 g, 10.0 mmol)",
    "Added [[THF]] (15 mL, anhydrous) and degassed by sparging with N2 for 15 min",
    "Added H2O (5 mL, degassed) to form THF/H2O 3:1 biphasic mixture",
  ],
  procedureReaction: [
    "Added [[Pd(PPh3)4]] (173 mg, 3 mol%) under N2 counterflow",
    "Added [[Phenylboronic acid]] (731 mg, 1.2 eq) in one portion",
    "Heated to reflux (80 °C) and stirred for 4 hours",
    "Monitored by TLC (EtOAc/hexanes 1:1, UV visualization)",
    "TLC at 4 h showed complete consumption of starting material",
  ],
  procedureWorkup: [
    "Cooled to room temperature and diluted with EtOAc (30 mL)",
    "Washed with H2O (2 x 20 mL) and brine (1 x 20 mL)",
    "Dried over Na2SO4, filtered, and concentrated under reduced pressure",
  ],
  procedurePurification: [
    "Purified by column chromatography on silica gel (EtOAc/hexanes gradient, 20-50%)",
    "Product eluted at ~35% EtOAc/hexanes",
    "Obtained 636 mg (82% yield) of 4-phenylpyridine as white crystals",
  ],
  results: {
    yield: "82% (636 mg, 4.10 mmol)",
    purity: ">95% by 1H NMR",
    characterization:
      "1H NMR (400 MHz, CDCl3): delta 8.67 (d, 2H), 7.63 (d, 2H), 7.52-7.42 (m, 5H). HRMS (ESI): m/z calcd for C11H10N [M+H]+ 156.0808, found 156.0810.",
  },
  productAppearance: "White crystalline solid, mp 77-78 °C (lit. 77-79 °C)",
  practicalNotesWorked: [
    "Degassing solvents is critical — undegassed runs gave 60-65% yield",
    "Using HCl salt of bromopyridine with 2.0 eq K2CO3 gave cleaner reaction than free base",
    "Fresh Pd(PPh3)4 (bright yellow) is essential — darkened catalyst gave 40% yield",
  ],
  practicalNotesChallenges: [
    "Initial attempt without degassing gave only 62% yield due to catalyst oxidation",
    "Column chromatography requires careful gradient — product co-elutes with triphenylphosphine oxide at high EtOAc",
  ],
  practicalNotesRecommendations: [
    "Always degas both THF and H2O before use",
    "Check catalyst color before use — discard if not bright yellow",
    "For scale-up, consider slow addition of boronic acid to minimize protodeboronation",
  ],
  substrateInsights: [
    "[[Heteroaryl Halides]] like 4-bromopyridine require fresh catalyst and degassed solvents",
    "The nitrogen lone pair can coordinate Pd, slowing catalysis — higher temperature helps",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2026-0043",
      description: "Follow-up optimization of solvent and base",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Successful scale-up to 10 mmol",
    },
  ],
  relatedChemicals: [
    "Pd(PPh3)4",
    "THF",
    "4-Bromopyridine",
    "Potassium carbonate",
    "Phenylboronic acid",
  ],
};

export const sampleExp0043: ExperimentPageData = {
  title: "EXP-2026-0043: Optimization of Suzuki Conditions",
  elnId: "EXP-2026-0043",
  researcher: "Dr. Anna Mueller",
  date: "2026-03-17",
  status: "completed",
  reactionType: "Suzuki Coupling",
  substrateClass: "Heteroaryl Halides",
  scaleCategory: "small",
  scaleMmol: "1.0 mmol",
  qualityScore: 3,
  summary:
    "Systematic optimization of solvent and base for Suzuki coupling of 4-bromopyridine; THF/H2O with K2CO3 confirmed as optimal.",
  conditions: [
    { parameter: "Temperature", value: "80 °C", notes: "Reflux" },
    { parameter: "Solvent", value: "Varied (see table)", notes: "4 mL total" },
    { parameter: "Atmosphere", value: "Nitrogen" },
    { parameter: "Duration", value: "4 hours" },
  ],
  reagents: [
    {
      name: "4-Bromopyridine",
      amount: "158 mg (1.0 mmol)",
      equivalents: "1.0 eq",
      cas: "1120-87-2",
    },
    {
      name: "Phenylboronic acid",
      amount: "146 mg (1.2 mmol)",
      equivalents: "1.2 eq",
      cas: "98-80-6",
    },
    {
      name: "Pd(PPh3)4",
      amount: "35 mg (0.03 mmol)",
      equivalents: "3 mol%",
      cas: "14221-01-3",
    },
    {
      name: "Potassium carbonate",
      amount: "276 mg (2.0 mmol)",
      equivalents: "2.0 eq",
      cas: "584-08-7",
    },
    {
      name: "THF",
      amount: "3 mL",
      equivalents: "solvent",
      cas: "109-99-9",
    },
  ],
  procedureSetup: [
    "Set up 4 parallel reactions in 10 mL Schlenk tubes under N2",
    "Each tube charged with [[4-Bromopyridine]] HCl salt (158 mg, 1.0 mmol)",
    "Added [[Pd(PPh3)4]] (35 mg, 3 mol%) to each tube",
  ],
  procedureReaction: [
    "Tube A: [[THF]]/H2O 3:1, [[Potassium carbonate]] 2.0 eq — 75% yield",
    "Tube B: Dioxane/H2O 3:1, K2CO3 2.0 eq — 68% yield",
    "Tube C: DME/H2O 3:1, K2CO3 2.0 eq — 70% yield",
    "Tube D: THF/H2O 3:1, Cs2CO3 2.0 eq — 72% yield",
    "All reactions heated to 80 °C for 4 hours",
  ],
  procedureWorkup: [
    "Each tube diluted with EtOAc (5 mL)",
    "Washed with H2O (2 x 3 mL) and brine (1 x 3 mL)",
    "Dried over Na2SO4, filtered, concentrated",
  ],
  procedurePurification: [
    "Crude yields determined by 1H NMR with mesitylene internal standard",
    "Best reaction (Tube A) purified by column for isolated yield confirmation",
  ],
  results: {
    yield: "75% (best condition, Tube A — THF/H2O, K2CO3)",
    purity: ">90% by 1H NMR (crude)",
    characterization:
      "Product identity confirmed by 1H NMR comparison with authentic sample from [[EXP-2026-0042]]",
  },
  productAppearance: "White solid after purification",
  practicalNotesWorked: [
    "Parallel screening in Schlenk tubes is efficient for solvent/base optimization",
    "THF/H2O 3:1 with K2CO3 confirmed as the best system for this substrate",
    "1H NMR with internal standard is faster than column for yield determination",
  ],
  practicalNotesChallenges: [
    "Small scale (1 mmol) gives lower yields than 5 mmol — likely due to catalyst decomposition at low volume",
    "Cs2CO3 gave comparable yield but is 10x more expensive — not justified here",
  ],
  practicalNotesRecommendations: [
    "Stick with THF/H2O 3:1 and K2CO3 for [[Heteroaryl Halides]]",
    "Run optimization at 2-3 mmol scale for more reliable yield data",
    "Dioxane is a viable alternative if THF peroxide levels are a concern",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Initial successful coupling — established baseline",
    },
    {
      elnId: "EXP-2026-0044",
      description: "Scale-up using optimized conditions from this study",
    },
  ],
  relatedChemicals: [
    "Pd(PPh3)4",
    "THF",
    "4-Bromopyridine",
    "Potassium carbonate",
    "Phenylboronic acid",
  ],
};

export const sampleExp0044: ExperimentPageData = {
  title: "EXP-2026-0044: Scale-Up to 10 mmol",
  elnId: "EXP-2026-0044",
  researcher: "Dr. Anna Mueller",
  date: "2026-03-19",
  status: "completed",
  reactionType: "Suzuki Coupling",
  substrateClass: "Heteroaryl Halides",
  scaleCategory: "large",
  scaleMmol: "10.0 mmol",
  qualityScore: 5,
  tags: ["scale:large", "quality:5"],
  summary:
    "Successful 10 mmol scale-up of Suzuki coupling achieving 91% isolated yield with slow boronic acid addition protocol.",
  conditions: [
    { parameter: "Temperature", value: "80 °C", notes: "Reflux" },
    { parameter: "Solvent", value: "THF/H2O (3:1)", notes: "40 mL total" },
    { parameter: "Atmosphere", value: "Nitrogen", notes: "Schlenk line" },
    { parameter: "Duration", value: "5 hours", notes: "Including 30 min addition" },
  ],
  reagents: [
    {
      name: "4-Bromopyridine",
      amount: "1.58 g (10.0 mmol)",
      equivalents: "1.0 eq",
      cas: "1120-87-2",
      notes: "HCl salt, freebase generated in situ",
    },
    {
      name: "Phenylboronic acid",
      amount: "1.46 g (12.0 mmol)",
      equivalents: "1.2 eq",
      cas: "98-80-6",
      notes: "Added slowly over 30 min as THF solution",
    },
    {
      name: "Pd(PPh3)4",
      amount: "347 mg (0.30 mmol)",
      equivalents: "3 mol%",
      cas: "14221-01-3",
      notes: "Fresh batch, bright yellow",
    },
    {
      name: "Potassium carbonate",
      amount: "2.76 g (20.0 mmol)",
      equivalents: "2.0 eq",
      cas: "584-08-7",
      notes: "Finely ground",
    },
    {
      name: "THF",
      amount: "30 mL",
      equivalents: "solvent",
      cas: "109-99-9",
      notes: "Anhydrous, from solvent purification system",
    },
  ],
  procedureSetup: [
    "Oven-dried 250 mL three-neck flask with mechanical stirrer and N2 inlet",
    "Charged with [[4-Bromopyridine]] HCl salt (1.58 g, 10.0 mmol) and [[Potassium carbonate]] (2.76 g, 20.0 mmol)",
    "Added [[THF]] (30 mL) and H2O (10 mL), both degassed by freeze-pump-thaw (3 cycles)",
  ],
  procedureReaction: [
    "Added [[Pd(PPh3)4]] (347 mg, 3 mol%) under N2 and heated to 80 °C",
    "Prepared solution of [[Phenylboronic acid]] (1.46 g) in THF (5 mL)",
    "Added boronic acid solution dropwise over 30 min via syringe pump",
    "Stirred at 80 °C for additional 4.5 hours (5 hours total)",
    "TLC at 5 h showed complete conversion, single product spot",
  ],
  procedureWorkup: [
    "Cooled to RT, diluted with EtOAc (60 mL)",
    "Washed with H2O (2 x 40 mL) and brine (1 x 40 mL)",
    "Dried over Na2SO4, filtered through Celite pad, concentrated",
  ],
  procedurePurification: [
    "Purified by recrystallization from hot EtOH/H2O (4:1)",
    "Collected product by vacuum filtration",
    "Obtained 1.41 g (91% yield) of 4-phenylpyridine as white needles",
  ],
  results: {
    yield: "91% (1.41 g, 9.10 mmol)",
    purity: ">99% by 1H NMR and HPLC",
    characterization:
      "1H NMR (400 MHz, CDCl3): delta 8.66 (d, 2H), 7.62 (d, 2H), 7.50-7.40 (m, 5H). HPLC: single peak, tR = 8.2 min. Mp: 77-78 °C.",
  },
  productAppearance: "White needles, mp 77-78 °C",
  practicalNotesWorked: [
    "Slow addition of boronic acid over 30 min was the key improvement — reduced protodeboronation dramatically",
    "Freeze-pump-thaw degassing is superior to N2 sparging at this scale",
    "Recrystallization from EtOH/H2O gave analytically pure product — no column needed",
    "Mechanical stirring ensures good mixing at larger volume",
  ],
  practicalNotesChallenges: [
    "Initial attempt with fast boronic acid addition gave only 78% yield",
    "Celite filtration step is important to remove Pd residues before recrystallization",
  ],
  practicalNotesRecommendations: [
    "Use slow boronic acid addition for any scale above 5 mmol with [[Heteroaryl Halides]]",
    "Recrystallization preferred over column at >5 mmol scale — higher throughput and purity",
    "Document catalyst batch number — reproducibility depends on catalyst quality",
  ],
  substrateInsights: [
    "[[Heteroaryl Halides]]: slow boronic acid addition protocol is critical at scale",
    "4-Bromopyridine is a good model substrate for pyridine Suzuki couplings",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2026-0042",
      description: "Original 5 mmol reaction — established baseline conditions",
    },
    {
      elnId: "EXP-2026-0043",
      description: "Optimization study that confirmed THF/H2O/K2CO3 system",
    },
  ],
  relatedChemicals: [
    "Pd(PPh3)4",
    "THF",
    "4-Bromopyridine",
    "Potassium carbonate",
    "Phenylboronic acid",
  ],
};

// ---------------------------------------------------------------------------
// Collected sample data
// ---------------------------------------------------------------------------

export const ALL_SAMPLE_CHEMICALS: ChemicalPageData[] = [
  samplePdPPh34,
  sampleTHF,
  sample4Bromopyridine,
  sampleK2CO3,
  samplePhenylboronicAcid,
];

export const ALL_SAMPLE_EXPERIMENTS: ExperimentPageData[] = [
  sampleExp0042,
  sampleExp0043,
  sampleExp0044,
];

export const ALL_SAMPLE_PAGE_TITLES: string[] = [
  // Chemicals
  "Pd(PPh3)4",
  "Tetrahydrofuran",
  "4-Bromopyridine",
  "Potassium carbonate",
  "Phenylboronic acid",
  // Researcher
  "Dr. Anna Mueller",
  // Reaction type
  "Suzuki Coupling",
  // Substrate class
  "Heteroaryl Halides",
  // Experiments
  "EXP-2026-0042",
  "EXP-2026-0043",
  "EXP-2026-0044",
  // Experiment full titles
  "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine",
  "EXP-2026-0043: Optimization of Suzuki Conditions",
  "EXP-2026-0044: Scale-Up to 10 mmol",
];

export const SYNONYM_MAP: Record<string, string> = {
  THF: "Tetrahydrofuran",
  Oxolane: "Tetrahydrofuran",
  "Tetramethylene oxide": "Tetrahydrofuran",
  "Tetrakis(triphenylphosphine)palladium(0)": "Pd(PPh3)4",
  Tetrakis: "Pd(PPh3)4",
  "Pd tetrakis": "Pd(PPh3)4",
  K2CO3: "Potassium carbonate",
  Potash: "Potassium carbonate",
  "PhB(OH)2": "Phenylboronic acid",
  "Benzeneboronic acid": "Phenylboronic acid",
  "4-Bromopyridine hydrochloride": "4-Bromopyridine",
  "4-Pyridyl bromide": "4-Bromopyridine",
};
