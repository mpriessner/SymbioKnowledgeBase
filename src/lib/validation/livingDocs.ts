import { z } from "zod";

export const listHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const compareVersionsSchema = z.object({
  v1: z.coerce.number().int().min(1),
  v2: z.coerce.number().int().min(1),
});
