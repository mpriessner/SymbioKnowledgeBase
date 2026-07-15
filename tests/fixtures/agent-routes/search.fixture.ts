/**
 * Normalized fixtures for GET /api/agent/search.
 *
 * Consumers of this shape (coordinate any field change with both):
 *   - SciSymbioLens-Android — KB search voice tool
 *   - voice-companion-vision — KB search voice tool
 *
 * The depth-branch result additionally carries a non-deterministic
 * `searchTimeMs`; the legacy branch's `score` is a `ts_rank` float that varies
 * with corpus content. Neither is pinned to a literal value in the route
 * tests — only presence/type is asserted.
 */
import type { DepthSearchResult } from "@/lib/search/depthSearch";

export const depthSearchHappyPathResult: DepthSearchResult = {
  results: [
    {
      pageId: "page-naoh-1",
      title: "Sodium Hydroxide",
      oneLiner: "Strong base, corrosive.",
      snippet: "Sodium hydroxide (NaOH) is a strong base used in titrations.",
      score: 0.81,
      category: "chemicals",
      space: "team",
      linkedPages: ["page-titration-procedure"],
    },
  ],
  totalCount: 1,
  depth: "medium",
  scope: "team",
  searchTimeMs: 37,
};

export const legacySearchHappyPathRow = {
  page_id: "page-naoh-1",
  title: "Sodium Hydroxide",
  icon: "🧪",
  one_liner: "Strong base, corrosive.",
  plain_text:
    "Sodium hydroxide safety notes: wear gloves and goggles when handling NaOH.",
  score: 0.63,
};
