import { NextRequest } from "next/server";
import { withTenant } from "@/lib/auth/withTenant";
import { errorResponse } from "@/lib/apiResponse";
import {
  aiChatRequestSchema,
  SUPPORTED_MODELS,
  DEFAULT_MODEL,
  type ChatMessage,
} from "@/lib/validation/aiChat";
import type { TenantContext } from "@/types/auth";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

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
 * Build the messages array for OpenAI API, including system prompt and context.
 */
function buildOpenAIMessages(
  messages: ChatMessage[],
  context?: string
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const openAIMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [{ role: "system", content: SYSTEM_PROMPT }];

  // Add context as a system message if provided
  if (context) {
    openAIMessages.push({
      role: "system",
      content: `Current page context:\n\n${context}`,
    });
  }

  // Add conversation messages
  for (const msg of messages) {
    openAIMessages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return openAIMessages;
}

/**
 * Simple in-memory rate limiter.
 * In production, use Redis or a proper rate limiting service.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW_MS = 60 * 1000; // 1 minute

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
 * POST /api/ai/chat
 *
 * Chat with the AI assistant. Supports streaming responses via Server-Sent Events.
 *
 * Request body:
 * - messages: Array of { role: 'user' | 'assistant', content: string }
 * - context?: string - Optional page context to include
 * - model?: string - Optional model override (default: gpt-4o-mini)
 *
 * Response: Streaming text/event-stream with SSE format
 */
export const POST = withTenant(
  async (req: NextRequest, ctx: TenantContext) => {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error("OPENAI_API_KEY not configured");
      return errorResponse(
        "CONFIG_ERROR",
        "AI service not configured",
        undefined,
        503
      );
    }

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

    const parsed = aiChatRequestSchema.safeParse(body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      const details = Object.entries(fieldErrors).flatMap(([field, messages]) =>
        (messages ?? []).map((message: string) => ({ field, message }))
      );
      return errorResponse("VALIDATION_ERROR", "Invalid input", details, 400);
    }

    const { messages, context, model: requestedModel } = parsed.data;

    // Validate and select model
    const model =
      requestedModel && SUPPORTED_MODELS.includes(requestedModel as typeof SUPPORTED_MODELS[number])
        ? requestedModel
        : DEFAULT_MODEL;

    // Build messages for OpenAI
    const openAIMessages = buildOpenAIMessages(messages, context);

    // Log request for debugging (excluding full context for brevity)
    console.log(
      `[AI Chat] User: ${ctx.userId}, Tenant: ${ctx.tenantId}, Model: ${model}, Messages: ${messages.length}, HasContext: ${!!context}`
    );

    try {
      // Call OpenAI API with streaming
      const response = await fetch(OPENAI_API_URL, {
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

        if (response.status === 401) {
          return errorResponse(
            "AUTH_ERROR",
            "AI service authentication failed",
            undefined,
            503
          );
        }
        if (response.status === 429) {
          return errorResponse(
            "RATE_LIMITED",
            "AI service rate limited. Please try again later.",
            undefined,
            429
          );
        }
        return errorResponse(
          "AI_ERROR",
          "AI service error",
          undefined,
          502
        );
      }

      // Create streaming response
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body?.getReader();
          if (!reader) {
            controller.close();
            return;
          }

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
                    // Send content as SSE data event
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch {
                  // Skip malformed JSON chunks
                }
              }
            }
          } catch (error) {
            console.error("[AI Chat] Stream error:", error);
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
              )
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
          "X-Model": model,
        },
      });
    } catch (error) {
      console.error("[AI Chat] Request error:", error);
      return errorResponse(
        "AI_ERROR",
        "Failed to connect to AI service",
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
