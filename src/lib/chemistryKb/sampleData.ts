import type {
  ExperimentPageData,
  ChemicalPageData,
  ReactionTypePageData,
  ResearcherPageData,
  SubstrateClassPageData,
} from "./templates";

// ===========================================================================
// CHEMICALS — Existing 5 (unchanged)
// ===========================================================================

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

// ===========================================================================
// CHEMICALS — New (30 chemicals)
// ===========================================================================

export const sampleSalicylicAcid: ChemicalPageData = {
  name: "Salicylic acid",
  casNumber: "69-72-7",
  molecularFormula: "C7H6O3",
  molecularWeight: 138.12,
  commonSynonyms: ["2-Hydroxybenzoic acid", "ortho-Hydroxybenzoic acid"],
  summary:
    "Aromatic hydroxy acid used as the starting material for aspirin synthesis via acetylation.",
  appearance: "White crystalline needles",
  meltingPoint: "158-161 °C",
  storageNotes: [
    "Store in a cool, dry place away from light",
    "Stable under normal conditions for years",
  ],
  handlingNotes: [
    "Slightly soluble in water; dissolves readily in ethanol and acetic acid",
    "Ensure complete dissolution before adding acetic anhydride for acetylation",
  ],
  institutionalKnowledge: [
    "Purity matters — impure salicylic acid gives lower aspirin yields and oily products",
    "Recrystallization from hot water improves purity if starting material is discolored",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Starting material for aspirin synthesis (92.7% yield)",
    },
  ],
  relatedReactionTypes: ["Acetylation"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleAceticAnhydride: ChemicalPageData = {
  name: "Acetic anhydride",
  casNumber: "108-24-7",
  molecularFormula: "C4H6O3",
  molecularWeight: 102.09,
  commonSynonyms: ["Acetyl oxide", "Ethanoic anhydride", "Ac2O"],
  summary:
    "Highly reactive acylating agent used in acetylation reactions; hydrolyzes readily in water.",
  appearance: "Colorless liquid with pungent vinegar-like odor",
  meltingPoint: "-73 °C",
  storageNotes: [
    "Store tightly sealed — reacts with atmospheric moisture",
    "Keep away from water and alcohols",
    "Flammable liquid — store in flammables cabinet",
  ],
  handlingNotes: [
    "Use in fume hood — lachrymatory vapors",
    "Add slowly to substrate to control exotherm",
    "Excess is hydrolyzed during workup with ice water",
  ],
  institutionalKnowledge: [
    "Use ~2-fold excess for complete acetylation of salicylic acid",
    "Old bottles may contain acetic acid from hydrolysis — check by smell or titration",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Acetylating agent for aspirin synthesis",
    },
  ],
  relatedReactionTypes: ["Acetylation"],
  relatedResearchers: ["Dr. James Chen"],
};

