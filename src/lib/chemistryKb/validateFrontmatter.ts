import { ChemPageType } from "./types";

export interface FrontmatterValidationResult {
  valid: boolean;
  errors: string[];
}

function checkRequired(
  frontmatter: Record<string, unknown>,
  field: string,
  errors: string[],
): void {
  if (frontmatter[field] === undefined || frontmatter[field] === null || frontmatter[field] === "") {
    errors.push(`Missing required field: ${field}`);
  }
}

function checkType(
  frontmatter: Record<string, unknown>,
  field: string,
  expectedType: string,
  errors: string[],
): void {
  if (frontmatter[field] !== undefined && frontmatter[field] !== null) {
    if (expectedType === "number" && typeof frontmatter[field] === "string") {
      const parsed = Number(frontmatter[field]);
      if (isNaN(parsed)) {
        errors.push(`Field "${field}" should be a ${expectedType}, got "${frontmatter[field]}"`);
      }
    } else if (typeof frontmatter[field] !== expectedType) {
      errors.push(`Field "${field}" should be a ${expectedType}, got ${typeof frontmatter[field]}`);
    }
  }
}

function checkEnum(
  frontmatter: Record<string, unknown>,
  field: string,
  allowed: string[],
  errors: string[],
): void {
  const val = frontmatter[field];
  if (val !== undefined && val !== null && !allowed.includes(String(val))) {
    errors.push(`Field "${field}" must be one of [${allowed.join(", ")}], got "${val}"`);
  }
}

