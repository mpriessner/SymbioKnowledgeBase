/**
 * Summary generation configuration.
 * All values configurable via environment variables.
 */

export const SUMMARY_LLM_PROVIDER =
  process.env.SUMMARY_LLM_PROVIDER || "openai";
export const SUMMARY_LLM_MODEL =
  process.env.SUMMARY_LLM_MODEL || "gpt-4o-mini";
export const SUMMARY_LLM_API_KEY =
  process.env.SUMMARY_LLM_API_KEY || "";
export const SUMMARY_CHANGE_THRESHOLD = parseFloat(
  process.env.SUMMARY_CHANGE_THRESHOLD || "0.10"
);
export const SUMMARY_RATE_LIMIT = parseInt(
  process.env.SUMMARY_RATE_LIMIT || "10",
  10
);
export const SUMMARY_MAX_INPUT_CHARS = 4000;
export const ONE_LINER_MAX_LENGTH = 100;
export const SUMMARY_MAX_LENGTH = 500;
export const SUMMARY_LLM_TIMEOUT_MS = 30_000;

export function isSummaryGenerationEnabled(): boolean {
  return SUMMARY_LLM_API_KEY.length > 0;
}
