/**
 * Sweep configuration.
 * All values configurable via environment variables.
 */

/** Hard ceiling on pages per sweep to prevent runaway processing */
export const MAX_SWEEP_BUDGET = parseInt(
  process.env.MAX_SWEEP_BUDGET || "500",
  10
);

/** LLM calls per minute during sweep */
export const SWEEP_RATE_LIMIT = parseInt(
  process.env.SWEEP_RATE_LIMIT || "10",
  10
);

/** Minimum page title length for link discovery (skip very short titles) */
export const MIN_TITLE_LENGTH_FOR_LINK_DISCOVERY = 3;

/** Confidence threshold above which links are auto-created (if autoLink enabled) */
export const AUTO_LINK_CONFIDENCE_THRESHOLD = 0.8;

/** Characters of surrounding context to extract for link suggestions */
export const LINK_CONTEXT_CHARS = 50;