export function validateExperimentFrontmatter(
  frontmatter: Record<string, unknown>,
): FrontmatterValidationResult {
  const errors: string[] = [];

  checkRequired(frontmatter, "title", errors);
  checkRequired(frontmatter, "icon", errors);
  checkRequired(frontmatter, "eln_id", errors);
  checkRequired(frontmatter, "researcher", errors);
  checkRequired(frontmatter, "date", errors);
  checkRequired(frontmatter, "status", errors);
  checkRequired(frontmatter, "scale_category", errors);
  checkRequired(frontmatter, "quality_score", errors);

  checkType(frontmatter, "title", "string", errors);
  checkType(frontmatter, "eln_id", "string", errors);
  checkType(frontmatter, "researcher", "string", errors);
  checkType(frontmatter, "date", "string", errors);
  checkType(frontmatter, "quality_score", "number", errors);

  checkEnum(frontmatter, "status", ["planned", "in-progress", "completed", "failed", "abandoned"], errors);
  checkEnum(frontmatter, "scale_category", ["small", "medium", "large", "pilot"], errors);

  if (frontmatter["quality_score"] !== undefined) {
    const score = Number(frontmatter["quality_score"]);
    if (!isNaN(score) && (score < 1 || score > 5)) {
      errors.push(`quality_score must be between 1 and 5, got ${score}`);
    }
  }

  if (frontmatter["icon"] !== undefined && frontmatter["icon"] !== "\u{1F9EA}") {
    errors.push(`Experiment icon must be "\u{1F9EA}", got "${frontmatter["icon"]}"`);
  }

  if (frontmatter["tags"] !== undefined) {
    if (!Array.isArray(frontmatter["tags"])) {
      errors.push("tags must be an array");
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateChemicalFrontmatter(
  frontmatter: Record<string, unknown>,
): FrontmatterValidationResult {
  const errors: string[] = [];

  checkRequired(frontmatter, "title", errors);
  checkRequired(frontmatter, "icon", errors);
  checkRequired(frontmatter, "cas_number", errors);

  checkType(frontmatter, "title", "string", errors);
  checkType(frontmatter, "cas_number", "string", errors);

  if (frontmatter["molecular_weight"] !== undefined) {
    checkType(frontmatter, "molecular_weight", "number", errors);
  }

  if (frontmatter["icon"] !== undefined && frontmatter["icon"] !== "\u2697\uFE0F") {
    errors.push(`Chemical icon must be "\u2697\uFE0F", got "${frontmatter["icon"]}"`);
  }

  if (frontmatter["common_synonyms"] !== undefined && !Array.isArray(frontmatter["common_synonyms"])) {
    errors.push("common_synonyms must be an array");
  }

  return { valid: errors.length === 0, errors };
}

export function validateReactionTypeFrontmatter(
  frontmatter: Record<string, unknown>,
): FrontmatterValidationResult {
  const errors: string[] = [];

  checkRequired(frontmatter, "title", errors);
  checkRequired(frontmatter, "icon", errors);
  checkRequired(frontmatter, "experiment_count", errors);
  checkRequired(frontmatter, "researcher_count", errors);

  checkType(frontmatter, "title", "string", errors);
  checkType(frontmatter, "experiment_count", "number", errors);
  checkType(frontmatter, "researcher_count", "number", errors);

  if (frontmatter["avg_yield"] !== undefined) {
    checkType(frontmatter, "avg_yield", "number", errors);
  }

  if (frontmatter["icon"] !== undefined && frontmatter["icon"] !== "\u{1F52C}") {
    errors.push(`Reaction type icon must be "\u{1F52C}", got "${frontmatter["icon"]}"`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateResearcherFrontmatter(
  frontmatter: Record<string, unknown>,
): FrontmatterValidationResult {
  const errors: string[] = [];

  checkRequired(frontmatter, "title", errors);
  checkRequired(frontmatter, "icon", errors);
  checkRequired(frontmatter, "experiment_count", errors);

  checkType(frontmatter, "title", "string", errors);
  checkType(frontmatter, "experiment_count", "number", errors);

  if (frontmatter["email"] !== undefined) {
    checkType(frontmatter, "email", "string", errors);
  }

  if (frontmatter["icon"] !== undefined && frontmatter["icon"] !== "\u{1F469}\u200D\u{1F52C}") {
    errors.push(`Researcher icon must be "\u{1F469}\u200D\u{1F52C}", got "${frontmatter["icon"]}"`);
  }

  if (frontmatter["primary_expertise"] !== undefined && !Array.isArray(frontmatter["primary_expertise"])) {
    errors.push("primary_expertise must be an array");
  }

  return { valid: errors.length === 0, errors };
}

export function validateSubstrateClassFrontmatter(
  frontmatter: Record<string, unknown>,
): FrontmatterValidationResult {
  const errors: string[] = [];

  checkRequired(frontmatter, "title", errors);
  checkRequired(frontmatter, "icon", errors);
  checkRequired(frontmatter, "experiment_count", errors);

  checkType(frontmatter, "title", "string", errors);
  checkType(frontmatter, "experiment_count", "number", errors);

  if (frontmatter["icon"] !== undefined && frontmatter["icon"] !== "\u{1F9EC}") {
    errors.push(`Substrate class icon must be "\u{1F9EC}", got "${frontmatter["icon"]}"`);
  }

  return { valid: errors.length === 0, errors };
}

export function validateFrontmatter(
  type: ChemPageType,
  frontmatter: Record<string, unknown>,
): FrontmatterValidationResult {
  switch (type) {
    case ChemPageType.EXPERIMENT:
      return validateExperimentFrontmatter(frontmatter);
    case ChemPageType.CHEMICAL:
      return validateChemicalFrontmatter(frontmatter);
    case ChemPageType.REACTION_TYPE:
      return validateReactionTypeFrontmatter(frontmatter);
    case ChemPageType.RESEARCHER:
      return validateResearcherFrontmatter(frontmatter);
    case ChemPageType.SUBSTRATE_CLASS:
      return validateSubstrateClassFrontmatter(frontmatter);
    default: {
      const _exhaustive: never = type;
      return { valid: false, errors: [`Unknown page type: ${_exhaustive}`] };
    }
  }
}
