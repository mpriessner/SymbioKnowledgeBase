import { z } from "zod";

/**
 * Zod schema for validating search query parameters.
 */
export const SearchQuerySchema = z.object({
  q: z
    .string()
    .min(1, "Search query must be at least 1 character")
    .max(500, "Search query must be at most 500 characters"),
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be at most 100")
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0, "Offset must be non-negative")
    .default(0),
});

export type SearchQueryParams = z.infer<typeof SearchQuerySchema>;

/**
 * A single search result in the API response.
 */
export interface SearchResultItem {
  pageId: string;
  pageTitle: string;
  pageIcon: string | null;
  snippet: string;
  score: number;
}

/**
 * The complete search API response.
 */
export interface SearchApiResponse {
  data: SearchResultItem[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    timestamp: string;
  };
}
