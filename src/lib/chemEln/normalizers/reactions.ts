import type { RawExperimentData } from "../fetcherTypes";
import type { ClassifiedExperiment, ReactionTypeStats } from "../types";

export interface ReactionTypeEntry {
  canonicalName: string;
  keywords: string[];
  category: string;
}

const REACTION_TYPE_TABLE: ReactionTypeEntry[] = [
  // Cross-coupling reactions (listed first - more specific)
  {
    canonicalName: "Suzuki",
    keywords: ["suzuki", "suzuki-miyaura"],
    category: "Cross-Coupling",
  },
  {
    canonicalName: "Heck",
    keywords: ["heck", "mizoroki-heck", "heck reaction"],
    category: "Cross-Coupling",
  },
  {
    canonicalName: "Sonogashira",
    keywords: ["sonogashira", "alkyne coupling", "pd/cu coupling"],
    category: "Cross-Coupling",
  },
  {
    canonicalName: "Stille",
    keywords: ["stille", "stille coupling", "organotin"],
    category: "Cross-Coupling",
  },
  {
    canonicalName: "Negishi",
    keywords: ["negishi", "negishi coupling", "organozinc"],
    category: "Cross-Coupling",
  },
  {
    canonicalName: "Kumada",
    keywords: ["kumada", "kumada coupling"],
    category: "Cross-Coupling",
  },
  {
    canonicalName: "Buchwald-Hartwig",
    keywords: ["buchwald", "hartwig", "buchwald-hartwig", "c-n coupling"],
    category: "Cross-Coupling",
  },

  // Classical reactions
  {
    canonicalName: "Grignard",
    keywords: ["grignard"],
    category: "Classical",
  },
  {
    canonicalName: "Aldol",
    keywords: ["aldol", "aldol condensation", "aldol reaction"],
    category: "Classical",
  },
  {
    canonicalName: "Wittig",
    keywords: ["wittig", "phosphonium ylide"],
    category: "Classical",
  },
  {
    canonicalName: "Diels-Alder",
    keywords: ["diels-alder", "diels alder", "4+2 cycloaddition"],
    category: "Classical",
  },
  {
    canonicalName: "Friedel-Crafts Acylation",
    keywords: ["friedel-crafts acylation", "friedel crafts acylation"],
    category: "Classical",
  },
  {
    canonicalName: "Friedel-Crafts Alkylation",
    keywords: ["friedel-crafts alkylation", "friedel crafts alkylation"],
    category: "Classical",
  },
  {
    canonicalName: "Claisen Rearrangement",
    keywords: ["claisen rearrangement", "claisen condensation"],
    category: "Classical",
  },
  {
    canonicalName: "Beckmann Rearrangement",
    keywords: ["beckmann", "beckmann rearrangement"],
    category: "Classical",
  },

  // Functional group transformations
  {
    canonicalName: "Hydrogenation",
    keywords: ["hydrogenation", "catalytic hydrogenation"],
    category: "Functional Group",
  },
  {
    canonicalName: "Oxidation",
    keywords: ["oxidation", "oxidize", "swern", "jones oxidation", "pcc oxidation", "dess-martin"],
    category: "Functional Group",
  },
  {
    canonicalName: "Reduction",
    keywords: ["reduction", "lialh4", "nabh4", "borohydride", "reduce"],
    category: "Functional Group",
  },
  {
    canonicalName: "Esterification",
    keywords: ["esterification", "ester formation", "fischer esterification"],
    category: "Functional Group",
  },
  {
    canonicalName: "Amidation",
    keywords: ["amidation", "amide bond", "peptide coupling", "amide formation"],
    category: "Functional Group",
  },
  {
    canonicalName: "Halogenation",
    keywords: ["halogenation", "bromination", "chlorination", "iodination", "fluorination"],
    category: "Functional Group",
  },
  {
    canonicalName: "Nitration",
    keywords: ["nitration", "nitro group"],
    category: "Functional Group",
  },
  {
    canonicalName: "Hydrolysis",
    keywords: ["hydrolysis", "hydrolyze", "saponification"],
    category: "Functional Group",
  },
  {
    canonicalName: "Dehydration",
    keywords: ["dehydration", "elimination reaction"],
    category: "Functional Group",
  },
  {
    canonicalName: "Methylation",
    keywords: ["methylation", "n-methylation", "o-methylation"],
    category: "Functional Group",
  },
  {
    canonicalName: "Acetylation",
    keywords: ["acetylation", "acetic anhydride"],
    category: "Functional Group",
  },
  {
    canonicalName: "Silylation",
    keywords: ["silylation", "tms protection", "trimethylsilyl"],
    category: "Functional Group",
  },

  // Other
  {
    canonicalName: "Click Chemistry",
    keywords: ["click chemistry", "click reaction", "azide-alkyne", "cuaac"],
    category: "Other",
  },
  {
    canonicalName: "Metathesis",
    keywords: ["metathesis", "olefin metathesis", "ring-closing metathesis", "grubbs"],
    category: "Other",
  },
  {
    canonicalName: "Polymerization",
    keywords: ["polymerization", "polymer", "radical polymerization", "raft", "atrp"],
    category: "Other",
  },
  {
    canonicalName: "Protection",
    keywords: ["protection", "protecting group", "boc protection", "fmoc protection", "tbdms"],
    category: "Other",
  },
  {
    canonicalName: "Deprotection",
    keywords: ["deprotection", "deprotect", "boc removal", "fmoc removal"],
    category: "Other",
  },
  {
    canonicalName: "Cyclization",
    keywords: ["cyclization", "ring closure", "macrocyclization", "intramolecular cyclization"],
    category: "Other",
  },
  {
    canonicalName: "Substitution",
    keywords: ["nucleophilic substitution", "sn1", "sn2", "aromatic substitution"],
    category: "Other",
  },
  {
    canonicalName: "Rearrangement",
    keywords: ["rearrangement", "cope rearrangement", "sigmatropic"],
    category: "Other",
  },
];