export const samplePhosphoricAcid: ChemicalPageData = {
  name: "Phosphoric acid",
  casNumber: "7664-38-2",
  molecularFormula: "H3PO4",
  molecularWeight: 98.0,
  commonSynonyms: ["Orthophosphoric acid", "H3PO4"],
  summary:
    "Mild mineral acid used as catalyst in esterification and acetylation reactions.",
  appearance: "Colorless viscous syrup (85% aqueous solution)",
  meltingPoint: "42.35 °C (anhydrous)",
  storageNotes: [
    "Store in a corrosion-resistant container at room temperature",
    "85% solution is standard laboratory grade",
  ],
  handlingNotes: [
    "Use 3-5 drops as catalyst — excess can cause side reactions",
    "Less corrosive than sulfuric acid but still requires gloves and goggles",
  ],
  institutionalKnowledge: [
    "Phosphoric acid is preferred over sulfuric acid for aspirin synthesis — fewer side products",
    "Sulfuric acid can cause charring at elevated temperatures; H3PO4 is gentler",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Acid catalyst for acetylation of salicylic acid",
    },
  ],
  relatedReactionTypes: ["Acetylation"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleMagnesiumTurnings: ChemicalPageData = {
  name: "Magnesium turnings",
  casNumber: "7439-95-4",
  molecularFormula: "Mg",
  molecularWeight: 24.31,
  commonSynonyms: ["Mg turnings", "Magnesium metal"],
  summary:
    "Metallic magnesium used to form Grignard reagents (RMgX) by insertion into C-halogen bonds.",
  appearance: "Silver-gray metallic turnings or ribbons",
  meltingPoint: "650 °C",
  storageNotes: [
    "Store under dry conditions — surface oxide layer forms in humid air",
    "Keep away from water — reacts to form hydrogen gas",
    "Turnings preferred over powder for controlled Grignard initiation",
  ],
  handlingNotes: [
    "Crush or score turnings to expose fresh surface before use",
    "Initiation can be slow — use a small crystal of I2 or gentle heating",
    "Strictly anhydrous conditions required for Grignard formation",
  ],
  institutionalKnowledge: [
    "Turnings from Alfa Aesar are consistently reactive; some Chinese suppliers give sluggish initiation",
    "If reaction does not initiate within 10 min, add a small crystal of iodine and warm gently",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0002",
      description: "Grignard reagent formation with bromobenzene",
    },
  ],
  relatedReactionTypes: ["Grignard Reaction"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleBromobenzene: ChemicalPageData = {
  name: "Bromobenzene",
  casNumber: "108-86-1",
  molecularFormula: "C6H5Br",
  molecularWeight: 157.01,
  commonSynonyms: ["Phenyl bromide", "Monobromobenzene"],
  summary:
    "Simple aryl halide commonly used to form phenylmagnesium bromide (PhMgBr) Grignard reagent.",
  appearance: "Colorless to pale yellow dense liquid",
  meltingPoint: "-30.6 °C",
  storageNotes: [
    "Store in amber bottle away from light",
    "Stable at room temperature when sealed",
  ],
  handlingNotes: [
    "Dense liquid (d = 1.49 g/mL) — use volumetric measurements carefully",
    "Dry over molecular sieves before use in Grignard reactions",
    "Add dropwise to Mg turnings to control exotherm",
  ],
  institutionalKnowledge: [
    "Freshly distilled bromobenzene gives faster Grignard initiation",
    "Dropwise addition is critical — too-fast addition can cause reflux and bumping",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0002",
      description: "Grignard reagent precursor for triphenylmethanol synthesis",
    },
  ],
  relatedReactionTypes: ["Grignard Reaction"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleBenzophenone: ChemicalPageData = {
  name: "Benzophenone",
  casNumber: "119-61-9",
  molecularFormula: "C13H10O",
  molecularWeight: 182.22,
  commonSynonyms: ["Diphenyl ketone", "Phenyl ketone"],
  summary:
    "Diaryl ketone substrate for Grignard addition to form triphenylmethanol.",
  appearance: "White crystalline solid with floral odor",
  meltingPoint: "47-49 °C",
  storageNotes: [
    "Store at room temperature in a sealed container",
    "Hygroscopic — keep desiccated for anhydrous reactions",
  ],
  handlingNotes: [
    "Dissolves readily in diethyl ether and THF",
    "Add as solid or as solution to Grignard reagent at 0 °C to control exotherm",
  ],
  institutionalKnowledge: [
    "Benzophenone is an excellent test substrate for Grignard reactions — reliably gives good yields",
    "Can also be used as a drying indicator for ethereal solvents (deep blue ketyl with Na)",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0002",
      description: "Electrophile for Grignard addition",
    },
  ],
  relatedReactionTypes: ["Grignard Reaction"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleDiethylEther: ChemicalPageData = {
  name: "Diethyl ether",
  casNumber: "60-29-7",
  molecularFormula: "C4H10O",
  molecularWeight: 74.12,
  commonSynonyms: ["Ether", "Et2O", "Ethoxyethane"],
  summary:
    "Low-boiling ethereal solvent; traditional solvent for Grignard reagent formation.",
  appearance: "Colorless, highly volatile liquid with sweet odor",
  meltingPoint: "-116.3 °C",
  storageNotes: [
    "Peroxide-forming — test with KI/starch strips regularly",
    "Store over molecular sieves or sodium wire under N2",
    "Extremely flammable (flash point -45 °C) — store in flammables cabinet away from ignition sources",
  ],
  handlingNotes: [
    "Vapors are denser than air and can travel to distant ignition sources",
    "Use anhydrous grade for Grignard reactions — trace water kills the reaction",
    "Low boiling point (34.6 °C) means easy solvent removal but risk of loss during reflux",
  ],
  institutionalKnowledge: [
    "THF is replacing ether for many Grignard reactions due to better solvation, but ether is traditional for PhMgBr",
    "Always check peroxide level before distillation — peroxides concentrate and can explode",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0002",
      description: "Solvent for Grignard reagent formation and reaction",
    },
  ],
  relatedReactionTypes: ["Grignard Reaction"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleBenzoicAcid: ChemicalPageData = {
  name: "Benzoic acid",
  casNumber: "65-85-0",
  molecularFormula: "C7H6O2",
  molecularWeight: 122.12,
  commonSynonyms: ["Benzenecarboxylic acid", "Phenylformic acid"],
  summary:
    "Simple aromatic carboxylic acid; commonly used in recrystallization teaching and melting point determination.",
  appearance: "White crystalline flakes or powder",
  meltingPoint: "122.4 °C",
  storageNotes: [
    "Stable at room temperature — no special storage required",
    "Sublimes at temperatures above 100 °C",
  ],
  handlingNotes: [
    "Slightly soluble in cold water, freely soluble in hot water — ideal for recrystallization demos",
    "Sublimation can be used as an alternative purification method",
  ],
  institutionalKnowledge: [
    "The benchmark compound for teaching recrystallization — predictable behavior every time",
    "A sharp melting point (122 °C) indicates high purity; broad range suggests impurities",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0003",
      description: "Subject of recrystallization purification (85% recovery)",
    },
    {
      elnId: "EXP-2025-0018",
      description: "Melting point standard (122 °C)",
    },
  ],
  relatedReactionTypes: ["Acetylation", "Fischer Esterification"],
  relatedResearchers: ["Dr. James Chen", "Prof. Thomas Weber"],
};

export const sampleSulfanilicAcid: ChemicalPageData = {
  name: "Sulfanilic acid",
  casNumber: "121-57-3",
  molecularFormula: "C6H7NO3S",
  molecularWeight: 173.19,
  commonSynonyms: ["4-Aminobenzenesulfonic acid", "p-Aminobenzenesulfonic acid"],
  summary:
    "Aromatic amino sulfonic acid used to form diazonium salts for azo dye synthesis.",
  appearance: "White to slightly gray crystalline powder",
  meltingPoint: "288 °C (dec.)",
  storageNotes: [
    "Store in a cool, dry location",
    "Stable under normal storage conditions",
  ],
  handlingNotes: [
    "Zwitterionic — dissolve in dilute NaOH or Na2CO3 before diazotization",
    "Must be fully dissolved before adding sodium nitrite",
  ],
  institutionalKnowledge: [
    "Solution must be kept below 5 °C during diazotization — diazonium salts decompose above 10 °C",
    "Incomplete dissolution leads to low dye yields and inconsistent color",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0004",
      description: "Diazonium salt precursor for methyl orange synthesis",
    },
  ],
  relatedReactionTypes: ["Diazotization/Azo Coupling"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleSodiumNitrite: ChemicalPageData = {
  name: "Sodium nitrite",
  casNumber: "7632-00-0",
  molecularFormula: "NaNO2",
  molecularWeight: 69.0,
  commonSynonyms: ["NaNO2", "Nitrous acid sodium salt"],
  summary:
    "Inorganic salt used to generate nitrous acid in situ for diazotization reactions.",
  appearance: "White to slightly yellowish crystalline powder",
  meltingPoint: "271 °C",
  storageNotes: [
    "Store away from acids — generates toxic NOx gases on contact",
    "Oxidizer — keep away from combustible materials",
    "Hygroscopic — keep tightly sealed",
  ],
  handlingNotes: [
    "Add as cold aqueous solution to amine/acid mixture below 5 °C",
    "Use stoichiometric amount (1.0 eq) — excess causes decomposition of diazonium",
    "Toxic if ingested — handle with care",
  ],
  institutionalKnowledge: [
    "Dissolve in minimum water and add dropwise — too rapid addition leads to NOx evolution and low yields",
    "Test for excess with starch-iodide paper — a positive test means too much was added",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0004",
      description: "Nitrosating agent for diazotization step",
    },
  ],
  relatedReactionTypes: ["Diazotization/Azo Coupling"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleDimethylaniline: ChemicalPageData = {
  name: "N,N-Dimethylaniline",
  casNumber: "121-69-7",
  molecularFormula: "C8H11N",
  molecularWeight: 121.18,
  commonSynonyms: ["DMA", "Dimethylaminobenzene", "N,N-DMA"],
  summary:
    "Electron-rich aromatic amine that couples with diazonium salts to form azo dyes such as methyl orange.",
  appearance: "Colorless to yellowish oily liquid",
  meltingPoint: "2.5 °C",
  storageNotes: [
    "Store in amber bottle away from light — darkens on exposure",
    "Keep sealed under nitrogen if possible",
  ],
  handlingNotes: [
    "Toxic — handle in fume hood with gloves",
    "Add to slightly alkaline diazonium solution for coupling",
    "Coupling occurs preferentially at the para position",
  ],
  institutionalKnowledge: [
    "Freshly distilled material gives brighter dye colors",
    "The coupling reaction should be done at pH 4-5 for optimal yield",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0004",
      description: "Coupling partner for azo dye formation",
    },
  ],
  relatedReactionTypes: ["Diazotization/Azo Coupling"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleGlacialAceticAcid: ChemicalPageData = {
  name: "Glacial acetic acid",
  casNumber: "64-19-7",
  molecularFormula: "CH3COOH",
  molecularWeight: 60.05,
  commonSynonyms: ["Acetic acid", "Ethanoic acid", "AcOH"],
  summary:
    "Concentrated (>99%) acetic acid used as reactant in Fischer esterification and as solvent.",
  appearance: "Colorless liquid with pungent vinegar odor; solidifies below 16.6 °C",
  meltingPoint: "16.6 °C",
  storageNotes: [
    "Solidifies in cold rooms — warm gently before use",
    "Store in corrosion-resistant containers",
    "Flammable — keep in flammables cabinet",
  ],
  handlingNotes: [
    "Corrosive — use in fume hood with gloves",
    "Glacial grade is anhydrous; diluted grades contain water that shifts esterification equilibrium",
  ],
  institutionalKnowledge: [
    "For Fischer esterification, excess acetic acid drives equilibrium toward ester product",
    "Use Dean-Stark trap or molecular sieves to remove water and improve yields",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0005",
      description: "Reactant for ethyl acetate synthesis",
    },
  ],
  relatedReactionTypes: ["Fischer Esterification"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleEthanol: ChemicalPageData = {
  name: "Ethanol",
  casNumber: "64-17-5",
  molecularFormula: "C2H5OH",
  molecularWeight: 46.07,
  commonSynonyms: ["EtOH", "Ethyl alcohol", "Grain alcohol"],
  summary:
    "Common primary alcohol used as reactant, solvent, and precipitant across organic and biochemistry labs.",
  appearance: "Colorless volatile liquid",
  meltingPoint: "-114.1 °C",
  storageNotes: [
    "Store in flammables cabinet",
    "Absolute (anhydrous) ethanol is hygroscopic — keep sealed",
    "95% ethanol contains 5% water — use absolute grade when anhydrous conditions needed",
  ],
  handlingNotes: [
    "Highly flammable — flash point 13 °C",
    "For esterification, use absolute grade to minimize water content",
    "For DNA precipitation, 95% ethanol is standard",
  ],
  institutionalKnowledge: [
    "95% ethanol from the drum is sufficient for DNA extraction and precipitation",
    "Use absolute ethanol only when anhydrous conditions are critical",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0005",
      description: "Reactant for Fischer esterification with acetic acid",
    },
    {
      elnId: "EXP-2025-0009",
      description: "DNA precipitant (95%)",
    },
  ],
  relatedReactionTypes: ["Fischer Esterification"],
  relatedResearchers: ["Dr. James Chen", "Prof. Thomas Weber"],
};

export const sampleSulfuricAcid: ChemicalPageData = {
  name: "Sulfuric acid",
  casNumber: "7664-93-9",
  molecularFormula: "H2SO4",
  molecularWeight: 98.08,
  commonSynonyms: ["H2SO4", "Oil of vitriol", "Battery acid"],
  summary:
    "Strong mineral acid used as catalyst in Fischer esterification and other acid-catalyzed reactions.",
  appearance: "Colorless, oily, dense liquid",
  meltingPoint: "10.31 °C",
  storageNotes: [
    "Store in acid cabinet in original corrosion-resistant container",
    "Highly hygroscopic — keep tightly sealed",
    "Never store near bases, oxidizable materials, or water",
  ],
  handlingNotes: [
    "Always add acid to water, never water to acid — highly exothermic dilution",
    "Use concentrated (18 M) as catalyst in catalytic amounts (a few drops)",
    "Causes severe burns — full PPE required",
  ],
  institutionalKnowledge: [
    "For Fischer esterification, 1-2 mL concentrated H2SO4 per 0.1 mol substrate is sufficient",
    "Phosphoric acid is a gentler alternative that gives fewer charring side products",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0005",
      description: "Acid catalyst for ethyl acetate synthesis",
    },
  ],
  relatedReactionTypes: ["Fischer Esterification"],
  relatedResearchers: ["Dr. James Chen"],
};

export const sampleBSA: ChemicalPageData = {
  name: "Bovine serum albumin",
  casNumber: "9048-46-8",
  molecularFormula: "Protein (MW ~66.5 kDa)",
  molecularWeight: 66500,
  commonSynonyms: ["BSA", "Fraction V albumin"],
  summary:
    "Purified serum protein used as a standard for protein quantification assays (Bradford, BCA, Lowry).",
  appearance: "White lyophilized powder",
  storageNotes: [
    "Store lyophilized powder at 2-8 °C",
    "Reconstituted solutions should be aliquoted and frozen at -20 °C",
    "Avoid repeated freeze-thaw cycles",
  ],
  handlingNotes: [
    "Prepare 2 mg/mL stock in PBS or water for Bradford assay standard curve",
    "Dissolve gently — do not vortex vigorously to avoid foaming and denaturation",
  ],
  institutionalKnowledge: [
    "Use heat-shock-treated BSA (Fraction V) for consistent Bradford assay results",
    "Aliquot stock into single-use volumes to avoid protein degradation from freeze-thaw",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0006",
      description: "Standard for Bradford protein assay calibration",
    },
  ],
  relatedReactionTypes: ["Protein Analysis"],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleONPG: ChemicalPageData = {
  name: "ONPG",
  casNumber: "369-07-3",
  molecularFormula: "C12H15NO8",
  molecularWeight: 301.25,
  commonSynonyms: ["o-Nitrophenyl-beta-D-galactopyranoside", "2-Nitrophenyl-beta-D-galactopyranoside"],
  summary:
    "Chromogenic substrate for beta-galactosidase (lactase); releases yellow o-nitrophenol upon hydrolysis.",
  appearance: "White to pale yellow crystalline powder",
  meltingPoint: "190-193 °C",
  storageNotes: [
    "Store at -20 °C protected from light",
    "Prepare fresh substrate solutions — aqueous solutions degrade over days",
  ],
  handlingNotes: [
    "Dissolve in phosphate buffer (pH 7.0) at 4 mg/mL for enzyme kinetics",
    "Product (o-nitrophenol) absorbs at 420 nm — use spectrophotometer for quantification",
  ],
  institutionalKnowledge: [
    "Prepare substrate fresh on day of use for best reproducibility",
    "Background hydrolysis increases at pH > 8 — keep assay at pH 7.0",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0007",
      description: "Substrate for lactase kinetics (Km = 2.8 mM)",
    },
  ],
  relatedReactionTypes: ["Protein Analysis"],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleAcrylamide: ChemicalPageData = {
  name: "Acrylamide",
  casNumber: "79-06-1",
  molecularFormula: "C3H5NO",
  molecularWeight: 71.08,
  commonSynonyms: ["2-Propenamide", "Acrylic amide"],
  summary:
    "Monomer used to cast polyacrylamide gels for SDS-PAGE protein electrophoresis.",
  appearance: "White crystalline powder",
  meltingPoint: "84.5 °C",
  storageNotes: [
    "Store at 2-8 °C protected from light",
    "Neurotoxic — always use pre-made 30% stock solutions when available",
    "Discard solutions that appear yellow (indicates degradation)",
  ],
  handlingNotes: [
    "NEUROTOXIN — wear double gloves, work in fume hood when handling powder",
    "Use pre-made 30% acrylamide/bis-acrylamide (29:1) solution to minimize handling",
    "Unpolymerized acrylamide is the hazard — polymerized gels are safe to handle with gloves",
  ],
  institutionalKnowledge: [
    "Use the pre-made 30% solution from Bio-Rad — never weigh out powder unless absolutely necessary",
    "12% resolving gel is standard for proteins 20-100 kDa",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0008",
      description: "Gel matrix component for SDS-PAGE",
    },
  ],
  relatedReactionTypes: ["Protein Analysis"],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleTEMED: ChemicalPageData = {
  name: "TEMED",
  casNumber: "110-18-9",
  molecularFormula: "C6H16N2",
  molecularWeight: 116.2,
  commonSynonyms: ["N,N,N',N'-Tetramethylethylenediamine", "Tetramethylethylenediamine"],
  summary:
    "Polymerization catalyst used together with APS to initiate acrylamide gel polymerization.",
  appearance: "Colorless liquid with fishy amine odor",
  meltingPoint: "-55 °C",
  storageNotes: [
    "Store at room temperature",
    "Keep tightly capped — absorbs moisture and CO2 from air",
  ],
  handlingNotes: [
    "Use small volumes (5-15 µL per gel) — a little goes a long way",
    "Add TEMED last before pouring gel — polymerization begins immediately",
    "Flammable — keep away from open flame",
  ],
  institutionalKnowledge: [
    "If gels are not polymerizing, check TEMED age — old TEMED loses activity",
    "Replace TEMED bottle every 6-12 months for reliable gel casting",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0008",
      description: "Polymerization catalyst for SDS-PAGE gel",
    },
  ],
  relatedReactionTypes: ["Protein Analysis"],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleAPS: ChemicalPageData = {
  name: "Ammonium persulfate",
  casNumber: "7727-54-0",
  molecularFormula: "(NH4)2S2O8",
  molecularWeight: 228.2,
  commonSynonyms: ["APS", "Ammonium peroxodisulfate"],
  summary:
    "Free radical initiator for polyacrylamide gel polymerization in SDS-PAGE.",
  appearance: "White crystalline powder",
  storageNotes: [
    "Prepare 10% (w/v) solution fresh weekly — loses activity in solution",
    "Store powder desiccated at room temperature",
    "Aliquot 10% solution and freeze at -20 °C for longer shelf life",
  ],
  handlingNotes: [
    "Oxidizer — keep away from reducing agents",
    "10% APS solution: dissolve 0.1 g in 1 mL water",
    "Add 50 µL of 10% APS per mini-gel",
  ],
  institutionalKnowledge: [
    "Stale APS is the #1 cause of gels failing to polymerize — always make fresh",
    "Frozen aliquots maintain activity for ~1 month",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0008",
      description: "Free radical source for gel polymerization",
    },
  ],
  relatedReactionTypes: ["Protein Analysis"],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleSDS: ChemicalPageData = {
  name: "Sodium dodecyl sulfate",
  casNumber: "151-21-3",
  molecularFormula: "C12H25NaO4S",
  molecularWeight: 288.38,
  commonSynonyms: ["SDS", "Sodium lauryl sulfate", "SLS"],
  summary:
    "Anionic detergent that denatures proteins and imparts uniform negative charge for electrophoretic separation by molecular weight.",
  appearance: "White powder",
  storageNotes: [
    "Store at room temperature — very stable",
    "Precipitates below 15 °C — warm buffer if white precipitate forms",
  ],
  handlingNotes: [
    "Irritant — avoid creating dust, wear mask when weighing",
    "10% SDS stock solution is standard",
    "SDS precipitates with potassium salts — do not use KCl in SDS-PAGE buffers",
  ],
  institutionalKnowledge: [
    "If running buffer has white precipitate in cold room, warm to RT before use",
    "SDS-PAGE running buffer: 25 mM Tris, 192 mM glycine, 0.1% SDS",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0008",
      description: "Denaturing agent in SDS-PAGE system",
    },
  ],
  relatedReactionTypes: ["Protein Analysis"],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleSucrose: ChemicalPageData = {
  name: "Sucrose",
  casNumber: "57-50-1",
  molecularFormula: "C12H22O11",
  molecularWeight: 342.3,
  commonSynonyms: ["Table sugar", "Saccharose"],
  summary:
    "Disaccharide used as a carbon source in fermentation experiments and as a cryoprotectant.",
  appearance: "White crystalline granules",
  meltingPoint: "186 °C (dec.)",
  storageNotes: [
    "Store in sealed container at room temperature",
    "Hygroscopic — keep away from moisture",
  ],
  handlingNotes: [
    "Dissolve in warm water for fermentation experiments",
    "5-10% (w/v) solutions are standard for yeast fermentation studies",
  ],
  institutionalKnowledge: [
    "Reagent-grade sucrose and food-grade sugar give identical results for fermentation demos",
    "Yeast invertase cleaves sucrose to glucose + fructose before fermentation",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0011",
      description: "Carbon source for yeast fermentation",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleSodiumChloride: ChemicalPageData = {
  name: "Sodium chloride",
  casNumber: "7647-14-5",
  molecularFormula: "NaCl",
  molecularWeight: 58.44,
  commonSynonyms: ["NaCl", "Table salt", "Halite"],
  summary:
    "Ubiquitous inorganic salt used for saline solutions, DNA extraction, plasmolysis demonstrations, and brine washes.",
  appearance: "White crystalline powder or granules",
  meltingPoint: "801 °C",
  storageNotes: [
    "Stable — store at room temperature in sealed container",
  ],
  handlingNotes: [
    "For plasmolysis: prepare 5-10% (w/v) NaCl in water",
    "For DNA extraction: 1-2 g per 100 mL extraction buffer",
    "Saturated NaCl (brine) used for organic extractions",
  ],
  institutionalKnowledge: [
    "Food-grade salt is sufficient for biology demos; use reagent-grade for analytical work",
    "5% NaCl causes visible plasmolysis in Elodea within 5 minutes",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0009",
      description: "Cell lysis buffer component for DNA extraction",
    },
    {
      elnId: "EXP-2025-0012",
      description: "Hypertonic solution for plasmolysis demonstration",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Prof. Thomas Weber"],
};

export const sampleCalciumChloride: ChemicalPageData = {
  name: "Calcium chloride",
  casNumber: "10043-52-4",
  molecularFormula: "CaCl2",
  molecularWeight: 110.98,
  commonSynonyms: ["CaCl2", "Calcium dichloride"],
  summary:
    "Divalent salt used to make competent bacterial cells for transformation by neutralizing cell membrane charge.",
  appearance: "White deliquescent granules or powder",
  meltingPoint: "772 °C",
  storageNotes: [
    "Extremely hygroscopic — keep in desiccator or tightly sealed",
    "Prepare 50 mM CaCl2 solution fresh and autoclave",
  ],
  handlingNotes: [
    "Use ice-cold 50 mM CaCl2 for preparing competent cells",
    "Exothermic dissolution — add slowly to water",
  ],
  institutionalKnowledge: [
    "Competent cells prepared with CaCl2 should be used within 24 hours for best efficiency",
    "Adding 15% glycerol allows storage of competent cells at -80 °C for months",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0013",
      description: "Competent cell preparation for bacterial transformation",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Prof. Thomas Weber"],
};

export const sampleMTT: ChemicalPageData = {
  name: "MTT",
  casNumber: "298-93-1",
  molecularFormula: "C18H16BrN5S",
  molecularWeight: 414.32,
  commonSynonyms: [
    "Thiazolyl blue tetrazolium bromide",
    "3-(4,5-Dimethylthiazol-2-yl)-2,5-diphenyltetrazolium bromide",
  ],
  summary:
    "Tetrazolium dye reduced by metabolically active cells to form purple formazan crystals; used for cell viability assays.",
  appearance: "Yellow crystalline powder",
  storageNotes: [
    "Store at -20 °C protected from light",
    "Prepare 5 mg/mL stock in PBS, filter-sterilize, aliquot, and freeze",
  ],
  handlingNotes: [
    "Light-sensitive — wrap stock solution in foil",
    "Add to cell culture at 10% of medium volume",
    "Incubate 2-4 hours at 37 °C before solubilizing formazan",
  ],
  institutionalKnowledge: [
    "Discard stock if it turns green/brown — indicates degradation",
    "DMSO is the standard formazan solubilizer — read absorbance at 570 nm",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0015",
      description: "Cell viability reagent for cytotoxicity assessment",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleDMSO: ChemicalPageData = {
  name: "DMSO",
  casNumber: "67-68-5",
  molecularFormula: "(CH3)2SO",
  molecularWeight: 78.13,
  commonSynonyms: ["Dimethyl sulfoxide", "Methyl sulfoxide"],
  summary:
    "Polar aprotic solvent; used to solubilize formazan crystals in MTT assays and as cryoprotectant.",
  appearance: "Colorless hygroscopic liquid",
  meltingPoint: "18.5 °C",
  storageNotes: [
    "Store at room temperature — solidifies in cold rooms (mp 18.5 °C)",
    "Use molecular biology grade for cell work",
    "Hygroscopic — keep sealed",
  ],
  handlingNotes: [
    "Rapidly penetrates skin and carries dissolved solutes into tissue — wear gloves",
    "Use cell-culture-grade DMSO for MTT assays",
  ],
  institutionalKnowledge: [
    "DMSO above 0.1% (v/v) can affect cell viability — include vehicle controls",
    "For MTT assays, add 100 µL DMSO per well of a 96-well plate to dissolve formazan",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0015",
      description: "Formazan solubilizer for MTT assay",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Dr. Sarah Kim"],
};

export const sampleHCl: ChemicalPageData = {
  name: "Hydrochloric acid",
  casNumber: "7647-01-0",
  molecularFormula: "HCl",
  molecularWeight: 36.46,
  commonSynonyms: ["HCl", "Muriatic acid"],
  summary:
    "Strong mineral acid used for pH adjustment, tissue maceration in microscopy, and various preparations.",
  appearance: "Colorless fuming liquid (concentrated); clear solution (dilute)",
  storageNotes: [
    "Store concentrated HCl in acid cabinet with good ventilation",
    "Fuming — keep capped tightly",
  ],
  handlingNotes: [
    "Use 1 M HCl for onion root tip maceration",
    "Always add acid to water for dilution",
    "Corrosive — full PPE required for concentrated solutions",
  ],
  institutionalKnowledge: [
    "1 M HCl at 60 °C for 5 min softens onion root tips for squash preparations",
    "12 M (concentrated) HCl fumes — always open in a fume hood",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0014",
      description: "Root tip maceration agent (1 M)",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Prof. Thomas Weber"],
};

export const sampleAcetone: ChemicalPageData = {
  name: "Acetone",
  casNumber: "67-64-1",
  molecularFormula: "CH3COCH3",
  molecularWeight: 58.08,
  commonSynonyms: ["Propanone", "2-Propanone", "Dimethyl ketone"],
  summary:
    "Common low-boiling solvent used for plant pigment extraction and TLC development.",
  appearance: "Colorless volatile liquid with sweet odor",
  meltingPoint: "-94.7 °C",
  storageNotes: [
    "Store in flammables cabinet",
    "Volatile — keep tightly sealed to prevent evaporation",
  ],
  handlingNotes: [
    "Highly flammable — flash point -20 °C",
    "Good solvent for extracting pigments from spinach/plant tissue",
    "Use reagent-grade for TLC; technical grade for cleaning",
  ],
  institutionalKnowledge: [
    "Acetone/petroleum ether mixtures are excellent TLC developers for plant pigments",
    "Mortar and pestle extraction with sand + acetone gives good pigment recovery from spinach",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0016",
      description: "Extraction solvent and TLC co-developer for plant pigments",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Prof. Thomas Weber"],
};

export const samplePetroleumEther: ChemicalPageData = {
  name: "Petroleum ether",
  casNumber: "8032-32-4",
  molecularFormula: "Mixture of C5-C6 alkanes",
  molecularWeight: 70,
  commonSynonyms: ["Pet ether", "Ligroin", "Light petroleum"],
  summary:
    "Low-polarity hydrocarbon solvent mixture used for TLC development and non-polar extractions.",
  appearance: "Colorless volatile liquid with petroleum odor",
  meltingPoint: "-40 to -60 °C (range)",
  storageNotes: [
    "Store in flammables cabinet — extremely flammable",
    "Peroxide-forming — test regularly",
  ],
  handlingNotes: [
    "Very volatile — cap TLC chambers tightly and allow equilibration",
    "Not actually an ether — mixture of alkanes despite the name",
    "Use as non-polar component of TLC developing solvent",
  ],
  institutionalKnowledge: [
    "Petroleum ether:acetone 7:3 is a good starting ratio for plant pigment TLC",
    "Hexanes can substitute for petroleum ether with similar results",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0016",
      description: "TLC developing solvent (non-polar component)",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Prof. Thomas Weber"],
};

export const sampleMethylOrangeChemical: ChemicalPageData = {
  name: "Methyl orange",
  casNumber: "547-58-0",
  molecularFormula: "C14H14N3NaO3S",
  molecularWeight: 327.33,
  commonSynonyms: ["C.I. 13025", "Orange III", "Helianthine"],
  summary:
    "Azo dye and pH indicator (red below pH 3.1, yellow above pH 4.4); used in UV-Vis Beer-Lambert demonstrations.",
  appearance: "Orange-yellow powder",
  meltingPoint: "300 °C (dec.)",
  storageNotes: [
    "Store in dark bottle away from light",
    "Aqueous solutions are stable for months at room temperature",
  ],
  handlingNotes: [
    "Prepare 0.01-0.10 mM solutions for Beer-Lambert experiments",
    "lambda_max = 464 nm in water at pH 7",
    "Stains skin and clothing — handle carefully",
  ],
  institutionalKnowledge: [
    "0.1% aqueous stock solution is convenient for making dilutions",
    "Absorbance is pH-dependent — standardize pH when constructing calibration curves",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0017",
      description: "Analyte for Beer-Lambert law verification at 464 nm",
    },
  ],
  relatedReactionTypes: ["Diazotization/Azo Coupling"],
  relatedResearchers: ["Prof. Thomas Weber"],
};

export const sampleTransCinnamicAcid: ChemicalPageData = {
  name: "trans-Cinnamic acid",
  casNumber: "140-10-3",
  molecularFormula: "C9H8O2",
  molecularWeight: 148.16,
  commonSynonyms: ["(E)-3-Phenylacrylic acid", "beta-Phenylacrylic acid", "Cinnamic acid"],
  summary:
    "Unsaturated aromatic carboxylic acid used as a melting point standard (133 °C).",
  appearance: "White crystalline powder",
  meltingPoint: "133 °C",
  storageNotes: [
    "Stable at room temperature",
    "Keep sealed — sublimes slowly",
  ],
  handlingNotes: [
    "Useful melting point reference standard",
    "Slightly soluble in cold water, soluble in ethanol",
  ],
  institutionalKnowledge: [
    "Good intermediate-range melting point standard between benzoic acid (122 °C) and acetanilide (114 °C)",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0018",
      description: "Melting point standard (133 °C)",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Prof. Thomas Weber"],
};

export const sampleAcetanilide: ChemicalPageData = {
  name: "Acetanilide",
  casNumber: "103-84-4",
  molecularFormula: "C8H9NO",
  molecularWeight: 135.16,
  commonSynonyms: ["N-Phenylacetamide", "Antifebrin"],
  summary:
    "Simple amide used as melting point standard (114 °C) and in identification of unknowns.",
  appearance: "White crystalline flakes or powder",
  meltingPoint: "114 °C",
  storageNotes: [
    "Stable at room temperature",
    "No special storage requirements",
  ],
  handlingNotes: [
    "Low toxicity — safe for student use with standard precautions",
    "Dissolves in hot water, ethanol, and acetone",
  ],
  institutionalKnowledge: [
    "The classic 'unknown' in melting point determination labs — students can distinguish it from benzoic acid and cinnamic acid by mp alone",
  ],
  usedInExperiments: [
    {
      elnId: "EXP-2025-0018",
      description: "Melting point standard (114 °C)",
    },
  ],
  relatedReactionTypes: [],
  relatedResearchers: ["Prof. Thomas Weber"],
};

// ===========================================================================
// RESEARCHERS
// ===========================================================================

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

export const sampleDrChen: ResearcherPageData = {
  name: "Dr. James Chen",
  email: "j.chen@institute.edu",
  experimentCount: 5,
  primaryExpertise: ["Organic synthesis", "Grignard reactions", "Acetylation", "Azo dye chemistry"],
  summary:
    "Organic chemist with expertise in classical synthesis techniques including Grignard reactions, acetylation, and diazo coupling. 5 documented experiments.",
  expertiseAreas: [
    {
      area: "Grignard Reaction",
      description:
        "Experienced with aryl and alkyl Grignard reagents; developed reliable initiation protocols",
    },
    {
      area: "Acetylation",
      description:
        "Aspirin synthesis and related ester/amide formations using acylating agents",
    },
    {
      area: "Diazotization/Azo Coupling",
      description:
        "Azo dye synthesis including methyl orange; expertise in low-temperature diazonium chemistry",
    },
    {
      area: "Fischer Esterification",
      description:
        "Acid-catalyzed esterification with equilibrium-driven methodology",
    },
  ],
  recentExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Aspirin synthesis — 92.7% yield",
    },
    {
      elnId: "EXP-2025-0002",
      description: "Grignard synthesis of triphenylmethanol — 84% yield",
    },
    {
      elnId: "EXP-2025-0003",
      description: "Recrystallization of benzoic acid — 85% recovery",
    },
    {
      elnId: "EXP-2025-0004",
      description: "Methyl orange synthesis — in progress",
    },
    {
      elnId: "EXP-2025-0005",
      description: "Fischer esterification of ethyl acetate — planned",
    },
  ],
  notableResults: [
    "Achieved 92.7% yield in aspirin synthesis with mp matching literature value ([[EXP-2025-0001]])",
    "84% yield in Grignard reaction with reliable initiation protocol ([[EXP-2025-0002]])",
    "Developed efficient recrystallization procedure with 85% recovery ([[EXP-2025-0003]])",
  ],
  institutionalKnowledge: [
    "For Grignard initiation: crush Mg turnings, add a crystal of I2, and warm gently — do not use heat gun",
    "Aspirin recrystallization from hot water gives large crystals with sharp melting point",
    "Diazotization MUST be done below 5 °C — set up ice bath before starting",
    "Fischer esterification equilibrium is slow — use Dean-Stark trap or excess alcohol",
  ],
  whenToAsk:
    "Classical organic synthesis techniques, Grignard reactions, esterification, purification strategies, and recrystallization optimization",
};

export const sampleDrKim: ResearcherPageData = {
  name: "Dr. Sarah Kim",
  email: "s.kim@institute.edu",
  experimentCount: 6,
  primaryExpertise: ["Protein analysis", "Enzyme kinetics", "Cell biology", "Biochemical assays"],
  summary:
    "Biochemist specializing in protein analysis techniques, enzyme kinetics, and cell viability assays. 6 documented experiments.",
  expertiseAreas: [
    {
      area: "Protein Analysis",
      description:
        "Expert in Bradford assay, SDS-PAGE, and Western blot techniques for protein quantification and detection",
    },
    {
      area: "Enzyme Kinetics",
      description:
        "Michaelis-Menten kinetics, lactase activity assays, and spectrophotometric rate measurements",
    },
    {
      area: "Cell Biology",
      description:
        "MTT viability assays, yeast fermentation studies, and mammalian cell culture",
    },
  ],
  recentExperiments: [
    {
      elnId: "EXP-2025-0006",
      description: "Bradford protein assay — R² = 0.998",
    },
    {
      elnId: "EXP-2025-0007",
      description: "Enzyme kinetics of lactase — Km = 2.8 mM",
    },
    {
      elnId: "EXP-2025-0008",
      description: "SDS-PAGE gel electrophoresis — in progress",
    },
    {
      elnId: "EXP-2025-0010",
      description: "Western blot of GAPDH — planned",
    },
    {
      elnId: "EXP-2025-0011",
      description: "Yeast fermentation temperature study — completed",
    },
    {
      elnId: "EXP-2025-0015",
      description: "MTT cell viability assay — planned",
    },
  ],
  notableResults: [
    "Bradford assay standard curve with R² = 0.998 — excellent linearity ([[EXP-2025-0006]])",
    "Determined lactase Km = 2.8 mM and Vmax = 0.42 µmol/min with clean Michaelis-Menten fit ([[EXP-2025-0007]])",
    "Identified optimal yeast fermentation temperature of 35-40 °C ([[EXP-2025-0011]])",
  ],
  institutionalKnowledge: [
    "Bradford reagent binds primarily to arginine and aromatic residues — different proteins give different response factors",
    "Always include a BSA standard curve with every Bradford assay run — do not reuse old curves",
    "For SDS-PAGE, make APS fresh weekly — stale APS is the #1 cause of gel polymerization failure",
    "MTT incubation time is cell-line dependent — optimize for each new cell line",
  ],
  whenToAsk:
    "Protein quantification, enzyme kinetics experimental design, SDS-PAGE troubleshooting, Western blot optimization, cell viability assays",
};

export const sampleProfWeber: ResearcherPageData = {
  name: "Prof. Thomas Weber",
  email: "t.weber@institute.edu",
  experimentCount: 7,
  primaryExpertise: ["Analytical chemistry", "Teaching demonstrations", "Microscopy", "Chromatography"],
  summary:
    "Analytical chemist and educator specializing in chromatography, spectroscopy, and biology teaching demonstrations. 7 documented experiments.",
  expertiseAreas: [
    {
      area: "Chromatography",
      description:
        "TLC, column chromatography, and HPLC; expert in plant pigment separation and Rf optimization",
    },
    {
      area: "Spectroscopy",
      description:
        "UV-Vis spectroscopy, Beer-Lambert law applications, melting point determination",
    },
    {
      area: "Biology Teaching",
      description:
        "DNA extraction, plasmolysis, bacterial transformation, and mitosis demonstration labs",
    },
  ],
  recentExperiments: [
    {
      elnId: "EXP-2025-0016",
      description: "TLC of plant pigments — completed",
    },
    {
      elnId: "EXP-2025-0017",
      description: "UV-Vis Beer-Lambert verification — in progress",
    },
    {
      elnId: "EXP-2025-0018",
      description: "Melting point determination lab — completed",
    },
    {
      elnId: "EXP-2025-0009",
      description: "DNA extraction from strawberries — in progress",
    },
    {
      elnId: "EXP-2025-0012",
      description: "Plant cell plasmolysis — completed",
    },
    {
      elnId: "EXP-2025-0013",
      description: "Bacterial transformation with pGLO — in progress",
    },
    {
      elnId: "EXP-2025-0014",
      description: "Onion root tip mitosis — planned",
    },
  ],
  notableResults: [
    "Resolved all major plant pigments by TLC with distinct Rf values ([[EXP-2025-0016]])",
    "Melting point determinations within 1-2 °C of literature values ([[EXP-2025-0018]])",
    "Reliable plasmolysis demonstration with 100% student success rate ([[EXP-2025-0012]])",
  ],
  institutionalKnowledge: [
    "For TLC of plant pigments, let the chamber equilibrate 10 min before developing — streaky results otherwise",
    "Mel-Temp apparatus needs 15 min warm-up for stable readings",
    "DNA extraction works best with ripe, soft strawberries — frozen then thawed are ideal",
    "pGLO transformation plates need 24-48 h at 37 °C — do not check too early",
    "For plasmolysis: use young Elodea leaves from growing tips — old leaves respond poorly",
  ],
  whenToAsk:
    "Analytical techniques (TLC, UV-Vis, melting point), teaching lab setup and troubleshooting, biology demonstrations, chromatography optimization",
};

// ===========================================================================
// REACTION TYPES
// ===========================================================================

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

export const sampleAcetylation: ReactionTypePageData = {
  name: "Acetylation",
  experimentCount: 1,
  avgYield: 93,
  successRate: "100% (1/1)",
  researcherCount: 1,
  summary:
    "Acylation of hydroxyl or amino groups using acetic anhydride or acetyl chloride; used for aspirin synthesis and protecting group chemistry.",
  whatWorksWell: [
    "[[Acetic anhydride]] with [[Phosphoric acid]] catalyst at 85 °C for 15 minutes",
    "Excess acetic anhydride drives reaction to completion",
    "Ice water quench hydrolyzes excess anhydride cleanly",
    "Recrystallization from hot water gives analytically pure product",
  ],
  commonPitfalls: [
    "Incomplete reaction if temperature too low or time too short",
    "Oily product if impure salicylic acid used",
    "Excess sulfuric acid catalyst causes charring — phosphoric acid is gentler",
    "Wet starting material slows reaction by hydrolyzing acetic anhydride",
  ],
  substrateAdvice: [
    {
      substrateClass: "Carboxylic Acids",
      advice:
        "Salicylic acid acetylation works well; for other phenols/alcohols, consider pyridine as base catalyst",
    },
  ],
  whoToAsk: [
    {
      researcher: "Dr. James Chen",
      expertise: "Aspirin synthesis, acetylation conditions optimization",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Aspirin synthesis — 92.7% yield, mp 134-136 °C",
    },
  ],
  relatedReactionTypes: ["Fischer Esterification"],
  commonCatalysts: ["Phosphoric acid", "Sulfuric acid"],
};

export const sampleGrignardReaction: ReactionTypePageData = {
  name: "Grignard Reaction",
  experimentCount: 1,
  avgYield: 84,
  successRate: "100% (1/1)",
  researcherCount: 1,
  summary:
    "Formation of organomagnesium halides (RMgX) from alkyl/aryl halides and magnesium, followed by nucleophilic addition to electrophiles.",
  whatWorksWell: [
    "Thoroughly dried glassware and anhydrous [[Diethyl ether]] are essential",
    "Crush or score [[Magnesium turnings]] and add a crystal of I2 to initiate",
    "Dropwise addition of [[Bromobenzene]] controls the exotherm",
    "Add [[Benzophenone]] at 0 °C after Grignard formation is complete",
  ],
  commonPitfalls: [
    "Moisture kills the reaction — all glassware, reagents, and solvents must be strictly anhydrous",
    "Grignard initiation failure — surface oxide on Mg prevents reaction; crush turnings and add I2",
    "Runaway exotherm if halide added too fast",
    "Ether reflux and bumping at larger scales — use mechanical stirring",
  ],
  whoToAsk: [
    {
      researcher: "Dr. James Chen",
      expertise: "Grignard initiation troubleshooting, anhydrous technique, workup procedures",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2025-0002",
      description: "Synthesis of triphenylmethanol via PhMgBr + benzophenone — 84% yield",
    },
  ],
  relatedReactionTypes: ["Suzuki Coupling"],
  commonCatalysts: [],
};

export const sampleDiazotization: ReactionTypePageData = {
  name: "Diazotization/Azo Coupling",
  experimentCount: 1,
  researcherCount: 1,
  summary:
    "Formation of diazonium salts from aromatic amines and sodium nitrite at low temperature, followed by coupling with electron-rich aromatics to form azo dyes.",
  whatWorksWell: [
    "Keep reaction temperature below 5 °C at all times during diazotization",
    "Dissolve [[Sulfanilic acid]] in dilute NaOH before adding [[Sodium nitrite]]",
    "Add HCl slowly to generate nitrous acid in situ",
    "Coupling with [[N,N-Dimethylaniline]] proceeds best at pH 4-5",
  ],
  commonPitfalls: [
    "Temperature above 10 °C decomposes diazonium salt — reaction fails",
    "Excess sodium nitrite causes side reactions — use exactly 1.0 eq",
    "Incomplete dissolution of sulfanilic acid leads to low yields",
    "pH too high during coupling gives sluggish reaction; pH too low causes decomposition",
  ],
  whoToAsk: [
    {
      researcher: "Dr. James Chen",
      expertise: "Low-temperature diazonium chemistry, azo dye synthesis",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2025-0004",
      description: "Methyl orange synthesis via diazotization/coupling — in progress",
    },
  ],
  relatedReactionTypes: ["Acetylation"],
  commonCatalysts: [],
};

export const sampleFischerEsterification: ReactionTypePageData = {
  name: "Fischer Esterification",
  experimentCount: 1,
  researcherCount: 1,
  summary:
    "Acid-catalyzed condensation of a carboxylic acid and an alcohol to form an ester and water; equilibrium reaction driven by Le Chatelier's principle.",
  whatWorksWell: [
    "Use excess alcohol or acid to drive equilibrium toward ester",
    "Concentrated [[Sulfuric acid]] catalyst (a few drops) speeds the reaction",
    "Dean-Stark trap removes water to shift equilibrium",
    "Reflux for 60-90 minutes with good mixing",
  ],
  commonPitfalls: [
    "Equilibrium reaction — yields plateau without water removal",
    "Excess sulfuric acid causes dehydration/charring of reactants",
    "Product (ethyl acetate) is volatile — use efficient condenser to prevent loss",
    "Side reactions (elimination, etherification) at high temperatures with some substrates",
  ],
  substrateAdvice: [
    {
      substrateClass: "Carboxylic Acids",
      advice:
        "Simple aliphatic acids esterify easily; aromatic and sterically hindered acids are slower",
    },
  ],
  whoToAsk: [
    {
      researcher: "Dr. James Chen",
      expertise: "Esterification equilibria, Dean-Stark technique, distillation workup",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2025-0005",
      description: "Ethyl acetate synthesis from acetic acid + ethanol — planned",
    },
  ],
  relatedReactionTypes: ["Acetylation"],
  commonCatalysts: ["Sulfuric acid"],
};

export const sampleProteinAnalysis: ReactionTypePageData = {
  name: "Protein Analysis",
  experimentCount: 3,
  researcherCount: 1,
  summary:
    "Techniques for protein quantification (Bradford), separation (SDS-PAGE), and detection (Western blot) — core biochemistry methods.",
  whatWorksWell: [
    "Bradford assay: use [[Bovine serum albumin]] standard at 0-2 mg/mL range for linear response",
    "SDS-PAGE: 12% resolving gel for 20-100 kDa proteins; fresh [[Ammonium persulfate]] is critical",
    "Always run molecular weight markers alongside samples",
    "Pre-stained markers speed up gel monitoring during electrophoresis",
  ],
  commonPitfalls: [
    "Stale APS causes gel polymerization failure — make fresh weekly",
    "Bradford reagent gives nonlinear response at high protein concentrations (>2 mg/mL)",
    "Bubbles in the gel create distorted bands — pour slowly and use water overlay",
    "Overloading gel wells causes smearing — optimize protein loading",
  ],
  substrateAdvice: [
    {
      substrateClass: "Proteins",
      advice:
        "Membrane proteins require more SDS for solubilization; add extra SDS to loading buffer",
    },
  ],
  whoToAsk: [
    {
      researcher: "Dr. Sarah Kim",
      expertise: "Bradford assay, SDS-PAGE troubleshooting, Western blot optimization",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2025-0006",
      description: "Bradford protein assay — R² = 0.998",
    },
    {
      elnId: "EXP-2025-0008",
      description: "SDS-PAGE gel electrophoresis — in progress",
    },
    {
      elnId: "EXP-2025-0010",
      description: "Western blot of GAPDH — planned",
    },
  ],
  commonCatalysts: [],
};

// ===========================================================================
// SUBSTRATE CLASSES
// ===========================================================================

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

export const sampleCarboxylicAcids: SubstrateClassPageData = {
  name: "Carboxylic Acids",
  experimentCount: 4,
  summary:
    "Compounds containing the -COOH functional group; versatile substrates for esterification, acetylation, recrystallization, and as melting point standards.",
  commonChallenges: [
    "Equilibrium limitations in esterification — water must be removed to drive yields higher",
    "Decarboxylation at high temperatures with some substrates",
    "Solubility can be low in non-polar solvents — may need polar co-solvents",
    "Dimerization via hydrogen bonding complicates spectroscopic analysis",
  ],
  successfulStrategies: [
    "Dean-Stark trap or molecular sieves to remove water in esterification",
    "Recrystallization from hot water is effective for most simple aromatic carboxylic acids",
    "Acid-catalyzed esterification with excess alcohol drives equilibrium",
    "Sublimation is an alternative purification for benzoic acid and related compounds",
  ],
  reactionAdvice: [
    {
      reactionType: "Fischer Esterification",
      advice: "Use excess alcohol and catalytic H2SO4; remove water via Dean-Stark trap for best yields",
    },
    {
      reactionType: "Acetylation",
      advice: "Salicylic acid acetylation is clean with phosphoric acid catalyst at 85 °C",
    },
  ],
  whoHasExperience: [
    {
      researcher: "Dr. James Chen",
      knowledge: "Aspirin synthesis, recrystallization, Fischer esterification",
    },
    {
      researcher: "Prof. Thomas Weber",
      knowledge: "Melting point standards, analytical characterization",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Acetylation of salicylic acid to aspirin — 92.7%",
    },
    {
      elnId: "EXP-2025-0003",
      description: "Recrystallization of benzoic acid — 85% recovery",
    },
    {
      elnId: "EXP-2025-0005",
      description: "Fischer esterification with acetic acid — planned",
    },
    {
      elnId: "EXP-2025-0018",
      description: "Benzoic acid as melting point standard",
    },
  ],
  relatedSubstrateClasses: ["Proteins"],
  commonReactions: ["Acetylation", "Fischer Esterification"],
};

export const sampleProteins: SubstrateClassPageData = {
  name: "Proteins",
  experimentCount: 4,
  summary:
    "Biological macromolecules analyzed by Bradford assay (quantification), SDS-PAGE (separation), Western blot (detection), and enzyme kinetics (activity).",
  commonChallenges: [
    "Protein denaturation during handling — keep samples on ice",
    "Aggregation and precipitation of membrane proteins",
    "Protease degradation — add protease inhibitors to lysis buffers",
    "Non-specific binding in Western blots — optimize blocking conditions",
  ],
  successfulStrategies: [
    "Always work on ice when handling protein samples",
    "Use protease inhibitor cocktail in all lysis buffers",
    "Bradford assay is fast and reliable for soluble proteins",
    "12% SDS-PAGE resolves most common protein targets (20-100 kDa)",
  ],
  reactionAdvice: [
    {
      reactionType: "Protein Analysis",
      advice: "Run BSA standard curve with every Bradford assay; use fresh APS for SDS-PAGE",
    },
  ],
  whoHasExperience: [
    {
      researcher: "Dr. Sarah Kim",
      knowledge: "Bradford assay, SDS-PAGE, Western blot, enzyme kinetics — all protein methods",
    },
  ],
  representativeExperiments: [
    {
      elnId: "EXP-2025-0006",
      description: "Bradford protein quantification — R² = 0.998",
    },
    {
      elnId: "EXP-2025-0007",
      description: "Lactase enzyme kinetics — Km = 2.8 mM",
    },
    {
      elnId: "EXP-2025-0008",
      description: "SDS-PAGE protein separation — in progress",
    },
    {
      elnId: "EXP-2025-0010",
      description: "Western blot of GAPDH — planned",
    },
  ],
  relatedSubstrateClasses: ["Carboxylic Acids"],
  commonReactions: ["Protein Analysis"],
};

// ===========================================================================
// EXPERIMENTS — Existing 3 Suzuki (unchanged)
// ===========================================================================

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

// ===========================================================================
// EXPERIMENTS — New 18 ChemELN experiments
// ===========================================================================

// --- ORGANIC SYNTHESIS ---

export const sampleExp0001: ExperimentPageData = {
  title: "EXP-2025-0001: Synthesis of Aspirin (Acetylsalicylic Acid)",
  elnId: "EXP-2025-0001",
  researcher: "Dr. James Chen",
  date: "2025-01-15",
  status: "completed",
  reactionType: "Acetylation",
  substrateClass: "Carboxylic Acids",
  scaleCategory: "medium",
  scaleMmol: "14.5 mmol",
  qualityScore: 5,
  tags: ["teaching", "classic-synthesis"],
  summary:
    "Acetylation of salicylic acid with acetic anhydride to form aspirin in 92.7% yield with melting point matching literature (134-136 °C).",
  conditions: [
    { parameter: "Temperature", value: "85 °C", notes: "Water bath" },
    { parameter: "Duration", value: "15 minutes" },
    { parameter: "Catalyst", value: "Phosphoric acid (5 drops)" },
    { parameter: "Atmosphere", value: "Air" },
  ],
  reagents: [
    {
      name: "Salicylic acid",
      amount: "2.00 g (14.5 mmol)",
      equivalents: "1.0 eq",
      cas: "69-72-7",
    },
    {
      name: "Acetic anhydride",
      amount: "3.0 mL (31.8 mmol)",
      equivalents: "2.2 eq",
      cas: "108-24-7",
      notes: "Excess drives reaction to completion",
    },
    {
      name: "Phosphoric acid",
      amount: "5 drops (catalytic)",
      equivalents: "cat.",
      cas: "7664-38-2",
      notes: "85% aqueous; gentler than H2SO4",
    },
  ],
  procedureSetup: [
    "Weighed [[Salicylic acid]] (2.00 g, 14.5 mmol) into a dry 125 mL Erlenmeyer flask",
    "Added [[Acetic anhydride]] (3.0 mL, 2.2 eq) directly to the flask",
    "Added 5 drops of [[Phosphoric acid]] (85%) as catalyst",
    "Prepared a water bath at 85 °C",
  ],
  procedureReaction: [
    "Swirled the flask to mix reagents thoroughly",
    "Placed flask in the 85 °C water bath for 15 minutes with occasional swirling",
    "Solution became clear after ~5 minutes indicating dissolution of salicylic acid",
    "After 15 minutes, removed flask from bath",
  ],
  procedureWorkup: [
    "Carefully added 20 mL ice-cold distilled water to decompose excess [[Acetic anhydride]]",
    "Placed flask in ice bath for 10 minutes to induce crystallization",
    "Scratched sides of flask with glass rod to initiate crystal formation",
    "Collected crystals by vacuum filtration on Buchner funnel",
    "Washed crystal cake with 3 x 5 mL ice-cold water",
  ],
  procedurePurification: [
    "Dissolved crude product in 10 mL hot ethanol",
    "Added 25 mL warm water slowly with stirring",
    "Allowed solution to cool slowly to room temperature, then placed in ice bath",
    "Collected recrystallized product by vacuum filtration",
    "Dried in air on filter paper for 30 minutes",
    "Obtained 2.42 g (92.7% yield) of white crystalline needles",
  ],
  results: {
    yield: "92.7% (2.42 g, 13.4 mmol)",
    purity: ">99% by melting point",
    characterization:
      "Mp: 134-136 °C (lit. 135 °C). FT-IR: 1753 cm-1 (ester C=O), 1682 cm-1 (acid C=O), broad O-H stretch 2500-3300 cm-1. No O-H stretch at 3300 cm-1 from salicylic acid starting material.",
  },
  productAppearance: "White crystalline needles",
  practicalNotesWorked: [
    "Phosphoric acid catalyst gives cleaner product than sulfuric acid",
    "Recrystallization from ethanol/water yields large, well-formed crystals",
    "Ice-cold water wash effectively removes acetic acid byproduct",
    "Scratching flask walls with glass rod reliably initiates crystallization",
  ],
  practicalNotesChallenges: [
    "If water is added too fast during workup, product oils out instead of crystallizing",
    "Oily product can be rescued by re-dissolving in warm ethanol and re-precipitating",
  ],
  practicalNotesRecommendations: [
    "Use [[Phosphoric acid]] instead of sulfuric acid for cleaner results",
    "Ensure [[Salicylic acid]] is dry before starting — wet starting material reduces yield",
    "Allow plenty of time for recrystallization — slow cooling gives better crystals",
  ],
  substrateInsights: [
    "[[Carboxylic Acids]]: the phenolic OH of salicylic acid is more reactive than the COOH toward acetylation",
    "Pure salicylic acid (sharp mp 159 °C) is essential for high yield",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0003",
      description: "Recrystallization technique used in purification step",
    },
    {
      elnId: "EXP-2025-0005",
      description: "Related esterification chemistry (Fischer esterification)",
    },
  ],
  relatedChemicals: [
    "Salicylic acid",
    "Acetic anhydride",
    "Phosphoric acid",
  ],
};

export const sampleExp0002: ExperimentPageData = {
  title: "EXP-2025-0002: Grignard Reaction - Synthesis of Triphenylmethanol",
  elnId: "EXP-2025-0002",
  researcher: "Dr. James Chen",
  date: "2025-01-22",
  status: "completed",
  reactionType: "Grignard Reaction",
  scaleCategory: "medium",
  scaleMmol: "12.0 mmol",
  qualityScore: 4,
  tags: ["anhydrous", "classic-synthesis"],
  summary:
    "Grignard reaction of phenylmagnesium bromide with benzophenone to form triphenylmethanol in 84% isolated yield.",
  conditions: [
    { parameter: "Temperature", value: "35 °C (reflux Et2O)", notes: "Then 0 °C for addition" },
    { parameter: "Solvent", value: "Anhydrous diethyl ether", notes: "30 mL total" },
    { parameter: "Atmosphere", value: "Nitrogen", notes: "CaCl2 drying tube" },
    { parameter: "Duration", value: "2.5 hours total" },
  ],
  reagents: [
    {
      name: "Magnesium turnings",
      amount: "0.29 g (12.0 mmol)",
      equivalents: "1.2 eq",
      cas: "7439-95-4",
      notes: "Crushed and scored before use",
    },
    {
      name: "Bromobenzene",
      amount: "1.26 mL (12.0 mmol)",
      equivalents: "1.2 eq",
      cas: "108-86-1",
      notes: "Dried over 4A sieves",
    },
    {
      name: "Benzophenone",
      amount: "1.82 g (10.0 mmol)",
      equivalents: "1.0 eq",
      cas: "119-61-9",
    },
    {
      name: "Diethyl ether",
      amount: "30 mL",
      equivalents: "solvent",
      cas: "60-29-7",
      notes: "Anhydrous, from freshly opened bottle",
    },
  ],
  procedureSetup: [
    "Oven-dried all glassware (250 mL three-neck flask, condenser, addition funnel) overnight at 120 °C",
    "Assembled apparatus under N2 with CaCl2 drying tube on condenser",
    "Added crushed [[Magnesium turnings]] (0.29 g, 12.0 mmol) and a small crystal of I2 to the flask",
    "Added 5 mL anhydrous [[Diethyl ether]] and prepared solution of [[Bromobenzene]] (1.26 mL) in 10 mL Et2O in the addition funnel",
  ],
  procedureReaction: [
    "Added ~1 mL of bromobenzene/ether solution to Mg turnings",
    "Warmed gently with hand — initiation observed after 3 min (solution turned cloudy, gentle reflux)",
    "Added remaining [[Bromobenzene]] solution dropwise over 20 minutes maintaining gentle reflux",
    "After complete addition, refluxed for 30 minutes — solution turned gray-brown (PhMgBr formed)",
    "Cooled to 0 °C in ice bath and added [[Benzophenone]] (1.82 g) dissolved in 15 mL [[Diethyl ether]] dropwise over 15 min",
    "Stirred at 0 °C for 15 min, then allowed to warm to RT and stirred for additional 30 min",
  ],
  procedureWorkup: [
    "Quenched carefully with 20 mL cold saturated NH4Cl solution (added dropwise — exothermic!)",
    "Separated layers; extracted aqueous layer with Et2O (2 x 15 mL)",
    "Combined organic layers, washed with saturated NaHCO3 (15 mL) and brine (15 mL)",
    "Dried over anhydrous MgSO4, filtered, and concentrated on rotary evaporator",
  ],
  procedurePurification: [
    "Crude product was a pale yellow solid",
    "Recrystallized from hot petroleum ether/toluene (3:1)",
    "Collected crystals by vacuum filtration and dried",
    "Obtained 2.18 g (84% yield) of triphenylmethanol as white crystals",
  ],
  results: {
    yield: "84% (2.18 g, 8.38 mmol)",
    purity: ">97% by mp and 1H NMR",
    characterization:
      "Mp: 161-163 °C (lit. 162-164 °C). 1H NMR (400 MHz, CDCl3): delta 7.30-7.24 (m, 15H, ArH), 2.83 (s, 1H, OH). FT-IR: 3467 cm-1 (broad O-H).",
  },
  productAppearance: "White crystalline solid, mp 161-163 °C",
  practicalNotesWorked: [
    "Iodine crystal was key to initiating Grignard formation within 3 minutes",
    "Dropwise addition of bromobenzene controlled the exotherm well",
    "Cooling to 0 °C before adding benzophenone prevented side reactions",
    "NH4Cl quench is safer than water — less vigorous reaction",
  ],
  practicalNotesChallenges: [
    "Grignard initiation took 3 attempts on first try — Mg turnings had thick oxide layer",
    "Ether tends to evaporate during setup — work quickly and keep condenser running",
    "Petroleum ether recrystallization requires hot solution — product crystallizes on cooling",
  ],
  practicalNotesRecommendations: [
    "Always crush [[Magnesium turnings]] with a glass rod and add I2 before starting",
    "Use freshly opened anhydrous [[Diethyl ether]] — old bottles contain water",
    "For faster initiation, briefly use a heat gun on the flask bottom (2-3 seconds)",
    "Do not use a large excess of Mg — unreacted Mg complicates workup",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Another Dr. Chen organic synthesis — different reaction type",
    },
  ],
  relatedChemicals: [
    "Magnesium turnings",
    "Bromobenzene",
    "Benzophenone",
    "Diethyl ether",
  ],
};

export const sampleExp0003: ExperimentPageData = {
  title: "EXP-2025-0003: Recrystallization of Benzoic Acid",
  elnId: "EXP-2025-0003",
  researcher: "Dr. James Chen",
  date: "2025-02-03",
  status: "completed",
  substrateClass: "Carboxylic Acids",
  scaleCategory: "small",
  scaleMmol: "16.4 mmol",
  qualityScore: 4,
  tags: ["teaching", "purification"],
  summary:
    "Recrystallization of benzoic acid from hot water demonstrating fundamental purification technique with 85% recovery and sharp melting point.",
  conditions: [
    { parameter: "Solvent", value: "Distilled water", notes: "~50 mL" },
    { parameter: "Temperature", value: "100 °C (dissolving) to 0 °C (crystallization)" },
    { parameter: "Duration", value: "45 minutes total" },
  ],
  reagents: [
    {
      name: "Benzoic acid",
      amount: "2.00 g (16.4 mmol)",
      equivalents: "N/A",
      cas: "65-85-0",
      notes: "Impure sample with sand and charcoal impurities",
    },
  ],
  procedureSetup: [
    "Weighed impure [[Benzoic acid]] sample (2.00 g) into a 250 mL Erlenmeyer flask",
    "Set up hot plate with water bath and prepared Buchner funnel for vacuum filtration",
    "Brought 60 mL distilled water to boiling in a separate flask",
  ],
  procedureReaction: [
    "Added hot water in small portions (~10 mL at a time) to [[Benzoic acid]] while swirling",
    "Continued adding hot water until all benzoic acid dissolved (~45 mL needed at near-boiling)",
    "If insoluble particles remained, performed hot gravity filtration through fluted filter paper",
  ],
  procedureWorkup: [
    "Allowed hot solution to cool slowly to room temperature (20 min) — crystals began forming at ~60 °C",
    "Placed flask in ice bath for 15 minutes to maximize crystal yield",
    "Collected crystals by vacuum filtration on Buchner funnel",
    "Washed crystals with 2 x 5 mL ice-cold distilled water",
  ],
  procedurePurification: [
    "Allowed crystals to air-dry on filter paper for 30 minutes",
    "Transferred to a watch glass and dried in oven at 60 °C for 1 hour",
    "Obtained 1.70 g (85% recovery) of pure white crystals",
  ],
  results: {
    yield: "85% recovery (1.70 g from 2.00 g crude)",
    purity: "Sharp melting point confirms high purity",
    characterization:
      "Mp: 121-122 °C (lit. 122.4 °C). White crystalline flakes. Pure by TLC (single spot, Rf = 0.45 in EtOAc/hexanes 1:3).",
  },
  productAppearance: "White crystalline flakes",
  practicalNotesWorked: [
    "Slow cooling gives larger, purer crystals than rapid cooling",
    "Using minimum volume of water gives best recovery",
    "Ice bath for final 15 minutes increases yield by ~10%",
    "Hot gravity filtration effectively removes insoluble impurities",
  ],
  practicalNotesChallenges: [
    "Adding too much water reduces recovery — benzoic acid has moderate solubility even in cold water",
    "If solution is cooled too rapidly, small crystals form that are hard to filter",
  ],
  practicalNotesRecommendations: [
    "Use minimum volume of water — dissolve [[Benzoic acid]] with slow hot water addition",
    "Cool slowly for large crystals; rapid cooling gives higher purity but lower recovery",
    "Weigh before and after to demonstrate purification losses in teaching context",
  ],
  substrateInsights: [
    "[[Carboxylic Acids]]: benzoic acid's temperature-dependent solubility in water makes it ideal for recrystallization demos",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Recrystallization used to purify aspirin product",
    },
    {
      elnId: "EXP-2025-0018",
      description: "Melting point determination includes benzoic acid as known standard",
    },
  ],
  relatedChemicals: ["Benzoic acid"],
};

export const sampleExp0004: ExperimentPageData = {
  title: "EXP-2025-0004: Synthesis of Methyl Orange",
  elnId: "EXP-2025-0004",
  researcher: "Dr. James Chen",
  date: "2025-02-10",
  status: "in-progress",
  reactionType: "Diazotization/Azo Coupling",
  scaleCategory: "small",
  scaleMmol: "5.8 mmol",
  qualityScore: 3,
  tags: ["azo-dye", "two-step"],
  summary:
    "Two-step synthesis of methyl orange indicator: diazotization of sulfanilic acid followed by coupling with N,N-dimethylaniline. Currently completing coupling step.",
  conditions: [
    { parameter: "Temperature (Step 1)", value: "0-5 °C", notes: "Ice bath required" },
    { parameter: "Temperature (Step 2)", value: "0-10 °C", notes: "Ice bath" },
    { parameter: "pH (Step 2)", value: "4-5", notes: "Acetate buffer" },
    { parameter: "Duration", value: "~2 hours total" },
  ],
  reagents: [
    {
      name: "Sulfanilic acid",
      amount: "1.00 g (5.8 mmol)",
      equivalents: "1.0 eq",
      cas: "121-57-3",
      notes: "Dissolved in dilute NaOH",
    },
    {
      name: "Sodium nitrite",
      amount: "0.40 g (5.8 mmol)",
      equivalents: "1.0 eq",
      cas: "7632-00-0",
      notes: "Dissolved in 2 mL cold water",
    },
    {
      name: "N,N-Dimethylaniline",
      amount: "0.70 g (5.8 mmol)",
      equivalents: "1.0 eq",
      cas: "121-69-7",
      notes: "Freshly distilled",
    },
  ],
  procedureSetup: [
    "Dissolved [[Sulfanilic acid]] (1.00 g) in 10 mL of 10% NaOH solution with gentle warming",
    "Cooled solution to 0-5 °C in ice-salt bath",
    "Dissolved [[Sodium nitrite]] (0.40 g) in 2 mL cold water",
    "Prepared solution of [[N,N-Dimethylaniline]] (0.70 g) in 2 mL glacial acetic acid",
  ],
  procedureReaction: [
    "Step 1 — Diazotization: Added cold NaNO2 solution dropwise to cold sulfanilic acid/NaOH while maintaining temp below 5 °C",
    "Added 3 mL cold dilute HCl (3 M) to generate diazonium salt",
    "Stirred for 5 minutes at 0-5 °C — solution remained clear pale yellow",
    "Step 2 — Coupling: Added the N,N-dimethylaniline/acetic acid solution to the diazonium salt at 0-5 °C",
    "Orange-red color developed immediately — stirred for 30 minutes at 0-10 °C",
    "Adjusted pH to ~8 with 10% NaOH — color deepened to orange",
  ],
  procedureWorkup: [
    "Salted out by adding NaCl (3 g) with stirring",
    "Collected precipitate by vacuum filtration — orange solid obtained",
    "Washed with small portions of cold saturated NaCl solution",
  ],
  procedurePurification: [
    "Recrystallization from hot water planned for next session",
    "Expected orange crystalline solid",
  ],
  results: {
    yield: "TBD — crude product collected, recrystallization pending",
    characterization: "Crude product is orange solid; pH indicator behavior confirmed (red in acid, yellow in base)",
  },
  productAppearance: "Orange solid (crude)",
  practicalNotesWorked: [
    "Ice-salt bath maintained 0-5 °C effectively throughout diazotization",
    "Orange color appeared immediately upon coupling — indicates diazonium salt was active",
  ],
  practicalNotesChallenges: [
    "Difficult to maintain temperature below 5 °C while adding reagents",
    "Sulfanilic acid dissolution in NaOH was slow — needed gentle warming first",
  ],
  practicalNotesRecommendations: [
    "Prepare all solutions cold before starting the diazotization",
    "Use ice-salt bath (not just ice) to reliably reach 0-5 °C",
    "Test diazonium with beta-naphthol on filter paper to confirm formation before coupling",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0017",
      description: "Methyl orange used as analyte in UV-Vis Beer-Lambert study",
    },
  ],
  relatedChemicals: [
    "Sulfanilic acid",
    "Sodium nitrite",
    "N,N-Dimethylaniline",
  ],
};

export const sampleExp0005: ExperimentPageData = {
  title: "EXP-2025-0005: Fischer Esterification - Ethyl Acetate",
  elnId: "EXP-2025-0005",
  researcher: "Dr. James Chen",
  date: "2025-02-17",
  status: "planned",
  reactionType: "Fischer Esterification",
  substrateClass: "Carboxylic Acids",
  scaleCategory: "medium",
  scaleMmol: "~170 mmol",
  qualityScore: 1,
  tags: ["equilibrium", "distillation"],
  summary:
    "Planned acid-catalyzed esterification of glacial acetic acid with ethanol to produce ethyl acetate, demonstrating equilibrium-driven synthesis.",
  conditions: [
    { parameter: "Temperature", value: "~78 °C (reflux)", notes: "EtOH reflux temp" },
    { parameter: "Catalyst", value: "Concentrated H2SO4", notes: "~1 mL" },
    { parameter: "Duration", value: "60-90 minutes reflux" },
    { parameter: "Setup", value: "Reflux with Dean-Stark trap (planned)" },
  ],
  reagents: [
    {
      name: "Glacial acetic acid",
      amount: "10 mL (170 mmol)",
      equivalents: "1.0 eq",
      cas: "64-19-7",
    },
    {
      name: "Ethanol",
      amount: "15 mL (260 mmol)",
      equivalents: "1.5 eq",
      cas: "64-17-5",
      notes: "Absolute grade preferred",
    },
    {
      name: "Sulfuric acid",
      amount: "1 mL",
      equivalents: "cat.",
      cas: "7664-93-9",
      notes: "Concentrated (18 M); add slowly",
    },
  ],
  procedureSetup: [
    "Assemble reflux apparatus with Dean-Stark trap (or simple reflux condenser)",
    "Add [[Glacial acetic acid]] and [[Ethanol]] to 100 mL round-bottom flask with boiling chips",
    "Slowly add concentrated [[Sulfuric acid]] while swirling — exothermic!",
  ],
  procedureReaction: [
    "Heat to reflux (~78 °C) and maintain for 60-90 minutes",
    "If using Dean-Stark trap, collect water to monitor reaction progress",
    "Monitor by odor — fruity ethyl acetate smell indicates product formation",
  ],
  procedureWorkup: [
    "Cool reaction mixture to room temperature",
    "Pour into separatory funnel with 20 mL water",
    "Separate organic layer (top — ethyl acetate is less dense than water)",
    "Wash organic with saturated NaHCO3 (2 x 15 mL) to remove acetic acid",
    "Wash with brine (15 mL), dry over Na2SO4",
  ],
  procedurePurification: [
    "Simple distillation collecting fraction at 76-78 °C (ethyl acetate bp)",
    "Dry over molecular sieves if needed",
  ],
  results: {
    yield: "TBD — experiment not yet performed",
    characterization: "Expected: colorless liquid, bp 77 °C, fruity odor",
  },
  practicalNotesRecommendations: [
    "Use excess [[Ethanol]] to drive equilibrium toward ester",
    "Dean-Stark trap is ideal but simple reflux works for teaching purposes",
    "Careful neutralization with NaHCO3 — effervescence from CO2 evolution",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0001",
      description: "Related acylation chemistry — aspirin synthesis",
    },
  ],
  relatedChemicals: [
    "Glacial acetic acid",
    "Ethanol",
    "Sulfuric acid",
  ],
};

// --- BIOCHEMISTRY ---

export const sampleExp0006: ExperimentPageData = {
  title: "EXP-2025-0006: Bradford Protein Assay",
  elnId: "EXP-2025-0006",
  researcher: "Dr. Sarah Kim",
  date: "2025-03-01",
  status: "completed",
  reactionType: "Protein Analysis",
  substrateClass: "Proteins",
  scaleCategory: "small",
  qualityScore: 5,
  tags: ["quantification", "spectrophotometry"],
  summary:
    "Bradford protein assay using BSA standard curve achieving R² = 0.998 with linear range 0.1-1.0 mg/mL.",
  conditions: [
    { parameter: "Wavelength", value: "595 nm" },
    { parameter: "Incubation", value: "5 minutes at room temperature" },
    { parameter: "Standard range", value: "0-2.0 mg/mL BSA" },
    { parameter: "Replicates", value: "Triplicate for all points" },
  ],
  reagents: [
    {
      name: "Bovine serum albumin",
      amount: "2 mg/mL stock solution",
      equivalents: "standard",
      cas: "9048-46-8",
      notes: "Fraction V, heat-shock treated",
    },
    {
      name: "Bradford Reagent",
      amount: "50 mL (Bio-Rad)",
      equivalents: "N/A",
      notes: "Pre-made 1x solution from Bio-Rad #5000006",
    },
  ],
  procedureSetup: [
    "Prepared [[Bovine serum albumin]] standards: 0, 0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0 mg/mL by serial dilution in PBS",
    "Prepared unknown protein samples by diluting 1:10 and 1:20 in PBS",
    "Labeled cuvettes in triplicate for each concentration",
  ],
  procedureReaction: [
    "Added 100 µL of each standard/sample to labeled cuvettes",
    "Added 1.0 mL Bradford Reagent to each cuvette and mixed by inversion",
    "Incubated at room temperature for 5 minutes (not exceeding 60 minutes)",
    "Read absorbance at 595 nm against blank (0 mg/mL BSA + Bradford)",
  ],
  procedureWorkup: [
    "Plotted standard curve: absorbance (595 nm) vs. BSA concentration",
    "Fitted linear regression to 0.1-1.0 mg/mL range",
    "Determined unknown protein concentrations from standard curve",
  ],
  procedurePurification: [],
  results: {
    yield: "R² = 0.998 for standard curve (0.1-1.0 mg/mL)",
    characterization:
      "Standard curve equation: A595 = 0.581[BSA] + 0.032. Unknown sample: 3.2 ± 0.1 mg/mL (after dilution correction). Linear range confirmed: 0.1-1.0 mg/mL.",
  },
  productAppearance: "Blue-colored solutions; intensity proportional to protein concentration",
  practicalNotesWorked: [
    "Triplicate measurements gave excellent reproducibility (CV < 3%)",
    "5-minute incubation is sufficient — no change observed up to 30 min",
    "Linear range 0.1-1.0 mg/mL; points above 1.5 mg/mL curve downward",
  ],
  practicalNotesChallenges: [
    "Samples above 1.5 mg/mL fell outside linear range — required additional dilutions",
    "Detergent-containing samples interfered with assay — required prior buffer exchange",
  ],
  practicalNotesRecommendations: [
    "Always run fresh [[Bovine serum albumin]] standard curve — do not reuse old ones",
    "Dilute unknown samples to fall within 0.1-1.0 mg/mL range",
    "If samples contain detergents (Triton, SDS), use BCA assay instead",
    "Read within 60 minutes — color fades after that",
  ],
  substrateInsights: [
    "[[Proteins]]: Bradford preferentially detects arginine and aromatic residues — different proteins have different response factors vs. BSA",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0008",
      description: "SDS-PAGE to separate proteins quantified by Bradford",
    },
    {
      elnId: "EXP-2025-0010",
      description: "Western blot uses Bradford to normalize protein loading",
    },
  ],
  relatedChemicals: ["Bovine serum albumin"],
};

export const sampleExp0007: ExperimentPageData = {
  title: "EXP-2025-0007: Enzyme Kinetics - Lactase Activity",
  elnId: "EXP-2025-0007",
  researcher: "Dr. Sarah Kim",
  date: "2025-03-08",
  status: "completed",
  reactionType: "Protein Analysis",
  substrateClass: "Proteins",
  scaleCategory: "small",
  qualityScore: 4,
  tags: ["kinetics", "michaelis-menten", "spectrophotometry"],
  summary:
    "Determination of Michaelis-Menten kinetics for lactase using ONPG substrate: Km = 2.8 mM, Vmax = 0.42 µmol/min.",
  conditions: [
    { parameter: "Temperature", value: "37 °C", notes: "Water bath" },
    { parameter: "Buffer", value: "100 mM sodium phosphate, pH 7.0" },
    { parameter: "Wavelength", value: "420 nm", notes: "o-Nitrophenol absorbance" },
    { parameter: "Substrate range", value: "0.5-10 mM ONPG" },
  ],
  reagents: [
    {
      name: "ONPG",
      amount: "50 mg (prepared as 10 mM stock)",
      equivalents: "substrate",
      cas: "369-07-3",
      notes: "Dissolved in phosphate buffer",
    },
    {
      name: "Lactase enzyme",
      amount: "Commercial lactase tablet (dissolved)",
      equivalents: "enzyme",
      notes: "Lactaid brand; one tablet per 10 mL buffer",
    },
  ],
  procedureSetup: [
    "Prepared [[ONPG]] stock solution: 10 mM in 100 mM phosphate buffer pH 7.0",
    "Prepared enzyme solution: dissolved 1 Lactaid tablet in 10 mL phosphate buffer, clarified by centrifugation",
    "Pre-warmed all solutions to 37 °C in water bath",
    "Prepared substrate dilutions: 0.5, 1.0, 2.0, 3.0, 5.0, 7.0, 10.0 mM ONPG",
  ],
  procedureReaction: [
    "Added 0.9 mL of each [[ONPG]] concentration to pre-warmed cuvettes (37 °C)",
    "Started reaction by adding 0.1 mL enzyme solution to each cuvette",
    "Monitored A420 every 30 seconds for 5 minutes",
    "Calculated initial velocity (V0) from the linear portion of each progress curve",
  ],
  procedureWorkup: [
    "Calculated V0 for each substrate concentration from the slope of A420 vs. time",
    "Converted A420 to µmol o-nitrophenol using extinction coefficient (epsilon = 4500 M-1cm-1)",
    "Constructed Michaelis-Menten plot (V0 vs. [S]) and Lineweaver-Burk plot (1/V0 vs. 1/[S])",
  ],
  procedurePurification: [],
  results: {
    yield: "Km = 2.8 mM, Vmax = 0.42 µmol/min",
    characterization:
      "Michaelis-Menten fit: R² = 0.994. Lineweaver-Burk plot: x-intercept = -357 M-1 (Km = 2.8 mM), y-intercept = 2.38 min/µmol (Vmax = 0.42 µmol/min). Kcat = 14.0 s-1.",
  },
  practicalNotesWorked: [
    "Pre-warming all solutions to 37 °C before mixing gave reproducible initial rates",
    "Monitoring for 5 minutes captured enough linear-phase data points",
    "Using a single enzyme preparation for all runs eliminated variability",
  ],
  practicalNotesChallenges: [
    "At 10 mM ONPG, substrate was near saturation limit and dissolved slowly",
    "Background hydrolysis of ONPG at 37 °C required blank correction",
  ],
  practicalNotesRecommendations: [
    "Prepare [[ONPG]] fresh on day of use for best results",
    "Include enzyme-free blanks at each substrate concentration",
    "Use at least 6-7 substrate concentrations spanning Km for reliable fitting",
    "Stop reaction with Na2CO3 (0.5 M) if continuous monitoring is not possible",
  ],
  substrateInsights: [
    "[[Proteins]]: commercial lactase (Lactaid) is a reliable and inexpensive source of beta-galactosidase for teaching",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0006",
      description: "Bradford assay to quantify enzyme concentration",
    },
  ],
  relatedChemicals: ["ONPG"],
};

export const sampleExp0008: ExperimentPageData = {
  title: "EXP-2025-0008: SDS-PAGE Gel Electrophoresis",
  elnId: "EXP-2025-0008",
  researcher: "Dr. Sarah Kim",
  date: "2025-03-12",
  status: "in-progress",
  reactionType: "Protein Analysis",
  substrateClass: "Proteins",
  scaleCategory: "small",
  qualityScore: 3,
  tags: ["electrophoresis", "protein-separation"],
  summary:
    "SDS-PAGE separation of protein molecular weight markers and cell lysate samples. Gel cast and loaded; running electrophoresis.",
  conditions: [
    { parameter: "Gel", value: "12% resolving, 5% stacking" },
    { parameter: "Voltage", value: "80V stacking, 120V resolving" },
    { parameter: "Buffer", value: "Tris-glycine-SDS running buffer" },
    { parameter: "Duration", value: "~90 minutes" },
  ],
  reagents: [
    {
      name: "Acrylamide",
      amount: "30% stock solution (Bio-Rad)",
      equivalents: "matrix",
      cas: "79-06-1",
      notes: "30% acrylamide/bis 29:1",
    },
    {
      name: "TEMED",
      amount: "10 µL per gel",
      equivalents: "catalyst",
      cas: "110-18-9",
    },
    {
      name: "Ammonium persulfate",
      amount: "50 µL of 10% (w/v) per gel",
      equivalents: "initiator",
      cas: "7727-54-0",
      notes: "Freshly prepared",
    },
    {
      name: "Sodium dodecyl sulfate",
      amount: "0.1% in running buffer",
      equivalents: "denaturant",
      cas: "151-21-3",
    },
  ],
  procedureSetup: [
    "Assembled Bio-Rad Mini-PROTEAN gel casting apparatus",
    "Prepared 12% resolving gel: 4.0 mL 30% [[Acrylamide]], 2.5 mL 1.5 M Tris pH 8.8, 100 µL 10% [[Sodium dodecyl sulfate]], 3.3 mL H2O",
    "Added 50 µL fresh 10% [[Ammonium persulfate]] and 10 µL [[TEMED]] — mixed quickly",
    "Poured resolving gel, overlaid with isopropanol, allowed to polymerize (30 min)",
    "Poured off isopropanol, prepared and poured 5% stacking gel with comb",
  ],
  procedureReaction: [
    "Prepared protein samples in Laemmli buffer (2% SDS, 5% beta-mercaptoethanol) and heated at 95 °C for 5 min",
    "Loaded 15 µL per well: MW markers (lane 1), unknown samples (lanes 2-8)",
    "Ran gel at 80V through stacking gel (~30 min), then 120V through resolving gel (~60 min)",
    "Stopped when bromophenol blue dye front reached bottom of gel",
  ],
  procedureWorkup: [
    "Remove gel from cassette carefully",
    "Stain with Coomassie Brilliant Blue R-250 for 1 hour (pending)",
    "Destain with 10% acetic acid / 30% methanol until bands are visible (pending)",
  ],
  procedurePurification: [],
  results: {
    yield: "In progress — gel running, staining pending",
    characterization: "Pre-stained markers show good separation during run; expected 6+ distinct bands after staining.",
  },
  practicalNotesWorked: [
    "Fresh APS was critical — gel polymerized in 20 minutes",
    "Isopropanol overlay gave sharp resolving/stacking gel interface",
  ],
  practicalNotesChallenges: [
    "First gel attempt failed to polymerize — APS was 3 weeks old",
    "Air bubbles trapped during pouring caused distorted band migration — pour slowly",
  ],
  practicalNotesRecommendations: [
    "Make [[Ammonium persulfate]] fresh weekly — stale APS is the #1 cause of failure",
    "Pour gel slowly along the glass plate to avoid bubbles",
    "Use pre-stained markers to monitor separation in real time",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0006",
      description: "Bradford assay to quantify protein loading amounts",
    },
    {
      elnId: "EXP-2025-0010",
      description: "Western blot — downstream of SDS-PAGE separation",
    },
  ],
  relatedChemicals: [
    "Acrylamide",
    "TEMED",
    "Ammonium persulfate",
    "Sodium dodecyl sulfate",
  ],
};

export const sampleExp0009: ExperimentPageData = {
  title: "EXP-2025-0009: DNA Extraction from Strawberries",
  elnId: "EXP-2025-0009",
  researcher: "Prof. Thomas Weber",
  date: "2025-03-15",
  status: "in-progress",
  scaleCategory: "small",
  qualityScore: 2,
  tags: ["teaching", "biology", "demonstration"],
  summary:
    "Teaching demonstration of DNA extraction from strawberries using household reagents (soap, salt, ethanol). Extraction underway.",
  conditions: [
    { parameter: "Temperature", value: "Room temperature" },
    { parameter: "Duration", value: "30 minutes" },
    { parameter: "Sample", value: "3 fresh strawberries (frozen/thawed)" },
  ],
  reagents: [
    {
      name: "Dish soap",
      amount: "2 tsp (~10 mL)",
      equivalents: "lysis agent",
      notes: "Clear, unscented preferred",
    },
    {
      name: "Sodium chloride",
      amount: "1/4 tsp (~1.5 g)",
      equivalents: "N/A",
      cas: "7647-14-5",
      notes: "Table salt",
    },
    {
      name: "Ethanol",
      amount: "15 mL",
      equivalents: "precipitant",
      cas: "64-17-5",
      notes: "95%, ice-cold",
    },
  ],
  procedureSetup: [
    "Placed 3 strawberries in a ziplock bag and mashed thoroughly by hand for 2 minutes",
    "Prepared extraction buffer: 100 mL water + 2 tsp dish soap + 1/4 tsp [[Sodium chloride]]",
    "Chilled [[Ethanol]] (95%) in freezer for at least 30 minutes",
  ],
  procedureReaction: [
    "Added 20 mL extraction buffer to mashed strawberries in bag",
    "Mixed gently for 1 minute — avoiding excessive bubbles",
    "Incubated at room temperature for 10 minutes to allow cell lysis",
  ],
  procedureWorkup: [
    "Filtered through cheesecloth into a clean cup/beaker",
    "Collected ~15 mL of clear pink filtrate",
    "Slowly layered 15 mL ice-cold [[Ethanol]] (95%) on top of filtrate — tilting glass to create sharp interface",
    "Observed white stringy DNA precipitating at the ethanol-filtrate interface",
  ],
  procedurePurification: [
    "Spool visible DNA onto a glass rod or wooden stick by gently twirling",
    "Transfer to small tube with 70% ethanol for display (pending)",
  ],
  results: {
    yield: "Visible DNA strands observed at ethanol interface — collection pending",
    characterization: "White, stringy precipitate consistent with genomic DNA. Quantification not performed (teaching demo).",
  },
  practicalNotesWorked: [
    "Frozen/thawed strawberries yield more DNA than fresh — cell walls pre-disrupted",
    "Gentle mixing prevents shearing of DNA into invisible small fragments",
  ],
  practicalNotesChallenges: [
    "Too much soap creates bubbles that obscure the DNA precipitation step",
    "Warm ethanol does not precipitate DNA effectively — must be ice-cold",
  ],
  practicalNotesRecommendations: [
    "Use frozen strawberries thawed at room temperature for best results",
    "Mix gently — vigorous shaking breaks DNA into fragments too small to see",
    "Layer ethanol very slowly for dramatic visible precipitation",
    "Strawberries are octoploid — they have 8 copies of each chromosome, giving abundant DNA",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0013",
      description: "Bacterial transformation — another DNA-focused experiment",
    },
  ],
  relatedChemicals: ["Sodium chloride", "Ethanol"],
};

export const sampleExp0010: ExperimentPageData = {
  title: "EXP-2025-0010: Western Blot Analysis of GAPDH",
  elnId: "EXP-2025-0010",
  researcher: "Dr. Sarah Kim",
  date: "2025-03-20",
  status: "planned",
  reactionType: "Protein Analysis",
  substrateClass: "Proteins",
  scaleCategory: "small",
  qualityScore: 1,
  tags: ["immunoblot", "protein-detection"],
  summary:
    "Planned Western blot for GAPDH detection as a loading control, using SDS-PAGE separation followed by membrane transfer and antibody probing.",
  conditions: [
    { parameter: "Transfer", value: "Semi-dry, 25V, 30 min" },
    { parameter: "Membrane", value: "PVDF (0.45 µm)" },
    { parameter: "Primary antibody", value: "Anti-GAPDH (1:5000), overnight 4 °C" },
    { parameter: "Secondary antibody", value: "HRP-conjugated (1:10000), 1 hour RT" },
  ],
  reagents: [
    {
      name: "PVDF membrane",
      amount: "1 sheet (cut to gel size)",
      equivalents: "N/A",
      notes: "Activate in methanol before use",
    },
    {
      name: "Anti-GAPDH antibody",
      amount: "1:5000 dilution in 5% BSA/TBST",
      equivalents: "N/A",
      notes: "Rabbit monoclonal (Cell Signaling #5174)",
    },
    {
      name: "ECL substrate",
      amount: "2 mL per membrane",
      equivalents: "N/A",
      notes: "Pierce SuperSignal West Pico PLUS",
    },
  ],
  procedureSetup: [
    "Run SDS-PAGE gel as per [[EXP-2025-0008]] protocol",
    "Activate PVDF membrane in methanol for 30 seconds, then equilibrate in transfer buffer",
    "Assemble semi-dry transfer sandwich: filter paper, membrane, gel, filter paper",
  ],
  procedureReaction: [
    "Transfer at 25V for 30 minutes (semi-dry apparatus)",
    "Block membrane in 5% non-fat milk/TBST for 1 hour at room temperature",
    "Incubate with primary anti-GAPDH antibody (1:5000 in 5% BSA/TBST) overnight at 4 °C",
    "Wash 3 x 10 min with TBST",
    "Incubate with HRP-conjugated secondary antibody (1:10000) for 1 hour at RT",
    "Wash 3 x 10 min with TBST",
  ],
  procedureWorkup: [
    "Apply ECL substrate and incubate 2 minutes",
    "Image on ChemiDoc or expose to X-ray film",
  ],
  procedurePurification: [],
  results: {
    yield: "TBD — experiment not yet performed",
    characterization: "Expected: single band at 37 kDa (GAPDH)",
  },
  practicalNotesRecommendations: [
    "Activate PVDF in methanol — skipping this step prevents protein binding",
    "Use BSA (not milk) for blocking when using phospho-specific antibodies",
    "GAPDH is an excellent loading control — ubiquitous and abundant",
    "Do not let the membrane dry during protocol — keep in buffer or wrap in plastic",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0008",
      description: "SDS-PAGE separation — prerequisite for Western blot",
    },
    {
      elnId: "EXP-2025-0006",
      description: "Bradford assay to normalize protein loading",
    },
  ],
  relatedChemicals: [],
};

// --- BIOLOGY ---

export const sampleExp0011: ExperimentPageData = {
  title: "EXP-2025-0011: Yeast Fermentation - Effect of Temperature",
  elnId: "EXP-2025-0011",
  researcher: "Dr. Sarah Kim",
  date: "2025-04-01",
  status: "completed",
  scaleCategory: "small",
  qualityScore: 4,
  tags: ["fermentation", "metabolism", "temperature-study"],
  summary:
    "Investigation of yeast fermentation rate as a function of temperature (10-60 °C) by measuring CO2 production. Optimal range: 35-40 °C.",
  conditions: [
    { parameter: "Substrate", value: "5% sucrose solution" },
    { parameter: "Temperature range", value: "10, 20, 30, 35, 40, 50, 60 °C" },
    { parameter: "Duration", value: "30 minutes per temperature" },
    { parameter: "Replicates", value: "Triplicate" },
  ],
  reagents: [
    {
      name: "Sucrose",
      amount: "25 g (in 500 mL = 5% w/v)",
      equivalents: "substrate",
      cas: "57-50-1",
    },
    {
      name: "Active dry yeast",
      amount: "7 g per flask (1 packet)",
      equivalents: "organism",
      notes: "Fleischmann's Active Dry Yeast",
    },
  ],
  procedureSetup: [
    "Prepared 5% [[Sucrose]] solution (25 g in 500 mL warm water, stirred until dissolved)",
    "Distributed 50 mL sucrose solution into each of 21 Erlenmeyer flasks (7 temps x 3 replicates)",
    "Pre-equilibrated flasks at target temperatures in water baths for 10 minutes",
    "Fitted each flask with a balloon to capture CO2",
  ],
  procedureReaction: [
    "Added 1 g active dry yeast to each flask and swirled to mix",
    "Quickly fitted balloons over flask openings",
    "Incubated for 30 minutes at respective temperatures",
    "Measured balloon circumference at 10, 20, and 30 minutes as proxy for CO2 production",
  ],
  procedureWorkup: [
    "Calculated average balloon circumference for each temperature at each time point",
    "Plotted fermentation rate (CO2 production) vs. temperature",
    "Determined optimal temperature range",
  ],
  procedurePurification: [],
  results: {
    yield: "Optimal temperature: 35-40 °C",
    characterization:
      "CO2 production (30 min balloon circumference): 10°C = 2 cm, 20°C = 8 cm, 30°C = 18 cm, 35°C = 24 cm, 40°C = 23 cm, 50°C = 6 cm, 60°C = 0 cm. Clear bell-shaped curve with optimum at 35-40 °C. No activity at 60 °C (enzyme denaturation).",
  },
  practicalNotesWorked: [
    "Balloon method provides a simple, visual measure of CO2 production",
    "Pre-equilibrating flasks ensures accurate temperature control from the start",
    "Triplicate measurements gave reproducible results (CV < 15%)",
  ],
  practicalNotesChallenges: [
    "Balloons can slip off flasks if not secured — use rubber bands",
    "60 °C flasks showed zero activity — yeast enzymes are denatured above 55 °C",
  ],
  practicalNotesRecommendations: [
    "Use [[Sucrose]] at 5% — higher concentrations can inhibit yeast (osmotic stress)",
    "Secure balloons with rubber bands to prevent CO2 leaks",
    "For quantitative results, use water displacement or gas syringe instead of balloons",
    "Fresh yeast packets give more reproducible results than old yeast",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0012",
      description: "Another biology demonstration by the same group",
    },
  ],
  relatedChemicals: ["Sucrose"],
};

export const sampleExp0012: ExperimentPageData = {
  title: "EXP-2025-0012: Plant Cell Plasmolysis",
  elnId: "EXP-2025-0012",
  researcher: "Prof. Thomas Weber",
  date: "2025-04-05",
  status: "completed",
  scaleCategory: "small",
  qualityScore: 4,
  tags: ["microscopy", "osmosis", "teaching"],
  summary:
    "Demonstration of plasmolysis in Elodea leaf cells using hypertonic NaCl solution, showing reversible cell membrane shrinkage under the microscope.",
  conditions: [
    { parameter: "Hypertonic solution", value: "5% NaCl (w/v)" },
    { parameter: "Microscope", value: "400x magnification" },
    { parameter: "Duration", value: "5-10 minutes for plasmolysis" },
    { parameter: "Recovery", value: "Distilled water (deplasmolysis)" },
  ],
  reagents: [
    {
      name: "Sodium chloride",
      amount: "5 g in 100 mL water (5% w/v)",
      equivalents: "N/A",
      cas: "7647-14-5",
      notes: "Hypertonic solution",
    },
    {
      name: "Elodea leaf",
      amount: "2-3 young leaves from growing tip",
      equivalents: "specimen",
      notes: "Elodea canadensis from aquarium",
    },
  ],
  procedureSetup: [
    "Prepared 5% [[Sodium chloride]] solution (5 g NaCl in 100 mL distilled water)",
    "Selected young, healthy Elodea leaves from the growing tip of a stem",
    "Prepared wet mount slide with Elodea leaf in distilled water",
    "Focused microscope at 400x — observed turgid cells with green chloroplasts lining cell walls",
  ],
  procedureReaction: [
    "Drew 5% NaCl solution under the coverslip using a piece of filter paper at the opposite edge",
    "Observed cells under microscope continuously",
    "Within 2-3 minutes, cell membranes began pulling away from cell walls (plasmolysis)",
    "After 5-10 minutes, most cells showed clear plasmolysis — protoplast shrunken, clear space between membrane and wall",
    "Documented with microscope camera at 5 and 10 minutes",
  ],
  procedureWorkup: [
    "To demonstrate reversibility: drew distilled water under coverslip to replace NaCl solution",
    "Observed deplasmolysis over 5-10 minutes — protoplast expanded back to fill cell wall",
    "Documented recovery with microscope camera",
  ],
  procedurePurification: [],
  results: {
    yield: "100% of observed cells showed plasmolysis within 10 minutes",
    characterization:
      "Clear plasmolysis visible at 400x: green protoplast pulled away from cell wall, clear space between. Deplasmolysis confirmed reversibility within 10 minutes in distilled water.",
  },
  productAppearance: "Plasmolyzed cells show shrunken green protoplast with clear gaps at cell corners",
  practicalNotesWorked: [
    "5% NaCl gives reliable, visible plasmolysis within 5 minutes",
    "Young leaves from growing tips respond faster and more uniformly than old leaves",
    "Filter paper wicking method exchanges solution without disturbing the slide",
    "Deplasmolysis demonstrates reversibility — cells are still alive",
  ],
  practicalNotesChallenges: [
    "Old or damaged Elodea leaves show inconsistent response",
    "NaCl concentration too low (<3%) gives slow or incomplete plasmolysis",
  ],
  practicalNotesRecommendations: [
    "Use young Elodea leaves from actively growing stems",
    "5% [[Sodium chloride]] is the optimal concentration for clear demonstration",
    "Take photographs at turgid, plasmolyzed, and deplasmolyzed states for comparison",
    "Start by observing normal cells in water so students can see the contrast",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0014",
      description: "Another microscopy-based experiment — onion root tip mitosis",
    },
  ],
  relatedChemicals: ["Sodium chloride"],
};

export const sampleExp0013: ExperimentPageData = {
  title: "EXP-2025-0013: Bacterial Transformation with pGLO",
  elnId: "EXP-2025-0013",
  researcher: "Prof. Thomas Weber",
  date: "2025-04-10",
  status: "in-progress",
  scaleCategory: "small",
  qualityScore: 2,
  tags: ["molecular-biology", "transformation", "GFP"],
  summary:
    "Transformation of E. coli with pGLO plasmid encoding GFP and ampicillin resistance using CaCl2 heat-shock method. Plates incubated, awaiting colony growth.",
  conditions: [
    { parameter: "Competent cells", value: "CaCl2-treated E. coli DH5α" },
    { parameter: "Heat shock", value: "42 °C for 50 seconds" },
    { parameter: "Recovery", value: "37 °C, 30 min in LB" },
    { parameter: "Selection", value: "LB + Ampicillin (100 µg/mL)" },
  ],
  reagents: [
    {
      name: "pGLO plasmid",
      amount: "10 µL (0.01 µg/µL)",
      equivalents: "DNA",
      notes: "Bio-Rad pGLO kit; encodes GFP + AmpR",
    },
    {
      name: "Competent E. coli",
      amount: "200 µL cell suspension",
      equivalents: "host",
      notes: "DH5α strain, CaCl2-prepared",
    },
    {
      name: "Calcium chloride",
      amount: "50 mM solution (ice-cold)",
      equivalents: "N/A",
      cas: "10043-52-4",
      notes: "Used to prepare competent cells",
    },
  ],
  procedureSetup: [
    "Prepared competent cells: grew E. coli to OD600 = 0.4, chilled on ice 10 min, centrifuged, resuspended in ice-cold 50 mM [[Calcium chloride]]",
    "Set up 4 transformation tubes on ice: (+DNA/+Amp), (+DNA/+Amp/+Ara), (-DNA/+Amp), (-DNA/-Amp)",
    "Aliquoted 50 µL competent cells into each tube",
  ],
  procedureReaction: [
    "Added 10 µL pGLO plasmid DNA to (+DNA) tubes; added 10 µL water to (-DNA) tubes",
    "Incubated on ice for 10 minutes",
    "Heat-shocked at 42 °C for exactly 50 seconds",
    "Immediately returned to ice for 2 minutes",
    "Added 250 µL warm LB broth and incubated at 37 °C for 30 min (recovery)",
  ],
  procedureWorkup: [
    "Plated 100 µL from each tube onto appropriate agar plates",
    "+DNA/+Amp plate: expect colonies (transformed, AmpR)",
    "+DNA/+Amp/+Ara plate: expect glowing colonies under UV (GFP expressed)",
    "-DNA/+Amp plate: expect no colonies (no resistance gene)",
    "-DNA/-Amp plate: expect lawn (control for cell viability)",
    "Incubating plates at 37 °C overnight — checking in 24-48 hours",
  ],
  procedurePurification: [],
  results: {
    yield: "Pending — plates incubating at 37 °C",
    characterization: "Expected: colonies on +DNA plates, GFP fluorescence under UV on +Ara plates, no growth on -DNA/+Amp control.",
  },
  practicalNotesWorked: [
    "Ice-cold CaCl2 treatment for 30 min gives adequate competent cell preparation",
    "Precise 50-second heat shock is important — timer essential",
  ],
  practicalNotesChallenges: [
    "Competent cell preparation is time-sensitive — cells must stay cold throughout",
    "If plates are checked too early (<18 h), colonies may be too small to count",
  ],
  practicalNotesRecommendations: [
    "Prepare competent cells fresh or use frozen stocks with 15% glycerol",
    "Heat shock must be exactly 42 °C for 50 seconds — use a calibrated water bath",
    "Wait 24-48 hours before checking plates at 37 °C",
    "Check GFP fluorescence with long-wave UV (365 nm) in a dark room",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0009",
      description: "DNA extraction — conceptually related molecular biology",
    },
  ],
  relatedChemicals: ["Calcium chloride"],
};

export const sampleExp0014: ExperimentPageData = {
  title: "EXP-2025-0014: Onion Root Tip Mitosis",
  elnId: "EXP-2025-0014",
  researcher: "Prof. Thomas Weber",
  date: "2025-04-15",
  status: "planned",
  scaleCategory: "small",
  qualityScore: 1,
  tags: ["microscopy", "cell-division", "teaching"],
  summary:
    "Planned observation of mitotic stages in onion (Allium cepa) root tip squash preparations stained with acetocarmine.",
  conditions: [
    { parameter: "Stain", value: "Acetocarmine (2%)" },
    { parameter: "Maceration", value: "1 M HCl at 60 °C, 5 min" },
    { parameter: "Microscope", value: "400-1000x oil immersion" },
  ],
  reagents: [
    {
      name: "Hydrochloric acid",
      amount: "1 M solution, 20 mL",
      equivalents: "N/A",
      cas: "7647-01-0",
      notes: "For root tip maceration",
    },
    {
      name: "Acetocarmine stain",
      amount: "5 mL (2% solution)",
      equivalents: "N/A",
      notes: "Prepared in 45% acetic acid",
    },
  ],
  procedureSetup: [
    "Grow onion root tips by suspending onion bulb over water for 3-5 days until roots are 2-3 cm long",
    "Cut 1-2 cm root tips and place in watch glass",
    "Prepare 1 M [[Hydrochloric acid]] and warm to 60 °C",
  ],
  procedureReaction: [
    "Macerate root tips in 1 M HCl at 60 °C for 5 minutes to soften tissue and separate cells",
    "Rinse tips with distilled water to remove acid",
    "Place root tip on microscope slide and add 2-3 drops acetocarmine stain",
    "Incubate with stain for 10 minutes at room temperature",
    "Place coverslip and squash firmly with thumb (through filter paper) to spread cells into a monolayer",
  ],
  procedureWorkup: [
    "Examine under microscope at 400x, then 1000x with oil immersion",
    "Identify and photograph cells in interphase, prophase, metaphase, anaphase, and telophase",
    "Count cells in each phase to calculate mitotic index",
  ],
  procedurePurification: [],
  results: {
    yield: "TBD — experiment not yet performed",
    characterization: "Expected: stained chromosomes visible in dividing cells; mitotic index typically 10-20% in root tip meristem.",
  },
  practicalNotesRecommendations: [
    "Cut root tips in the morning when mitotic activity is highest",
    "[[Hydrochloric acid]] maceration for exactly 5 min — too long destroys cells, too short gives clumps",
    "Firm squashing is critical — cells must be a single layer for clear observation",
    "Acetocarmine stains chromatin red/pink — look for condensed chromosomes in dividing cells",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0012",
      description: "Another microscopy-based cell observation experiment",
    },
  ],
  relatedChemicals: ["Hydrochloric acid"],
};

