import { z } from "zod";

export const createPageSchema = z.object({
  title: z
    .string()
    .max(500, "Title must be 500 characters or fewer")
    .optional()
    .default("Untitled"),
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable()
    .optional()
    .default(null),
  icon: z
    .string()
    .max(50, "Icon must be 50 characters or fewer")
    .nullable()
    .optional()
    .default(null),
  coverUrl: z
    .string()
    .url("coverUrl must be a valid URL")
    .nullable()
    .optional()
    .default(null),
});

export const updatePageSchema = z.object({
  title: z
    .string()
    .max(500, "Title must be 500 characters or fewer")
    .optional(),
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable()
    .optional(),
  icon: z
    .string()
    .max(50, "Icon must be 50 characters or fewer")
    .nullable()
    .optional(),
  coverUrl: z
    .string()
    .url("coverUrl must be a valid URL")
    .nullable()
    .optional(),
});

export const listPagesQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must be at most 100")
    .optional()
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0, "Offset must be non-negative")
    .optional()
    .default(0),
  sortBy: z
    .enum(["createdAt", "updatedAt", "title", "position"])
    .optional()
    .default("updatedAt"),
  order: z
    .enum(["asc", "desc"])
    .optional()
    .default("desc"),
  parentId: z
    .string()
    .uuid("parentId must be a valid UUID")
    .nullable()
    .optional(),
  search: z
    .string()
    .max(200, "Search query must be 200 characters or fewer")
    .optional(),
});

export type CreatePagePayload = z.infer<typeof createPageSchema>;
export type UpdatePagePayload = z.infer<typeof updatePageSchema>;
export type ListPagesQuery = z.infer<typeof listPagesQuerySchema>;
