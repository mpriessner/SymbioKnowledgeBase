import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { errorResponse } from "@/lib/apiResponse";
import type { TenantContext } from "@/types/auth";
import { z } from "zod";

/**
 * Provider API endpoints
 */
const PROVIDER_ENDPOINTS: Record<string, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  google: "https://generativelanguage.googleapis.com/v1beta/models",
};

/**
 * System prompt for the AI assistant.
 */
const SYSTEM_PROMPT = `You are an AI assistant integrated into SymbioKnowledgeBase (SKB), a knowledge management platform for scientists and researchers.

Your role is to help users:
- Understand and analyze their documents
- Generate content (meeting agendas, summaries, task lists)
- Answer questions about their knowledge base
- Provide insights and suggestions

Be concise, accurate, and helpful. When referencing page content provided as context, cite it specifically.`;

/**
 * Request validation schema
 */
const chatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1),
  })).min(1).max(50),
  context: z.string().max(50000).optional(),
  model: z.string().max(100).optional(),
  provider: z.enum(["openai", "anthropic", "google"]).optional(),
  apiKey: z.string().max(500).optional(),
  stream: z.boolean().optional(),
});

/**
 * Simple in-memory rate limiter.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Build OpenAI-compatible messages array
 */
function buildMessages(
  messages: Array<{ role: string; content: string }>,
  context?: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const result: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (context) {
    result.push({
      role: "system",
      content: `Current page context:\n\n${context}`,
    });
  }

  for (const msg of messages) {
    result.push({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    });
  }

  return result;
}

/**
 * Stream OpenAI response
 */
async function streamOpenAI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  context?: string
): Promise<Response> {
  const openAIMessages = buildMessages(messages, context);

  const response = await fetch(PROVIDER_ENDPOINTS.openai, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: openAIMessages,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI Chat] OpenAI error: ${response.status} - ${errorText}`);
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
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
              const content = json.choices?.[0]?.delta?.content;
              if (content) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      } catch (error) {
        console.error("[AI Chat] Stream error:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`));
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
      "X-Model": model,
      "X-Provider": "openai",
    },
  });
}

/**
 * Stream Anthropic response
 */
async function streamAnthropic(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  context?: string
): Promise<Response> {
  let systemPrompt = SYSTEM_PROMPT;
  if (context) {
    systemPrompt += `\n\nCurrent page context:\n\n${context}`;
  }

  // Anthropic uses a different format - system is separate, messages alternate user/assistant
  const anthropicMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

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
      messages: anthropicMessages,
      stream: true,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI Chat] Anthropic error: ${response.status} - ${errorText}`);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
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

            try {
              const json = JSON.parse(data);
              // Anthropic event types: content_block_delta, message_stop
              if (json.type === "content_block_delta" && json.delta?.text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: json.delta.text })}\n\n`));
              } else if (json.type === "message_stop") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch { /* skip malformed chunks */ }
          }
        }
      } catch (error) {
        console.error("[AI Chat] Anthropic stream error:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`));
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
      "X-Model": model,
      "X-Provider": "anthropic",
    },
  });
}

/**
 * Stream Google Gemini response
 */
async function streamGoogle(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  context?: string
): Promise<Response> {
  // Gemini uses a different format
  let systemInstruction = SYSTEM_PROMPT;
  if (context) {
    systemInstruction += `\n\nCurrent page context:\n\n${context}`;
  }

  const geminiContents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const url = `${PROVIDER_ENDPOINTS.google}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: 4096,
        temperature: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[AI Chat] Google error: ${response.status} - ${errorText}`);
    throw new Error(`Google API error: ${response.status}`);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = response.body?.getReader();
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

            try {
              const json = JSON.parse(data);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
              }
            } catch { /* skip malformed chunks */ }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        console.error("[AI Chat] Google stream error:", error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`));
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
      "X-Model": model,
      "X-Provider": "google",
    },
  });
}

/**
 * POST /api/ai/chat
 *
 * Multi-provider AI chat with streaming. Accepts API key from client
 * or falls back to server-side env vars.
 */
export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    // Rate limiting
    if (!checkRateLimit(ctx.userId)) {
      return errorResponse(
        "RATE_LIMITED",
        "Too many requests. Please wait a moment.",
        undefined,
        429
      );
    }

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse("INVALID_JSON", "Invalid JSON body", undefined, 400);
    }

    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const details = Object.entries(fieldErrors).flatMap(([field, messages]) =>
        (messages ?? []).map((message: string) => ({ field, message }))
      );
      return errorResponse("VALIDATION_ERROR", "Invalid input", details, 400);
    }

    const { messages, context, model: requestedModel, provider = "openai", apiKey: clientKey } = parsed.data;

    // Determine API key: client-provided > env var
    const envKeys: Record<string, string | undefined> = {
      openai: process.env.OPENAI_API_KEY,
      anthropic: process.env.ANTHROPIC_API_KEY,
      google: process.env.GOOGLE_AI_API_KEY,
    };

    const apiKey = clientKey || envKeys[provider];

    if (!apiKey) {
      return errorResponse(
        "CONFIG_ERROR",
        `No API key configured for ${provider}. Go to Settings > AI Configuration to add your API key.`,
        undefined,
        503
      );
    }

    // Default models per provider
    const defaultModels: Record<string, string> = {
      openai: "gpt-4o-mini",
      anthropic: "claude-sonnet-4-20250514",
      google: "gemini-2.0-flash",
    };
    const model = requestedModel || defaultModels[provider];

    console.log(
      `[AI Chat] User: ${ctx.userId}, Provider: ${provider}, Model: ${model}, Messages: ${messages.length}, HasContext: ${!!context}`
    );

    try {
      switch (provider) {
        case "anthropic":
          return await streamAnthropic(apiKey, model, messages, context);
        case "google":
          return await streamGoogle(apiKey, model, messages, context);
        case "openai":
        default:
          return await streamOpenAI(apiKey, model, messages, context);
      }
    } catch (error) {
      console.error("[AI Chat] Request error:", error);
      const message = error instanceof Error ? error.message : "Failed to connect to AI service";

      if (message.includes("401") || message.includes("auth")) {
        return errorResponse(
          "AUTH_ERROR",
          "AI service authentication failed. Check your API key in Settings > AI Configuration.",
          undefined,
          503
        );
      }

      return errorResponse(
        "AI_ERROR",
        "Failed to connect to AI service. Please check your API key and try again.",
        undefined,
        502
      );
    }
  }
);

/**
 * OPTIONS handler for CORS preflight.
 */
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