export const sampleExp0015: ExperimentPageData = {
  title: "EXP-2025-0015: MTT Cell Viability Assay",
  elnId: "EXP-2025-0015",
  researcher: "Dr. Sarah Kim",
  date: "2025-04-20",
  status: "planned",
  scaleCategory: "small",
  qualityScore: 2,
  tags: ["cell-culture", "cytotoxicity", "96-well"],
  summary:
    "Planned MTT assay to assess HeLa cell viability after treatment with test compounds, using 96-well plate format and DMSO solubilization.",
  conditions: [
    { parameter: "Cell line", value: "HeLa (cervical carcinoma)" },
    { parameter: "Seeding density", value: "5000 cells/well" },
    { parameter: "MTT incubation", value: "4 hours at 37 °C" },
    { parameter: "Readout", value: "Absorbance at 570 nm" },
  ],
  reagents: [
    {
      name: "MTT",
      amount: "5 mg/mL stock in PBS",
      equivalents: "reagent",
      cas: "298-93-1",
      notes: "Add 10 µL per well (96-well plate)",
    },
    {
      name: "DMSO",
      amount: "100 µL per well",
      equivalents: "solvent",
      cas: "67-68-5",
      notes: "Cell-culture grade; to solubilize formazan crystals",
    },
    {
      name: "HeLa cells",
      amount: "5000 cells/well in 100 µL medium",
      equivalents: "cells",
      notes: "Passage 15-25 for reproducibility",
    },
  ],
  procedureSetup: [
    "Seed HeLa cells at 5000 cells/well in 96-well plate (100 µL DMEM + 10% FBS per well)",
    "Incubate overnight at 37 °C, 5% CO2 to allow attachment",
    "Prepare serial dilutions of test compounds in culture medium",
  ],
  procedureReaction: [
    "Remove medium and add 100 µL of test compound dilutions (in triplicate)",
    "Include vehicle controls (medium only) and positive controls (known cytotoxic agent)",
    "Incubate for 24, 48, or 72 hours at 37 °C, 5% CO2",
    "Add 10 µL [[MTT]] stock (5 mg/mL) to each well",
    "Incubate for 4 hours at 37 °C — purple formazan crystals form in viable cells",
  ],
  procedureWorkup: [
    "Carefully remove medium without disturbing formazan crystals",
    "Add 100 µL [[DMSO]] per well to dissolve crystals",
    "Shake plate for 10 minutes on orbital shaker",
    "Read absorbance at 570 nm (reference 690 nm) on plate reader",
  ],
  procedurePurification: [],
  results: {
    yield: "TBD — experiment not yet performed",
    characterization: "Expected: dose-dependent decrease in A570 with increasing test compound concentration. IC50 to be calculated.",
  },
  practicalNotesRecommendations: [
    "Use [[MTT]] stock within 2 weeks of preparation — discard if color changes from yellow to green",
    "Ensure complete dissolution of formazan in [[DMSO]] — incomplete dissolution gives variable readings",
    "Include edge wells as blanks — evaporation artifacts are common in outer wells",
    "Optimize incubation time (24-72 h) based on expected mechanism of action",
    "Cell passage number affects sensitivity — use consistent passage range",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0006",
      description: "Bradford assay for protein quantification in cell lysates",
    },
  ],
  relatedChemicals: ["MTT", "DMSO"],
};

