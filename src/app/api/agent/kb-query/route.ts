import { NextRequest } from "next/server";
import { withAgentAuth } from "@/lib/agent/auth";
import type { AgentContext } from "@/lib/agent/auth";
import { z } from "zod";
import { executeKbQuery } from "@/lib/agent/kbQuery";
import type { SearchDepth } from "@/lib/search/depthSearch";

const kbQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  experiment_id: z.string().optional(),
  session_id: z.string().optional(),
  depth: z.enum(["default", "medium", "deep"]).optional().default("medium"),
  max_blocks: z.number().int().min(1).max(20).optional().default(5),
  strategy: z.enum(["auto", "rag", "agentic"]).optional().default("auto"),
  max_answer_length: z.number().int().min(100).max(5000).optional().default(500),
  max_block_chars: z.number().int().min(100).max(5000).optional(),
});

/**
 * POST /api/agent/kb-query
 *
 * Intelligent query endpoint for the Chemistry Knowledge Base.
 * Classifies intent, extracts entities, searches the knowledge graph,
 * and returns structured context blocks for voice agent / chat injection.
 *
 * Story 36.1 — Dynamic Knowledge Base Retrieval for Voice & Chat
 */
export const POST = withAgentAuth(
  async (req: NextRequest, ctx: AgentContext) => {
    const url = new URL(req.url);
    const includeFormatted = url.searchParams.get("include_formatted") === "true";
    const maxContextCharsParam = url.searchParams.get("max_context_chars");
    const maxContextChars = maxContextCharsParam ? Math.min(Math.max(parseInt(maxContextCharsParam, 10) || 12000, 1000), 50000) : 12000;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json(
        {
          success: false,
          error: "Invalid JSON body",
          data: {
            answer:
              "I couldn't process that request. Please try again.",
            context_blocks: [],
            query_metadata: {
              intent: "general",
              search_depth: "medium",
              search_strategy: "rag",
              pages_searched: 0,
              graph_hops: 0,
              elapsed_ms: 0,
            },
          },
        },
        { status: 400 }
      );
    }

    const parsed = kbQuerySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          error: `Validation error: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          data: {
            answer:
              "I couldn't understand that query. Please provide a question about chemicals, procedures, or experiments.",
            context_blocks: [],
            query_metadata: {
              intent: "general",
              search_depth: "medium",
              search_strategy: "rag",
              pages_searched: 0,
              graph_hops: 0,
              elapsed_ms: 0,
            },
          },
        },
        { status: 400 }
      );
    }

    try {
      const result = await executeKbQuery({
        query: parsed.data.query,
        tenantId: ctx.tenantId,
        experimentId: parsed.data.experiment_id,
        sessionId: parsed.data.session_id,
        depth: parsed.data.depth as SearchDepth,
        maxBlocks: parsed.data.max_blocks,
        strategy: parsed.data.strategy,
        maxAnswerLength: parsed.data.max_answer_length,
        maxBlockChars: parsed.data.max_block_chars,
        includeFormatted,
        maxContextChars,
      });

      return Response.json(
        {
          success: true,
          data: result,
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    } catch (error) {
      console.error("[kb-query] Error:", error);

      return Response.json(
        {
          success: false,
          error: "Internal server error",
          data: {
            answer:
              "I encountered an error while searching the knowledge base. Please try again.",
            context_blocks: [],
            query_metadata: {
              intent: "general",
              search_depth: parsed.data.depth,
              search_strategy: "rag",
              pages_searched: 0,
              graph_hops: 0,
              elapsed_ms: 0,
            },
          },
        },
        { status: 500 }
      );
    }
  }
);
