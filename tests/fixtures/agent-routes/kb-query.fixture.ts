/**
 * Normalized fixtures for POST /api/agent/kb-query.
 *
 * Consumers of this shape (coordinate any field change with both):
 *   - SciSymbioLens-Android — KB query voice tool
 *   - voice-companion-vision — KB query voice tool
 *
 * These fixtures store only the STABLE, voice-client-consumed fields.
 * `query_metadata.elapsed_ms` and any generated ids are non-deterministic in a
 * live response and must be normalized/stripped before comparison — see
 * `stripKbQueryVolatileFields` in tests/unit/api/agent/kb-query.route.test.ts.
 */
import type { KbQueryResult } from "@/lib/agent/kbQuery";

export const kbQueryHappyPathResult: KbQueryResult = {
  answer:
    "Ethanol should be handled with gloves and eye protection; it is flammable.",
  context_blocks: [
    {
      type: "chemical_safety",
      entity: "Ethanol",
      entity_id: "chem-ethanol-1",
      content: "Flammable liquid. Use in a fume hood, away from ignition sources.",
      relevance: 0.92,
      source_page: "page-ethanol-safety",
      source_path: "/Chemicals/Ethanol",
      char_count: 68,
    },
  ],
  query_metadata: {
    intent: "safety",
    search_depth: "medium",
    search_strategy: "rag",
    pages_searched: 3,
    graph_hops: 1,
    elapsed_ms: 42,
  },
};

export const kbQueryEmptyResult: KbQueryResult = {
  answer:
    "I don't have specific information about that in the knowledge base yet.",
  context_blocks: [],
  query_metadata: {
    intent: "general",
    search_depth: "medium",
    search_strategy: "rag",
    pages_searched: 0,
    graph_hops: 0,
    elapsed_ms: 5,
  },
};