// --- MATERIALS/ANALYTICAL ---

export const sampleExp0016: ExperimentPageData = {
  title: "EXP-2025-0016: TLC of Plant Pigments",
  elnId: "EXP-2025-0016",
  researcher: "Prof. Thomas Weber",
  date: "2025-05-01",
  status: "completed",
  scaleCategory: "small",
  qualityScore: 4,
  tags: ["chromatography", "TLC", "teaching"],
  summary:
    "Thin-layer chromatography separation of spinach leaf pigments identifying carotenes, chlorophyll a, chlorophyll b, and xanthophylls with distinct Rf values.",
  conditions: [
    { parameter: "Stationary phase", value: "Silica gel 60 F254 TLC plate" },
    { parameter: "Mobile phase", value: "Petroleum ether:acetone (7:3)" },
    { parameter: "Development", value: "Ascending, 15 minutes" },
    { parameter: "Detection", value: "Visible color (no staining needed)" },
  ],
  reagents: [
    {
      name: "Acetone",
      amount: "10 mL for extraction, 3 mL for mobile phase",
      equivalents: "solvent",
      cas: "67-64-1",
    },
    {
      name: "Petroleum ether",
      amount: "7 mL for mobile phase",
      equivalents: "solvent",
      cas: "8032-32-4",
    },
    {
      name: "Spinach",
      amount: "5 g fresh leaves",
      equivalents: "sample",
      notes: "Fresh spinach from grocery store",
    },
  ],
  procedureSetup: [
    "Tore 5 g fresh spinach leaves into small pieces and placed in mortar",
    "Added small amount of sand and 10 mL [[Acetone]], ground with pestle for 3 minutes",
    "Filtered extract through cotton plug into a small beaker — dark green solution obtained",
    "Prepared TLC chamber with [[Petroleum ether]]:[[Acetone]] (7:3) mobile phase (10 mL total)",
    "Covered chamber and let equilibrate for 10 minutes",
  ],
  procedureReaction: [
    "Applied concentrated spinach extract to TLC plate 1 cm from bottom using capillary tube",
    "Applied 5-6 small spots, drying between applications for a concentrated band",
    "Placed plate in chamber and developed until solvent front was ~1 cm from top (~15 min)",
    "Removed plate and immediately marked solvent front with pencil",
  ],
  procedureWorkup: [
    "Allowed plate to air-dry in fume hood (30 seconds)",
    "Identified bands by color and position",
    "Measured Rf values for each pigment band",
  ],
  procedurePurification: [],
  results: {
    yield: "4 distinct pigment bands resolved",
    characterization:
      "Rf values (petroleum ether:acetone 7:3): Carotenes = 0.95 (yellow-orange, fastest), Chlorophyll a = 0.59 (blue-green), Chlorophyll b = 0.42 (yellow-green), Xanthophylls = 0.35 (yellow, band nearest origin). Additional minor bands visible near origin (polar pigments).",
  },
  productAppearance: "Colorful TLC plate with 4+ distinct bands from yellow to green",
  practicalNotesWorked: [
    "Multiple applications of concentrated extract give well-defined bands",
    "Petroleum ether:acetone 7:3 gives excellent separation of all major pigments",
    "Chamber equilibration (10 min) prevents streaking and solvent front distortion",
    "Fresh spinach gives the strongest, most colorful separations",
  ],
  practicalNotesChallenges: [
    "If chamber is not equilibrated, bands streak and overlap",
    "Overloading the plate causes tailing — use concentrated but thin application",
    "Extract degrades in light — work quickly and keep extract covered",
  ],
  practicalNotesRecommendations: [
    "Always equilibrate TLC chamber for 10 minutes before developing",
    "Use fresh spinach — frozen/thawed gives weaker pigment bands",
    "Apply extract in small, concentrated dots — dry between applications",
    "Photograph plate immediately — pigments fade within hours",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0017",
      description: "UV-Vis spectroscopy — complementary analytical technique",
    },
    {
      elnId: "EXP-2025-0018",
      description: "Melting point — another analytical identification method",
    },
  ],
  relatedChemicals: ["Acetone", "Petroleum ether"],
};

