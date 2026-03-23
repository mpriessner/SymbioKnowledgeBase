import { ChemPageType } from "./types";

/**
 * Maximum length for the full experiment title (ELN ID + short title).
 */
const MAX_EXPERIMENT_TITLE_LENGTH = 80;

/**
 * Maximum length for the short title portion of an experiment title.
 */
const MAX_SHORT_TITLE_LENGTH = 60;

/**
 * Regex matching the experiment title format: EXP-YYYY-NNNN: [Short Title]
 */
const EXPERIMENT_TITLE_REGEX = /^EXP-\d{4}-\d{4}: .+$/;

/**
 * Regex matching just the ELN ID prefix: EXP-YYYY-NNNN
 */
const ELN_ID_REGEX = /^EXP-\d{4}-\d{4}$/;

export interface NamingValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates that an experiment title follows the "EXP-YYYY-NNNN: [Short Title]" format.
 */
export function validateExperimentTitle(title: string): NamingValidationResult {
  const errors: string[] = [];

  if (!title || title.trim().length === 0) {
    return { valid: false, errors: ["Title must not be empty"] };
  }

  if (!EXPERIMENT_TITLE_REGEX.test(title)) {
    errors.push(
      'Title must match format "EXP-YYYY-NNNN: [Short Title]" (e.g., "EXP-2026-0042: Suzuki Coupling of Aryl Bromide")'
    );
  }

  if (title.length > MAX_EXPERIMENT_TITLE_LENGTH) {
    errors.push(
      `Title must not exceed ${MAX_EXPERIMENT_TITLE_LENGTH} characters (currently ${title.length})`
    );
  }

  // Check short title length if format is otherwise correct
  const colonIndex = title.indexOf(": ");
  if (colonIndex >= 0) {
    const shortTitle = title.slice(colonIndex + 2);
    if (shortTitle.length > MAX_SHORT_TITLE_LENGTH) {
      errors.push(
        `Short title must not exceed ${MAX_SHORT_TITLE_LENGTH} characters (currently ${shortTitle.length})`
      );
    }
    if (shortTitle.trim().length === 0) {
      errors.push("Short title must not be empty");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a chemical page title. Ensures it is non-empty and within length limits.
 * Chemical titles are flexible (common name, IUPAC, abbreviation) so validation is minimal.
 */
export function validateChemicalTitle(title: string): NamingValidationResult {
  const errors: string[] = [];

  if (!title || title.trim().length === 0) {
    return { valid: false, errors: ["Title must not be empty"] };
  }

  if (title.length > MAX_EXPERIMENT_TITLE_LENGTH) {
    errors.push(
      `Title must not exceed ${MAX_EXPERIMENT_TITLE_LENGTH} characters (currently ${title.length}). Use common name and place IUPAC name in frontmatter.`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Formats an experiment title from an ELN ID and short description.
 *
 * @param elnId - The ELN identifier (e.g., "EXP-2026-0042")
 * @param shortTitle - Brief description of the experiment
 * @returns The formatted title string
 */
export function formatExperimentTitle(
  elnId: string,
  shortTitle: string
): string {
  if (!ELN_ID_REGEX.test(elnId)) {
    throw new Error(
      `Invalid ELN ID format: "${elnId}". Expected "EXP-YYYY-NNNN".`
    );
  }

  const trimmedTitle = shortTitle.trim();
  if (trimmedTitle.length === 0) {
    throw new Error("Short title must not be empty");
  }

  const truncated =
    trimmedTitle.length > MAX_SHORT_TITLE_LENGTH
      ? trimmedTitle.slice(0, MAX_SHORT_TITLE_LENGTH).trimEnd()
      : trimmedTitle;

  return `${elnId}: ${truncated}`;
}

/**
 * Formats a researcher page title.
 *
 * @param firstName - Researcher's first name (full, not initials)
 * @param lastName - Researcher's last name
 * @param hasPhd - Whether the researcher holds a doctoral degree
 * @returns The formatted title string
 */
export function formatResearcherTitle(
  firstName: string,
  lastName: string,
  hasPhd: boolean
): string {
  const first = firstName.trim();
  const last = lastName.trim();

  if (first.length === 0 || last.length === 0) {
    throw new Error("First name and last name must not be empty");
  }

  return hasPhd ? `Dr. ${first} ${last}` : `${first} ${last}`;
}

export interface GeneratePageTitleData {
  elnId?: string;
  shortTitle?: string;
  chemicalName?: string;
  reactionName?: string;
  firstName?: string;
  lastName?: string;
  hasPhd?: boolean;
  className?: string;
}

/**
 * Factory function that generates a properly formatted page title
 * based on the page type and provided data.
 */
export function generatePageTitle(
  pageType: ChemPageType,
  data: GeneratePageTitleData
): string {
  switch (pageType) {
    case ChemPageType.EXPERIMENT: {
      if (!data.elnId || !data.shortTitle) {
        throw new Error(
          "Experiment pages require elnId and shortTitle in data"
        );
      }
      return formatExperimentTitle(data.elnId, data.shortTitle);
    }
    case ChemPageType.CHEMICAL: {
      if (!data.chemicalName) {
        throw new Error("Chemical pages require chemicalName in data");
      }
      return data.chemicalName.trim();
    }
    case ChemPageType.REACTION_TYPE: {
      if (!data.reactionName) {
        throw new Error("ReactionType pages require reactionName in data");
      }
      return data.reactionName.trim();
    }
    case ChemPageType.RESEARCHER: {
      if (!data.firstName || !data.lastName) {
        throw new Error("Researcher pages require firstName and lastName in data");
      }
      return formatResearcherTitle(
        data.firstName,
        data.lastName,
        data.hasPhd ?? false
      );
    }
    case ChemPageType.SUBSTRATE_CLASS: {
      if (!data.className) {
        throw new Error("SubstrateClass pages require className in data");
      }
      return data.className.trim();
    }
    default: {
      const _exhaustive: never = pageType;
      throw new Error(`Unknown page type: ${_exhaustive}`);
    }
  }
}
