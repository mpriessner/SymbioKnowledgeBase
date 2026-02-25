import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { errorResponse } from "@/lib/apiResponse";
import { PAGE_GENERATION_SYSTEM_PROMPT } from "@/lib/ai/page-generation-prompt";
import { getMeetingNotesPrompt } from "@/lib/ai/meeting-notes-prompt";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
};

const generatePageSchema = z.object({
  prompt: z.string().min(3).max(5000),
  context: z.string().max(100).optional(),
  metadata: z
    .object({
      duration: z.string().optional(),
      date: z.string().optional(),
    })
    .optional(),
  provider: z.enum(["openai", "anthropic", "google"]).optional(),
  apiKey: z.string().max(500).optional(),
  model: z.string().max(100).optional(),
});

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getSystemPrompt(context?: string, metadata?: { duration?: string; date?: string }): string {
  if (context === "meeting-notes") {
    return getMeetingNotesPrompt({
      duration: metadata?.duration ?? "Unknown",
      date: metadata?.date ?? new Date().toISOString().slice(0, 10),
    });
  }
  return PAGE_GENERATION_SYSTEM_PROMPT;
}

async function streamOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Response> {
  const response = await fetch(PROVIDER_ENDPOINTS.openai, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  return pipeSSE(response, (json) => json.choices?.[0]?.delta?.content);
}

async function streamAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Response> {
  const response = await fetch(PROVIDER_ENDPOINTS.anthropic, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      stream: true,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  return pipeSSE(response, (json) => {
    if (json.type === "content_block_delta") return json.delta?.text;
    if (json.type === "message_stop") return null;
    return undefined;
  });
}

async function streamGoogle(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string
): Promise<Response> {
  const url = `${PROVIDER_ENDPOINTS.google}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { maxOutputTokens: 4096, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Google API error: ${response.status}`);
  }

  return pipeSSE(response, (json) =>
    json.candidates?.[0]?.content?.parts?.[0]?.text
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pipeSSE(upstream: Response, extractContent: (json: any) => string | null | undefined): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body?.getReader();
      if (!reader) { controller.close(); return; }

      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;
            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const json = JSON.parse(data);
              const content = extractContent(json);
              if (content) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                );
              } else if (content === null) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch { /* skip malformed */ }
          }
        }
        // Ensure DONE is sent
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        console.error("[AI Generate] Stream error:", error);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    if (!checkRateLimit(ctx.userId)) {
      return errorResponse("RATE_LIMITED", "Too many requests. Please wait.", undefined, 429);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Invalid JSON body", undefined, 400);
    }

    const parsed = generatePageSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("VALIDATION_ERROR", "Invalid input", undefined, 400);
    }

    const {
      prompt,
      context,
      metadata,
      provider = "openai",
      apiKey: clientKey,
      model: requestedModel,
    } = parsed.data;

    const envKeys: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_AI_API_KEY,
    };
    const apiKey = clientKey || envKeys[provider];

    if (!apiKey) {
      return errorResponse(
        "CONFIG_ERROR",
        `No API key configured for ${provider}. Configure in Settings > AI.`,
        undefined,
        503
      );
    }

    const defaultModels: Record<string, string> = {
      openai: "gpt-4o-mini",
      anthropic: "claude-sonnet-4-20250514",
      google: "gemini-2.0-flash",
    };
    const model = requestedModel || defaultModels[provider];
    const systemPrompt = getSystemPrompt(context, metadata);

    try {
      switch (provider) {
        case "anthropic":
          return await streamAnthropic(apiKey, model, systemPrompt, prompt);
        case "google":
          return await streamGoogle(apiKey, model, systemPrompt, prompt);
        case "openai":
        default:
          return await streamOpenAI(apiKey, model, systemPrompt, prompt);
      }
    } catch (error) {
      console.error("[AI Generate] Error:", error);
      return errorResponse("AI_ERROR", "Failed to generate content", undefined, 502);
    }
  }
);