export const sampleExp0017: ExperimentPageData = {
  title: "EXP-2025-0017: UV-Vis Spectroscopy - Beer-Lambert Law",
  elnId: "EXP-2025-0017",
  researcher: "Prof. Thomas Weber",
  date: "2025-05-05",
  status: "in-progress",
  scaleCategory: "small",
  qualityScore: 3,
  tags: ["spectroscopy", "UV-Vis", "teaching"],
  summary:
    "Verification of Beer-Lambert law using methyl orange at various concentrations, measuring absorbance at lambda_max = 464 nm. Data collection in progress.",
  conditions: [
    { parameter: "Wavelength", value: "464 nm (lambda_max)" },
    { parameter: "Path length", value: "1.0 cm cuvette" },
    { parameter: "Concentration range", value: "0.01-0.10 mM methyl orange" },
    { parameter: "Solvent", value: "Distilled water, pH 7" },
  ],
  reagents: [
    {
      name: "Methyl orange",
      amount: "0.033 g for 0.10 mM stock (1 L)",
      equivalents: "analyte",
      cas: "547-58-0",
      notes: "Stock: 0.10 mM in distilled water",
    },
  ],
  procedureSetup: [
    "Prepared 0.10 mM [[Methyl orange]] stock solution (0.033 g in 1 L distilled water)",
    "Prepared dilution series: 0.01, 0.02, 0.04, 0.06, 0.08, 0.10 mM by serial dilution",
    "Warmed up UV-Vis spectrophotometer for 15 minutes",
    "Ran baseline with distilled water blank",
  ],
  procedureReaction: [
    "First, scanned 0.10 mM methyl orange from 350-600 nm to confirm lambda_max",
    "lambda_max confirmed at 464 nm — consistent with literature",
    "Measured A464 for each concentration in order from low to high",
    "Rinsed cuvette with next solution between measurements",
    "Recording data — in progress",
  ],
  procedureWorkup: [
    "Plot absorbance (A464) vs. concentration",
    "Determine molar extinction coefficient (epsilon) from slope",
    "Assess linearity (R² value) and identify deviations from Beer-Lambert at high concentrations",
  ],
  procedurePurification: [],
  results: {
    yield: "Data collection in progress",
    characterization:
      "Preliminary: lambda_max = 464 nm confirmed. Linear response observed for 0.01-0.06 mM (4 points). Remaining concentrations to be measured.",
  },
  practicalNotesWorked: [
    "15-minute warm-up stabilizes lamp intensity and reduces baseline drift",
    "Measuring from low to high concentration minimizes carryover errors",
  ],
  practicalNotesChallenges: [
    "Initial readings had high noise — resolved by allowing longer instrument warm-up",
    "Methyl orange stock concentration must be verified — weighing error propagates to all dilutions",
  ],
  practicalNotesRecommendations: [
    "Allow UV-Vis spectrophotometer at least 15 minutes warm-up before measurements",
    "Measure from dilute to concentrated to minimize carryover between samples",
    "Verify [[Methyl orange]] stock concentration by weighing accurately on analytical balance",
    "pH must be consistent — methyl orange absorbance is pH-dependent",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0004",
      description: "Methyl orange synthesis — source of the analyte",
    },
    {
      elnId: "EXP-2025-0016",
      description: "TLC — complementary separation technique",
    },
  ],
  relatedChemicals: ["Methyl orange"],
};