function normalizeText(text: string): string {
  return text.toLowerCase().trim();
}

function matchReactionType(text: string): ReactionTypeEntry | null {
  const normalized = normalizeText(text);
  for (const entry of REACTION_TYPE_TABLE) {
    if (entry.keywords.some((kw) => normalized.includes(kw))) {
      return entry;
    }
  }
  return null;
}

export function classifySingleExperiment(
  experiment: RawExperimentData
): ClassifiedExperiment {
  if (
    experiment.reaction_type &&
    experiment.reaction_type.trim() !== "" &&
    experiment.reaction_type !== "Unknown"
  ) {
    const match = matchReactionType(experiment.reaction_type);
    if (match) {
      return {
        experimentId: experiment.id,
        reactionType: match.canonicalName,
        confidence: "high",
      };
    }
  }

  const searchText = [experiment.title, experiment.results ?? ""]
    .filter(Boolean)
    .join(" ");

  if (searchText.trim()) {
    const match = matchReactionType(searchText);
    if (match) {
      return {
        experimentId: experiment.id,
        reactionType: match.canonicalName,
        confidence: "medium",
      };
    }
  }

  return {
    experimentId: experiment.id,
    reactionType: "Unclassified",
    confidence: "low",
  };
}

export function classifyReactions(
  experiments: RawExperimentData[]
): ReactionTypeStats[] {
  const classified = experiments.map(classifySingleExperiment);

  const groupMap = new Map<
    string,
    { ids: string[]; yields: number[]; researchers: Set<string> }
  >();

  for (let i = 0; i < classified.length; i++) {
    const cls = classified[i];
    const exp = experiments[i];

    let group = groupMap.get(cls.reactionType);
    if (!group) {
      group = { ids: [], yields: [], researchers: new Set() };
      groupMap.set(cls.reactionType, group);
    }

    group.ids.push(cls.experimentId);
    if (exp.yield_percent != null) {
      group.yields.push(exp.yield_percent);
    }
    if (exp.researcher_name) {
      group.researchers.add(exp.researcher_name);
    }
  }

  const stats: ReactionTypeStats[] = Array.from(groupMap.entries()).map(
    ([reactionType, group]) => ({
      reactionType,
      experimentCount: group.ids.length,
      experiments: group.ids,
      avgYield:
        group.yields.length > 0
          ? Math.round(
              (group.yields.reduce((sum, y) => sum + y, 0) /
                group.yields.length) *
                10
            ) / 10
          : null,
      researchers: Array.from(group.researchers).sort(),
    })
  );

  return stats.sort((a, b) => b.experimentCount - a.experimentCount);
}

export { REACTION_TYPE_TABLE };
