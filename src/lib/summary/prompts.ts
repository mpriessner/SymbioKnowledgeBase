import { SUMMARY_MAX_INPUT_CHARS } from "./config";

/**
 * Build the LLM prompt for generating page summaries.
 *
 * Produces a structured prompt that asks for JSON output with
 * oneLiner and summary fields.
 */
export function buildSummaryPrompt(title: string, content: string): string {
  const truncatedContent =
    content.length > SUMMARY_MAX_INPUT_CHARS
      ? content.slice(0, SUMMARY_MAX_INPUT_CHARS) + "\n[...content truncated]"
      : content;

  return `Analyze the following page from a knowledge base.

Title: ${title}
Content:
${truncatedContent}

Generate:
1. ONE-LINER (max 100 chars): A brief phrase describing what this page is about.
   Do not end with a period. Be specific, not generic.
   Good: "JWT authentication setup for REST API endpoints"
   Bad: "Information about authentication"

2. SUMMARY (max 500 chars, 2-4 sentences): Describe the scope, key topics covered,
   and the value of this page. Be concrete.

Respond ONLY with valid JSON, no markdown fences:
{"oneLiner": "...", "summary": "..."}`;
}