export const sampleExp0018: ExperimentPageData = {
  title: "EXP-2025-0018: Melting Point Determination",
  elnId: "EXP-2025-0018",
  researcher: "Prof. Thomas Weber",
  date: "2025-05-08",
  status: "completed",
  scaleCategory: "small",
  qualityScore: 4,
  tags: ["analytical", "identification", "teaching"],
  summary:
    "Melting point determination of known standards (benzoic acid, trans-cinnamic acid, acetanilide) and identification of an unknown sample by melting point comparison.",
  conditions: [
    { parameter: "Apparatus", value: "Mel-Temp capillary melting point apparatus" },
    { parameter: "Heating rate", value: "2 °C/min near expected mp" },
    { parameter: "Standards", value: "Benzoic acid, trans-cinnamic acid, acetanilide" },
  ],
  reagents: [
    {
      name: "Benzoic acid",
      amount: "~50 mg (for capillary loading)",
      equivalents: "standard",
      cas: "65-85-0",
      notes: "Known mp: 122 °C",
    },
    {
      name: "trans-Cinnamic acid",
      amount: "~50 mg",
      equivalents: "standard",
      cas: "140-10-3",
      notes: "Known mp: 133 °C",
    },
    {
      name: "Acetanilide",
      amount: "~50 mg",
      equivalents: "standard",
      cas: "103-84-4",
      notes: "Known mp: 114 °C",
    },
  ],
  procedureSetup: [
    "Powered on Mel-Temp apparatus and allowed 15-minute warm-up",
    "Ground each sample to a fine powder with mortar and pestle",
    "Loaded ~2-3 mm of powder into capillary tubes (sealed end) by tapping",
    "Prepared duplicate capillaries for each sample",
  ],
  procedureReaction: [
    "Placed [[Acetanilide]] capillary in apparatus; heated rapidly to 100 °C, then slowly (2 °C/min) to melting",
    "Recorded onset and completion of melting: 113-115 °C (lit. 114 °C)",
    "Allowed apparatus to cool; repeated for [[Benzoic acid]]: 121-122 °C (lit. 122 °C)",
    "Repeated for [[trans-Cinnamic acid]]: 132-134 °C (lit. 133 °C)",
    "Measured unknown sample: 121-123 °C — consistent with benzoic acid",
    "Mixed melting point: mixed unknown with benzoic acid — no depression observed (121-123 °C), confirming identity",
  ],
  procedureWorkup: [
    "Recorded all melting point ranges in lab notebook",
    "Compared unknown mp with standard values",
    "Performed mixed melting point test to confirm identification",
  ],
  procedurePurification: [],
  results: {
    yield: "All standards within 1-2 °C of literature values",
    characterization:
      "Acetanilide: 113-115 °C (lit. 114 °C). Benzoic acid: 121-122 °C (lit. 122 °C). trans-Cinnamic acid: 132-134 °C (lit. 133 °C). Unknown: 121-123 °C, identified as benzoic acid by mixed mp (no depression).",
  },
  practicalNotesWorked: [
    "15-minute warm-up gives stable and accurate readings",
    "Slow heating rate (2 °C/min) near expected mp gives sharp, reproducible ranges",
    "Mixed melting point test definitively confirms identity of unknown",
    "Duplicate capillaries provide confidence in the measurement",
  ],
  practicalNotesChallenges: [
    "Fast heating rate gives broad melting ranges — misleadingly high onset temperature",
    "Wet or impure samples give depressed and broad melting points",
  ],
  practicalNotesRecommendations: [
    "Allow Mel-Temp 15 minutes warm-up for stable temperature reading",
    "Grind samples finely and pack capillary tightly for uniform heat transfer",
    "Heat slowly (1-2 °C/min) near expected melting point",
    "Always run a known standard to verify apparatus calibration",
    "Mixed melting point test is the gold standard for identity confirmation",
  ],
  relatedExperiments: [
    {
      elnId: "EXP-2025-0003",
      description: "Recrystallization — melting point used to assess purity",
    },
    {
      elnId: "EXP-2025-0016",
      description: "TLC — complementary identification technique",
    },
  ],
  relatedChemicals: [
    "Benzoic acid",
    "trans-Cinnamic acid",
    "Acetanilide",
  ],
};

