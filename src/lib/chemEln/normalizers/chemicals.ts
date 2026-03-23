import type { RawExperimentData } from "../fetcherTypes";
import type { ChemicalRecord } from "../types";

const COMMON_SYNONYMS: Record<string, string> = {
  thf: "tetrahydrofuran",
  dcm: "dichloromethane",
  dmf: "dimethylformamide",
  dmso: "dimethyl sulfoxide",
  etoh: "ethanol",
  meoh: "methanol",
  acn: "acetonitrile",
  mecn: "acetonitrile",
  et2o: "diethyl ether",
  etoac: "ethyl acetate",
  hex: "hexane",
  ipa: "isopropanol",
  iproh: "isopropanol",
  nmp: "n-methyl-2-pyrrolidone",
  dce: "1,2-dichloroethane",
  tbme: "tert-butyl methyl ether",
  mtbe: "tert-butyl methyl ether",
  dipea: "n,n-diisopropylethylamine",
  dmap: "4-dimethylaminopyridine",
  tfa: "trifluoroacetic acid",
  tea: "triethylamine",
  dea: "diethylamine",
};

// Pre-compute a reverse map: normalized full name -> display full name
const NORMALIZED_FULL_NAMES = new Map<string, string>();
for (const displayName of Object.values(COMMON_SYNONYMS)) {
  const normalized = stripToAlphanumeric(displayName);
  if (!NORMALIZED_FULL_NAMES.has(normalized)) {
    NORMALIZED_FULL_NAMES.set(normalized, displayName);
  }
}

function stripToAlphanumeric(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeChemicalName(name: string): string {
  return stripToAlphanumeric(name);
}

export function toTitleCase(name: string): string {
  return name
    .trim()
    .split(" ")
    .map((word) => {
      if (word.length === 0) return word;
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/**
 * Given a normalized (alphanumeric-only) name, resolve it to a canonical
 * normalized key. If the name is a known abbreviation, return the normalized
 * full name. If the name IS a known full name, return it as-is. Otherwise
 * return the input unchanged.
 */
function resolveToCanonicalKey(normalizedName: string): string {
  // Check if it's an abbreviation
  const fullName = COMMON_SYNONYMS[normalizedName];
  if (fullName) {
    return stripToAlphanumeric(fullName);
  }
  // Check if it already IS a full name
  if (NORMALIZED_FULL_NAMES.has(normalizedName)) {
    return normalizedName;
  }
  return normalizedName;
}

/**
 * Get the display name for a canonical key from the synonym registry.
 */
function getDisplayNameForKey(canonicalKey: string): string | undefined {
  return NORMALIZED_FULL_NAMES.get(canonicalKey);
}

function getAbbreviationsFor(canonicalKey: string): string[] {
  return Object.entries(COMMON_SYNONYMS)
    .filter(([, fullName]) => stripToAlphanumeric(fullName) === canonicalKey)
    .map(([abbr]) => abbr.toUpperCase());
}

interface GroupData {
  molecularWeight: number | null;
  experimentIds: Set<string>;
  names: Set<string>;
}

export function deduplicateChemicals(
  experiments: RawExperimentData[],
): ChemicalRecord[] {
  const casGroups = new Map<string, GroupData>();
  const nameGroups = new Map<string, GroupData>();

  for (const exp of experiments) {
    for (const chem of exp.chemicals) {
      const cas = chem.cas_number?.trim() || null;
      const rawName = chem.name.trim();

      if (cas) {
        if (!casGroups.has(cas)) {
          casGroups.set(cas, {
            molecularWeight: chem.molecular_weight,
            experimentIds: new Set(),
            names: new Set(),
          });
        }
        const group = casGroups.get(cas)!;
        group.experimentIds.add(exp.id);
        group.names.add(rawName);
        if (chem.molecular_weight && !group.molecularWeight) {
          group.molecularWeight = chem.molecular_weight;
        }
      } else {
        const normalizedName = normalizeChemicalName(rawName);
        const canonicalKey = resolveToCanonicalKey(normalizedName);

        if (!nameGroups.has(canonicalKey)) {
          nameGroups.set(canonicalKey, {
            molecularWeight: chem.molecular_weight,
            experimentIds: new Set(),
            names: new Set(),
          });
        }
        const group = nameGroups.get(canonicalKey)!;
        group.experimentIds.add(exp.id);
        group.names.add(rawName);
        if (chem.molecular_weight && !group.molecularWeight) {
          group.molecularWeight = chem.molecular_weight;
        }
      }
    }
  }

  const records: ChemicalRecord[] = [];

  casGroups.forEach((group, cas) => {
    records.push(buildRecord(cas, group));
  });

  nameGroups.forEach((group) => {
    records.push(buildRecord(null, group));
  });

  return records.sort((a, b) => b.usageCount - a.usageCount);
}

function buildRecord(
  casNumber: string | null,
  group: GroupData,
): ChemicalRecord {
  const allNames = Array.from(group.names);

  // Pick the longest raw name as the starting canonical
  const longestName = [...allNames].sort((a, b) => b.length - a.length)[0];
  const longestNormalized = normalizeChemicalName(longestName);

  // Check if the longest name is a known abbreviation; if so, use the full name
  const displayFromSynonym = getDisplayNameForKey(
    resolveToCanonicalKey(longestNormalized),
  );

  let finalCanonicalName: string;
  const canonicalKey = resolveToCanonicalKey(longestNormalized);

  if (displayFromSynonym) {
    finalCanonicalName = toTitleCase(displayFromSynonym);
  } else {
    finalCanonicalName = toTitleCase(longestName);
  }

  // Build synonyms: all names that differ from the canonical display
  const synonyms: string[] = [];
  const canonicalNormalized = normalizeChemicalName(finalCanonicalName);

  for (const name of allNames) {
    if (normalizeChemicalName(name) !== canonicalNormalized) {
      synonyms.push(name);
    }
  }

  // Add known abbreviations not already present
  const knownAbbreviations = getAbbreviationsFor(canonicalKey);
  for (const abbr of knownAbbreviations) {
    const abbrNormalized = normalizeChemicalName(abbr);
    if (
      abbrNormalized !== canonicalNormalized &&
      !synonyms.some((s) => normalizeChemicalName(s) === abbrNormalized)
    ) {
      synonyms.push(abbr);
    }
  }

  return {
    casNumber,
    canonicalName: finalCanonicalName,
    synonyms,
    usageCount: group.experimentIds.size,
    molecularFormula: null,
    molecularWeight: group.molecularWeight,
    experiments: Array.from(group.experimentIds),
  };
}
