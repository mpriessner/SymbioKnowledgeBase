import { z } from "zod";

/**
 * Content type filters for search.
 * - code: Pages containing code blocks
 * - images: Pages containing images
 * - links: Pages containing external links
 */
export const ContentTypeFilter = z.enum(["code", "images", "links"]);
export type ContentTypeFilter = z.infer<typeof ContentTypeFilter>;

/**
 * Search filter schema.
 */
export const SearchFiltersSchema = z.object({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
    .optional(),
  contentType: z.array(ContentTypeFilter).optional(),
});

export type SearchFilters = z.infer<typeof SearchFiltersSchema>;

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
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  contentType: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : undefined))
    .pipe(z.array(ContentTypeFilter).optional()),
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
  updatedAt?: string;
  matchedBlockIds?: string[];
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