// ===========================================================================
// COLLECTED ARRAYS
// ===========================================================================

export const ALL_SAMPLE_CHEMICALS: ChemicalPageData[] = [
  // Existing 5
  samplePdPPh34,
  sampleTHF,
  sample4Bromopyridine,
  sampleK2CO3,
  samplePhenylboronicAcid,
  // New 30
  sampleSalicylicAcid,
  sampleAceticAnhydride,
  samplePhosphoricAcid,
  sampleMagnesiumTurnings,
  sampleBromobenzene,
  sampleBenzophenone,
  sampleDiethylEther,
  sampleBenzoicAcid,
  sampleSulfanilicAcid,
  sampleSodiumNitrite,
  sampleDimethylaniline,
  sampleGlacialAceticAcid,
  sampleEthanol,
  sampleSulfuricAcid,
  sampleBSA,
  sampleONPG,
  sampleAcrylamide,
  sampleTEMED,
  sampleAPS,
  sampleSDS,
  sampleSucrose,
  sampleSodiumChloride,
  sampleCalciumChloride,
  sampleMTT,
  sampleDMSO,
  sampleHCl,
  sampleAcetone,
  samplePetroleumEther,
  sampleMethylOrangeChemical,
  sampleTransCinnamicAcid,
  sampleAcetanilide,
];

