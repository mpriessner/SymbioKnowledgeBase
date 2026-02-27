import {
  SUMMARY_LLM_PROVIDER,
  SUMMARY_LLM_MODEL,
  SUMMARY_LLM_API_KEY,
  SUMMARY_LLM_TIMEOUT_MS,
  ONE_LINER_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  isSummaryGenerationEnabled,
} from "./config";
import { buildSummaryPrompt } from "./prompts";
import type { LLMProvider, LLMResponse, SummaryResult } from "./types";

/**
 * Parse and validate the LLM JSON response.
 */
function parseSummaryResponse(text: string): SummaryResult {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as Record<string, unknown>;

  const oneLiner = String(parsed.oneLiner || "").slice(
    0,
    ONE_LINER_MAX_LENGTH
  );
  const summary = String(parsed.summary || "").slice(0, SUMMARY_MAX_LENGTH);

  if (!oneLiner || !summary) {
    throw new Error("LLM response missing oneLiner or summary");
  }

  return { oneLiner, summary };
}

/**
 * OpenAI-compatible provider (works with gpt-4o-mini, etc.)
 */
class OpenAIProvider implements LLMProvider {
  async generateSummary(
    title: string,
    content: string
  ): Promise<LLMResponse> {
    const prompt = buildSummaryPrompt(title, content);
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SUMMARY_LLM_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUMMARY_LLM_API_KEY}`,
          },
          body: JSON.stringify({
            model: SUMMARY_LLM_MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are a knowledge base assistant that generates concise page summaries. Always respond with valid JSON.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.3,
            max_tokens: 300,
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `OpenAI API error ${response.status}: ${errorBody}`
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const text = data.choices[0]?.message?.content || "";
      const result = parseSummaryResponse(text);
      const latencyMs = Date.now() - start;

      return {
        ...result,
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        latencyMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Anthropic provider (claude-3-haiku, etc.)
 */
class AnthropicProvider implements LLMProvider {
  async generateSummary(
    title: string,
    content: string
  ): Promise<LLMResponse> {
    const prompt = buildSummaryPrompt(title, content);
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      SUMMARY_LLM_TIMEOUT_MS
    );

    try {
      const response = await fetch(
        "https://api.anthropic.com/v1/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": SUMMARY_LLM_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: SUMMARY_LLM_MODEL,
            max_tokens: 300,
            messages: [{ role: "user", content: prompt }],
          }),
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        throw new Error(
          `Anthropic API error ${response.status}: ${errorBody}`
        );
      }

      const data = (await response.json()) as {
        content: Array<{ text: string }>;
        usage?: { input_tokens: number; output_tokens: number };
      };

      const text = data.content[0]?.text || "";
      const result = parseSummaryResponse(text);
      const latencyMs = Date.now() - start;

      return {
        ...result,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        latencyMs,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * Create the appropriate LLM provider based on configuration.
 * Returns null if no API key is configured.
 */
export function createLLMProvider(): LLMProvider | null {
  if (!isSummaryGenerationEnabled()) return null;

  switch (SUMMARY_LLM_PROVIDER) {
    case "anthropic":
      return new AnthropicProvider();
    case "openai":
    default:
      return new OpenAIProvider();
  }
}