export const ALL_SAMPLE_EXPERIMENTS: ExperimentPageData[] = [
  // Existing 3 Suzuki
  sampleExp0042,
  sampleExp0043,
  sampleExp0044,
  // New 18
  sampleExp0001,
  sampleExp0002,
  sampleExp0003,
  sampleExp0004,
  sampleExp0005,
  sampleExp0006,
  sampleExp0007,
  sampleExp0008,
  sampleExp0009,
  sampleExp0010,
  sampleExp0011,
  sampleExp0012,
  sampleExp0013,
  sampleExp0014,
  sampleExp0015,
  sampleExp0016,
  sampleExp0017,
  sampleExp0018,
];

export const ALL_SAMPLE_RESEARCHERS: ResearcherPageData[] = [
  sampleDrMueller,
  sampleDrChen,
  sampleDrKim,
  sampleProfWeber,
];

export const ALL_SAMPLE_REACTION_TYPES: ReactionTypePageData[] = [
  sampleSuzukiCoupling,
  sampleAcetylation,
  sampleGrignardReaction,
  sampleDiazotization,
  sampleFischerEsterification,
  sampleProteinAnalysis,
];

export const ALL_SAMPLE_SUBSTRATE_CLASSES: SubstrateClassPageData[] = [
  sampleHeteroarylHalides,
  sampleCarboxylicAcids,
  sampleProteins,
];

export const ALL_SAMPLE_PAGE_TITLES: string[] = [
  // Chemicals (35)
  "Pd(PPh3)4",
  "Tetrahydrofuran",
  "4-Bromopyridine",
  "Potassium carbonate",
  "Phenylboronic acid",
  "Salicylic acid",
  "Acetic anhydride",
  "Phosphoric acid",
  "Magnesium turnings",
  "Bromobenzene",
  "Benzophenone",
  "Diethyl ether",
  "Benzoic acid",
  "Sulfanilic acid",
  "Sodium nitrite",
  "N,N-Dimethylaniline",
  "Glacial acetic acid",
  "Ethanol",
  "Sulfuric acid",
  "Bovine serum albumin",
  "ONPG",
  "Acrylamide",
  "TEMED",
  "Ammonium persulfate",
  "Sodium dodecyl sulfate",
  "Sucrose",
  "Sodium chloride",
  "Calcium chloride",
  "MTT",
  "DMSO",
  "Hydrochloric acid",
  "Acetone",
  "Petroleum ether",
  "Methyl orange",
  "trans-Cinnamic acid",
  "Acetanilide",
  // Researchers (4)
  "Dr. Anna Mueller",
  "Dr. James Chen",
  "Dr. Sarah Kim",
  "Prof. Thomas Weber",
  // Reaction types (6)
  "Suzuki Coupling",
  "Acetylation",
  "Grignard Reaction",
  "Diazotization/Azo Coupling",
  "Fischer Esterification",
  "Protein Analysis",
  // Substrate classes (3)
  "Heteroaryl Halides",
  "Carboxylic Acids",
  "Proteins",
  // Experiments — Suzuki (existing)
  "EXP-2026-0042",
  "EXP-2026-0043",
  "EXP-2026-0044",
  "EXP-2026-0042: Suzuki Coupling of 4-Bromopyridine",
  "EXP-2026-0043: Optimization of Suzuki Conditions",
  "EXP-2026-0044: Scale-Up to 10 mmol",
  // Experiments — New 18
  "EXP-2025-0001",
  "EXP-2025-0002",
  "EXP-2025-0003",
  "EXP-2025-0004",
  "EXP-2025-0005",
  "EXP-2025-0006",
  "EXP-2025-0007",
  "EXP-2025-0008",
  "EXP-2025-0009",
  "EXP-2025-0010",
  "EXP-2025-0011",
  "EXP-2025-0012",
  "EXP-2025-0013",
  "EXP-2025-0014",
  "EXP-2025-0015",
  "EXP-2025-0016",
  "EXP-2025-0017",
  "EXP-2025-0018",
  "EXP-2025-0001: Synthesis of Aspirin (Acetylsalicylic Acid)",
  "EXP-2025-0002: Grignard Reaction - Synthesis of Triphenylmethanol",
  "EXP-2025-0003: Recrystallization of Benzoic Acid",
  "EXP-2025-0004: Synthesis of Methyl Orange",
  "EXP-2025-0005: Fischer Esterification - Ethyl Acetate",
  "EXP-2025-0006: Bradford Protein Assay",
  "EXP-2025-0007: Enzyme Kinetics - Lactase Activity",
  "EXP-2025-0008: SDS-PAGE Gel Electrophoresis",
  "EXP-2025-0009: DNA Extraction from Strawberries",
  "EXP-2025-0010: Western Blot Analysis of GAPDH",
  "EXP-2025-0011: Yeast Fermentation - Effect of Temperature",
  "EXP-2025-0012: Plant Cell Plasmolysis",
  "EXP-2025-0013: Bacterial Transformation with pGLO",
  "EXP-2025-0014: Onion Root Tip Mitosis",
  "EXP-2025-0015: MTT Cell Viability Assay",
  "EXP-2025-0016: TLC of Plant Pigments",
  "EXP-2025-0017: UV-Vis Spectroscopy - Beer-Lambert Law",
  "EXP-2025-0018: Melting Point Determination",
];

export const SYNONYM_MAP: Record<string, string> = {
  // Existing
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
  // New
  "2-Hydroxybenzoic acid": "Salicylic acid",
  "ortho-Hydroxybenzoic acid": "Salicylic acid",
  "Acetyl oxide": "Acetic anhydride",
  "Ethanoic anhydride": "Acetic anhydride",
  Ac2O: "Acetic anhydride",
  "Orthophosphoric acid": "Phosphoric acid",
  H3PO4: "Phosphoric acid",
  "Mg turnings": "Magnesium turnings",
  "Magnesium metal": "Magnesium turnings",
  "Phenyl bromide": "Bromobenzene",
  Monobromobenzene: "Bromobenzene",
  "Diphenyl ketone": "Benzophenone",
  "Phenyl ketone": "Benzophenone",
  Ether: "Diethyl ether",
  Et2O: "Diethyl ether",
  Ethoxyethane: "Diethyl ether",
  "Benzenecarboxylic acid": "Benzoic acid",
  "Phenylformic acid": "Benzoic acid",
  "4-Aminobenzenesulfonic acid": "Sulfanilic acid",
  "p-Aminobenzenesulfonic acid": "Sulfanilic acid",
  NaNO2: "Sodium nitrite",
  "Nitrous acid sodium salt": "Sodium nitrite",
  DMA: "N,N-Dimethylaniline",
  Dimethylaminobenzene: "N,N-Dimethylaniline",
  "Acetic acid": "Glacial acetic acid",
  "Ethanoic acid": "Glacial acetic acid",
  AcOH: "Glacial acetic acid",
  EtOH: "Ethanol",
  "Ethyl alcohol": "Ethanol",
  "Grain alcohol": "Ethanol",
  H2SO4: "Sulfuric acid",
  "Oil of vitriol": "Sulfuric acid",
  BSA: "Bovine serum albumin",
  "Fraction V albumin": "Bovine serum albumin",
  "o-Nitrophenyl-beta-D-galactopyranoside": "ONPG",
  "2-Propenamide": "Acrylamide",
  "Acrylic amide": "Acrylamide",
  "N,N,N',N'-Tetramethylethylenediamine": "TEMED",
  Tetramethylethylenediamine: "TEMED",
  APS: "Ammonium persulfate",
  "Ammonium peroxodisulfate": "Ammonium persulfate",
  SDS: "Sodium dodecyl sulfate",
  "Sodium lauryl sulfate": "Sodium dodecyl sulfate",
  SLS: "Sodium dodecyl sulfate",
  "Table sugar": "Sucrose",
  Saccharose: "Sucrose",
  NaCl: "Sodium chloride",
  "Table salt": "Sodium chloride",
  Halite: "Sodium chloride",
  CaCl2: "Calcium chloride",
  "Calcium dichloride": "Calcium chloride",
  "Thiazolyl blue tetrazolium bromide": "MTT",
  "Dimethyl sulfoxide": "DMSO",
  "Methyl sulfoxide": "DMSO",
  HCl: "Hydrochloric acid",
  "Muriatic acid": "Hydrochloric acid",
  Propanone: "Acetone",
  "2-Propanone": "Acetone",
  "Dimethyl ketone": "Acetone",
  "Pet ether": "Petroleum ether",
  Ligroin: "Petroleum ether",
  "Light petroleum": "Petroleum ether",
  "C.I. 13025": "Methyl orange",
  "Orange III": "Methyl orange",
  Helianthine: "Methyl orange",
  "(E)-3-Phenylacrylic acid": "trans-Cinnamic acid",
  "beta-Phenylacrylic acid": "trans-Cinnamic acid",
  "Cinnamic acid": "trans-Cinnamic acid",
  "N-Phenylacetamide": "Acetanilide",
  Antifebrin: "Acetanilide",
};
